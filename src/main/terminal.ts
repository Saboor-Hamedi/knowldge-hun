import { ipcMain } from 'electron'
import * as pty from 'node-pty'
import * as os from 'os'
import { execSync } from 'child_process'

interface TerminalSession {
  id: string
  ptyProcess: pty.IPty
  cwd: string
}

class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map()

  /**
   * Create a new terminal session
   */
  createTerminal(id: string, cwd?: string, shellType?: string): void {
    // Clean up existing session if it exists
    this.killTerminal(id)

    // Determine shell based on parameter or platform
    const shell = shellType ? this.getShellPath(shellType) : this.getDefaultShell()
    const workingDir = cwd || os.homedir()

    // Create PTY process
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: workingDir,
      env: process.env as { [key: string]: string }
    })

    // Store session
    this.sessions.set(id, {
      id,
      ptyProcess,
      cwd: workingDir
    })

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
      session.ptyProcess.kill()
      this.sessions.delete(id)
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

    session.ptyProcess.onData(callback)
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

    session.ptyProcess.onExit(({ exitCode }) => {
      callback(exitCode)
      this.sessions.delete(id)
    })
  }

  /**
   * Get shell path based on shell type
   */
  private getShellPath(shellType: string): string {
    const platform = os.platform()

    if (platform === 'win32') {
      switch (shellType) {
        case 'powershell':
          return 'powershell.exe'
        case 'pwsh':
          return 'pwsh.exe'
        case 'cmd':
          return 'cmd.exe'
        case 'bash':
          return 'C:\\Program Files\\Git\\bin\\bash.exe'
        case 'wsl':
          return 'wsl.exe'
        default:
          return 'powershell.exe'
      }
    } else {
      switch (shellType) {
        case 'bash':
          return '/bin/bash'
        case 'zsh':
          return '/bin/zsh'
        default:
          return process.env.SHELL || '/bin/bash'
      }
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
    for (const [id, session] of this.sessions) {
      try {
        session.ptyProcess.kill()
        console.log(`[Terminal] Cleaned up session ${id}`)
      } catch (error) {
        console.error(`[Terminal] Error cleaning up session ${id}:`, error)
      }
    }
    this.sessions.clear()
  }
}

// Singleton instance
const terminalManager = new TerminalManager()

/**
 * Register IPC handlers for terminal operations
 */
export function registerTerminalHandlers(): void {
  // Create terminal
  ipcMain.handle('terminal:create', (_, id: string, cwd?: string, shellType?: string) => {
    terminalManager.createTerminal(id, cwd, shellType)
    return { success: true }
  })

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

  // Setup data listener
  ipcMain.on('terminal:listen', (event, id: string) => {
    terminalManager.onTerminalData(id, (data) => {
      event.sender.send(`terminal:data:${id}`, data)
    })

    terminalManager.onTerminalExit(id, (exitCode) => {
      event.sender.send(`terminal:exit:${id}`, exitCode)
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
        execSync('wsl --list', { stdio: 'ignore' })
        available.push({ value: 'wsl', label: 'WSL' })
      } catch {
        // WSL not installed
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
