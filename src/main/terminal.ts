import { ipcMain } from 'electron'
import * as pty from 'node-pty'
import * as os from 'os'
import { join, isAbsolute } from 'path'
import { existsSync } from 'fs'
import { execSync, spawnSync } from 'child_process'

interface TerminalSession {
  id: string
  ptyProcess: pty.IPty
  cwd: string
  disposables: pty.IDisposable[]
}

class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map()
  private dataBuffers: Map<string, string[]> = new Map()
  private dataListeners: Map<string, boolean> = new Map()
  private isCleaningUp: boolean = false

  createTerminal(
    id: string,
    cwd?: string,
    shellType?: string,
    cols: number = 80,
    rows: number = 24
  ): void {
    // Re-use existing session if it exists (handles window reloads)
    if (this.sessions.has(id)) {
      console.log(`[Terminal] Re-using existing session ${id} for reconnection`)
      return
    }

    // Determine shell based on parameter or platform
    const { exe: shell, args } = shellType
      ? this.getShellPath(shellType)
      : { exe: this.getDefaultShell(), args: [] }

    // Validate working directory
    let workingDir = cwd || os.homedir()
    if (!existsSync(workingDir)) {
      console.warn(
        `[Terminal] Working directory ${workingDir} does not exist, falling back to homedir`
      )
      workingDir = os.homedir()
    }

    // Scrub environment variables that can confuse shells on Windows
    // Especially if Electron was started from a Bash/Unix-like environment (e.g. Git Bash)
    const env = { ...process.env } as Record<string, string>
    if (os.platform() === 'win32') {
      // These variables cause tools like oh-my-posh to use the wrong path style
      delete env.SHELL
      delete env.TERM
      delete env.TERM_PROGRAM

      // Ensure we have a sensible TERM for xterm.js
      env.TERM = 'xterm-256color'
      // Identify our app as the terminal program
      env.TERM_PROGRAM = 'knowledge-hub'
    }

    // Create PTY process
    let ptyProcess: pty.IPty
    try {
      ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: workingDir,
        env
      })
    } catch (err) {
      console.error(`[Terminal] Failed to spawn pty:`, err)
      throw new Error(
        `Failed to spawn terminal process: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Store session
    this.sessions.set(id, {
      id,
      ptyProcess,
      cwd: workingDir,
      disposables: []
    })

    // Prepare buffer for initial output
    this.dataBuffers.set(id, [])
    this.dataListeners.set(id, false)

    // Start listening for data immediately to buffer it
    const dataDisp = ptyProcess.onData((data) => {
      const buffer = this.dataBuffers.get(id)
      if (buffer && !this.dataListeners.get(id)) {
        buffer.push(data)
      }
    })

    const session = this.sessions.get(id)
    if (session) session.disposables.push(dataDisp)

    console.log(`[Terminal] Created session ${id} with shell ${shell} in ${workingDir}`)
  }

  /**
   * Write data to terminal
   */
  writeToTerminal(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (!session) {
      console.error(`[Terminal] Session ${id} not found`)
      return
    }

    session.ptyProcess.write(data)
  }

  /**
   * Resize terminal
   */
  resizeTerminal(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id)
    if (!session) {
      console.error(`[Terminal] Session ${id} not found for resize`)
      return
    }

    session.ptyProcess.resize(cols, rows)
  }

  /**
   * Kill terminal session
   */
  killTerminal(id: string): void {
    const session = this.sessions.get(id)
    if (!session) {
      return
    }

    try {
      // Dispose listeners first
      session.disposables.forEach((d) => d.dispose())
      session.disposables = []

      session.ptyProcess.kill()
      this.sessions.delete(id)
      this.dataBuffers.delete(id)
      this.dataListeners.delete(id)
      console.log(`[Terminal] Killed session ${id}`)
    } catch (error) {
      console.error(`[Terminal] Error killing session ${id}:`, error)
    }
  }

  /**
   * Get terminal data stream
   */
  onTerminalData(id: string, callback: (data: string) => void): void {
    const session = this.sessions.get(id)
    if (!session) {
      console.error(`[Terminal] Session ${id} not found for data listener`)
      return
    }

    this.dataListeners.set(id, true)

    // Flush buffered data
    const buffer = this.dataBuffers.get(id)
    if (buffer && buffer.length > 0) {
      buffer.forEach((data) => callback(data))
      this.dataBuffers.set(id, []) // Clear after flush
    }

    const dataDisp = session.ptyProcess.onData(callback)
    session.disposables.push(dataDisp)
  }

  /**
   * Get terminal exit handler
   */
  onTerminalExit(id: string, callback: (exitCode: number) => void): void {
    const session = this.sessions.get(id)
    if (!session) {
      console.error(`[Terminal] Session ${id} not found for exit listener`)
      return
    }

    const exitDisp = session.ptyProcess.onExit(({ exitCode }) => {
      // Very important: don't notify renderer if we are cleaning up for app quit
      if (this.isCleaningUp) return

      callback(exitCode)
      this.killTerminal(id) // use killTerminal for consistent cleanup
    })
    session.disposables.push(exitDisp)
  }

  /**
   * Get shell path based on shell type
   */
  private getShellPath(shellType: string): { exe: string; args: string[] } {
    const platform = os.platform()

    if (platform === 'win32') {
      if (shellType.startsWith('wsl:')) {
        const distro = shellType.split(':')[1]
        // Verify wsl.exe exists first
        if (this.isExecutableAvailable('wsl.exe')) {
          return { exe: 'wsl.exe', args: ['-d', distro] }
        }
      }

      let targetExe = ''
      const targetArgs: string[] = []

      switch (shellType) {
        case 'powershell':
          targetExe = 'powershell.exe'
          break
        case 'pwsh':
          targetExe = 'pwsh.exe'
          break
        case 'cmd':
          targetExe = 'cmd.exe'
          break
        case 'bash': {
          const commonPaths = [
            'C:\\Program Files\\Git\\bin\\bash.exe',
            'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
            join(os.homedir(), 'AppData\\Local\\Programs\\Git\\bin\\bash.exe')
          ]
          for (const path of commonPaths) {
            if (existsSync(path)) {
              targetExe = path
              break
            }
          }
          if (!targetExe) targetExe = 'bash.exe'
          break
        }
        case 'wsl':
          targetExe = 'wsl.exe'
          break
        default:
          targetExe = 'powershell.exe'
      }

      // Final check: if the selected exe is not available, fallback to default
      if (this.isExecutableAvailable(targetExe)) {
        return { exe: targetExe, args: targetArgs }
      }

      console.warn(
        `[Terminal] Requested shell ${shellType} (${targetExe}) not found. Falling back to default shell.`
      )
      return { exe: this.getDefaultShell(), args: [] }
    } else {
      let targetExe = ''
      switch (shellType) {
        case 'bash':
          targetExe = '/bin/bash'
          break
        case 'zsh':
          targetExe = '/bin/zsh'
          break
        default:
          targetExe = process.env.SHELL || '/bin/bash'
      }

      if (this.isExecutableAvailable(targetExe)) {
        return { exe: targetExe, args: [] }
      }
      return { exe: '/bin/sh', args: [] }
    }
  }

  /**
   * Helper to verify if an executable exists or is in PATH
   */
  private isExecutableAvailable(exe: string): boolean {
    if (isAbsolute(exe)) {
      return existsSync(exe)
    }

    try {
      const cmd = os.platform() === 'win32' ? 'where.exe' : 'which'
      const result = spawnSync(cmd, [exe], { stdio: 'ignore' })
      return result.status === 0
    } catch {
      return false
    }
  }

  /**
   * Get default shell based on platform
   */
  private getDefaultShell(): string {
    const platform = os.platform()

    if (platform === 'win32') {
      // Prioritize PowerShell Core (pwsh) if available, then PowerShell, then cmd
      try {
        execSync('pwsh --version', { stdio: 'ignore' })
        return 'pwsh.exe'
      } catch {
        return 'powershell.exe'
      }
    } else if (platform === 'darwin') {
      return process.env.SHELL || '/bin/zsh'
    } else {
      return process.env.SHELL || '/bin/bash'
    }
  }

  /**
   * Cleanup all sessions
   */
  cleanup(): void {
    this.isCleaningUp = true
    for (const [id, session] of this.sessions) {
      try {
        // Dispose all listeners to prevent callbacks from firing during cleanup
        session.disposables.forEach((d) => d.dispose())
        session.disposables = []

        session.ptyProcess.kill()
        console.log(`[Terminal] Cleaned up session ${id}`)
      } catch (error) {
        console.error(`[Terminal] Error cleaning up session ${id}:`, error)
      }
    }
    this.sessions.clear()
    this.dataBuffers.clear()
    this.dataListeners.clear()
  }
}

// Singleton instance
const terminalManager = new TerminalManager()

/**
 * Register IPC handlers for terminal operations
 */
export function registerTerminalHandlers(): void {
  // Create terminal
  ipcMain.handle(
    'terminal:create',
    (_, id: string, cwd?: string, shellType?: string, cols?: number, rows?: number) => {
      terminalManager.createTerminal(id, cwd, shellType, cols, rows)
      return { success: true }
    }
  )

  // Write to terminal
  ipcMain.on('terminal:write', (_, id: string, data: string) => {
    terminalManager.writeToTerminal(id, data)
  })

  // Resize terminal
  ipcMain.on('terminal:resize', (_, id: string, cols: number, rows: number) => {
    terminalManager.resizeTerminal(id, cols, rows)
  })

  // Kill terminal
  ipcMain.handle('terminal:kill', (_, id: string) => {
    terminalManager.killTerminal(id)
    return { success: true }
  })

  // Restart terminal (for robust reconnection)
  ipcMain.handle(
    'terminal:restart',
    (_, id: string, cwd?: string, shellType?: string, cols?: number, rows?: number) => {
      terminalManager.killTerminal(id)
      terminalManager.createTerminal(id, cwd, shellType, cols, rows)
      return { success: true }
    }
  )

  // Setup data listener
  ipcMain.on('terminal:listen', (event, id: string) => {
    terminalManager.onTerminalData(id, (data) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(`terminal:data:${id}`, data)
      }
    })

    terminalManager.onTerminalExit(id, (exitCode) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(`terminal:exit:${id}`, exitCode)
      }
    })
  })

  // Get available shells
  ipcMain.handle('terminal:get-available-shells', async () => {
    const platform = os.platform()
    const available: Array<{ value: string; label: string }> = []

    if (platform === 'win32') {
      // Always available on Windows
      available.push({ value: 'powershell', label: 'PowerShell' })
      available.push({ value: 'cmd', label: 'Command Prompt' })

      // Check for PowerShell Core
      try {
        execSync('pwsh --version', { stdio: 'ignore' })
        available.push({ value: 'pwsh', label: 'PowerShell Core' })
      } catch {
        // pwsh not installed
      }

      // Check for Git Bash
      const gitBashPath = 'C:\\Program Files\\Git\\bin\\bash.exe'
      try {
        const fs = await import('fs/promises')
        await fs.access(gitBashPath)
        available.push({ value: 'bash', label: 'Git Bash' })
      } catch {
        // Git Bash not installed
      }

      // Check for WSL
      try {
        const stdout = execSync('wsl --list --quiet', { encoding: 'utf8' })
        const distros = stdout
          .split('\n')
          .map((d) => d.trim())
          .filter((d) => d.length > 0)

        available.push({ value: 'wsl', label: 'WSL (Default)' })
        distros.forEach((distro) => {
          const lowerDistro = distro.toLowerCase()
          if (!lowerDistro.includes('docker')) {
            available.push({ value: `wsl:${distro}`, label: `WSL: ${distro}` })
          }
        })
      } catch {
        // WSL not installed or failed
      }
    } else {
      // Unix-like systems
      available.push({ value: 'bash', label: 'Bash' })
      if (platform === 'darwin') {
        available.push({ value: 'zsh', label: 'Zsh' })
      }
    }

    return available
  })

  console.log('[Terminal] IPC handlers registered')
}

/**
 * Cleanup on app quit
 */
export function cleanupTerminals(): void {
  terminalManager.cleanup()
}
