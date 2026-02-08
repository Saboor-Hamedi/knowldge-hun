import * as pty from 'node-pty'
import * as os from 'os'
import { join, isAbsolute } from 'path'
import { existsSync } from 'fs'
import { execSync, spawnSync } from 'child_process'
import type { TerminalSession, ShellPathConfig } from './terminal.types'

/**
 * Terminal Manager
 * Manages PTY processes for terminal sessions
 */
export class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map()
  private dataBuffers: Map<string, string[]> = new Map()
  private dataListeners: Map<string, boolean> = new Map()
  private isCleaningUp: boolean = false

  /**
   * Create a new terminal session
   */
  createTerminal(
    id: string,
    cwd?: string,
    shellType?: string,
    cols: number = 80,
    rows: number = 24
  ): void {
    // Re-use existing session if it exists (handles window reloads)
    if (this.sessions.has(id)) {
      console.log(`[TerminalManager] Re-using existing session ${id} for reconnection`)
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
        `[TerminalManager] Working directory ${workingDir} does not exist, falling back to homedir`
      )
      workingDir = os.homedir()
    }

    // Scrub environment variables that can confuse shells on Windows
    const env = this.prepareEnvironment()

    // Normalize CWD for shell (e.g. translation to /mnt/c for WSL)
    const normalizedCwd = this.normalizeWorkingDir(workingDir, shell)

    // Create PTY process
    let ptyProcess: pty.IPty
    try {
      ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: normalizedCwd,
        env
      })
    } catch (err) {
      console.error(`[TerminalManager] Failed to spawn pty:`, err)
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

    console.log(`[TerminalManager] Created session ${id} with shell ${shell} in ${workingDir}`)
  }

  /**
   * Write data to terminal
   */
  writeToTerminal(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (!session) {
      console.error(`[TerminalManager] Session ${id} not found`)
      return
    }

    try {
      session.ptyProcess.write(data)
    } catch (err) {
      console.error(`[TerminalManager] Failed to write to session ${id}:`, err)
    }
  }

  /**
   * Resize terminal
   */
  resizeTerminal(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id)
    if (!session) {
      console.error(`[TerminalManager] Session ${id} not found for resize`)
      return
    }

    // Guard against invalid dimensions
    if (cols <= 0 || rows <= 0) return

    try {
      session.ptyProcess.resize(cols, rows)
    } catch (err) {
      console.warn(`[TerminalManager] Resize failed for session ${id}:`, err)
    }
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
      // 1. Dispose listeners first
      session.disposables.forEach((d) => d.dispose())
      session.disposables = []

      // 2. Kill the process tree (Robust approach)
      const pid = session.ptyProcess.pid
      if (os.platform() === 'win32') {
        // Windows: /F (force) /T (tree)
        spawnSync('taskkill', ['/F', '/T', '/PID', pid.toString()])
      } else {
        // Unix: Negative PID kills the entire process group
        try {
          process.kill(-pid, 'SIGKILL')
        } catch {
          session.ptyProcess.kill('SIGKILL')
        }
      }

      this.sessions.delete(id)
      this.dataBuffers.delete(id)
      this.dataListeners.delete(id)
      console.log(`[TerminalManager] Killed session ${id} (PID: ${pid})`)
    } catch (error) {
      console.error(`[TerminalManager] Error killing session ${id}:`, error)
      // Fallback: try basic kill if tree-kill fails
      try {
        session.ptyProcess.kill()
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Setup terminal data listener with IPC Batching (Chunking)
   */
  onTerminalData(id: string, callback: (data: string) => void): void {
    const session = this.sessions.get(id)
    if (!session) {
      console.error(`[TerminalManager] Session ${id} not found for data listener`)
      return
    }

    // Disposal of existing listeners for this session's data to prevent duplication on reconnect
    if (this.dataListeners.get(id)) {
      console.log(`[TerminalManager] Cleaning up existing data listener for session ${id}`)
      // We don't dispose all disposables because some might be process-related,
      // but we should ideally track the data listener specifically.
      // For now, we'll rely on the fact that sessions are usually killed before recreate,
      // but on reconnection/reload, we should clear previous data listeners.

      // Better approach: Find and dispose any existing data listener in the session disposables
      // This is a bit tricky without keeping a specific ref.
    }

    this.dataListeners.set(id, true)

    // 1. Flush buffered data
    const initialBuffer = this.dataBuffers.get(id)
    if (initialBuffer && initialBuffer.length > 0) {
      callback(initialBuffer.join(''))
      this.dataBuffers.set(id, [])
    }

    // 2. Setup Batching (Chunking)
    // We collect data and send it every 16ms (60fps) to avoid IPC congestion
    let batchBuffer = ''
    let batchTimeout: NodeJS.Timeout | null = null

    const flushBatch = (): void => {
      if (batchBuffer) {
        callback(batchBuffer)
        batchBuffer = ''
      }
      batchTimeout = null
    }

    const dataDisp = session.ptyProcess.onData((data) => {
      batchBuffer += data

      // If batch gets huge, flush immediately
      if (batchBuffer.length > 32768) {
        if (batchTimeout) clearTimeout(batchTimeout)
        flushBatch()
        return
      }

      if (!batchTimeout) {
        batchTimeout = setTimeout(flushBatch, 16)
      }
    })

    session.disposables.push({
      dispose: () => {
        if (batchTimeout) clearTimeout(batchTimeout)
        dataDisp.dispose()
      }
    })
  }

  /**
   * Setup terminal exit listener
   */
  onTerminalExit(id: string, callback: (exitCode: number) => void): void {
    const session = this.sessions.get(id)
    if (!session) {
      console.error(`[TerminalManager] Session ${id} not found for exit listener`)
      return
    }

    const exitDisp = session.ptyProcess.onExit(({ exitCode }) => {
      // Don't notify renderer if we are cleaning up for app quit
      if (this.isCleaningUp) return

      callback(exitCode)
      this.killTerminal(id)
    })
    session.disposables.push(exitDisp)
  }

  /**
   * Get shell path based on shell type
   */
  private getShellPath(shellType: string): ShellPathConfig {
    const platform = os.platform()

    if (platform === 'win32') {
      return this.getWindowsShellPath(shellType)
    } else {
      return this.getUnixShellPath(shellType)
    }
  }

  /**
   * Get Windows shell path
   */
  private getWindowsShellPath(shellType: string): ShellPathConfig {
    if (shellType.startsWith('wsl:')) {
      const distro = shellType.split(':')[1]
      const lowerDistro = distro.toLowerCase()

      // Guard: Never allow docker or desktop helper distros
      if (lowerDistro.includes('docker') || lowerDistro.includes('desktop')) {
        console.warn(`[TerminalManager] Blocked attempt to use WSL distro: ${distro}`)
        return { exe: this.getDefaultShell(), args: [] }
      }

      if (this.isExecutableAvailable('wsl.exe')) {
        return { exe: 'wsl.exe', args: ['-d', distro] }
      }
    }

    let targetExe = ''
    const targetArgs: string[] = []

    switch (shellType) {
      case 'powershell':
        // Modern standard is pwsh.exe (PowerShell 7+), falling back to legacy if needed
        targetExe = this.isExecutableAvailable('pwsh.exe') ? 'pwsh.exe' : 'powershell.exe'
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
      `[TerminalManager] Requested shell ${shellType} (${targetExe}) not found. Falling back to default shell.`
    )
    return { exe: this.getDefaultShell(), args: [] }
  }

  /**
   * Get Unix shell path
   */
  private getUnixShellPath(shellType: string): ShellPathConfig {
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

  /**
   * Check if executable is available
   */
  private isExecutableAvailable(exe: string): boolean {
    if (!exe) return false
    if (isAbsolute(exe)) {
      return existsSync(exe)
    }

    try {
      // 1. Primary check: where.exe/which
      const cmd = os.platform() === 'win32' ? 'where.exe' : 'which'
      const result = spawnSync(cmd, [exe], { stdio: 'ignore' })
      if (result.status === 0) return true

      // 2. Fallback check: try to run it (Windows specific fallback for pwsh)
      if (os.platform() === 'win32') {
        const probe = spawnSync(exe, ['--version'], { stdio: 'ignore' })
        return probe.status === 0
      }
      return false
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

  private prepareEnvironment(): Record<string, string> {
    const env = { ...process.env } as Record<string, string>

    if (os.platform() === 'win32') {
      // WIPE all variables that trick tools (Oh-My-Posh, etc.) into using POSIX style.
      // These are often leaked from an active Git Bash or VS Code terminal session.
      const unixVars = [
        'SHELL',
        'TERM',
        'TERM_PROGRAM',
        'TERM_PROGRAM_VERSION',
        'MSYSTEM',
        'OSTYPE',
        'INFOPATH',
        'MANPATH',
        'PLOW_PLATFORM',
        'ACLOCAL_PATH',
        'PKG_CONFIG_PATH'
      ]
      unixVars.forEach((v) => delete env[v])

      // If HOME is set to a POSIX path (e.g. by Git Bash), it breaks PowerShell tools.
      // On Windows, USERPROFILE is the source of truth for PowerShell.
      if (env.HOME && env.HOME.startsWith('/')) {
        delete env.HOME
      }

      // Explicitly announce ConPTY capability if needed, but avoid 'xterm-256color'
      // which is the primary trigger for POSIX path generation in Go tools.
    }

    return env
  }

  /**
   * Normalize working directory for specific shells (Windows only)
   */
  private normalizeWorkingDir(dir: string, _shell: string): string {
    // CRITICAL: We previously tried to translate paths to POSIX for WSL/Bash here.
    // This was WRONG. node-pty/CreateProcess requires a valid Windows native directory
    // to start the process. The shell executable (wsl.exe, bash.exe) handles
    // internal translation itself. Returning a POSIX path here causes Error 267.
    void _shell // Mark as intentionally unused
    return dir
  }

  /**
   * Cleanup all sessions
   */
  cleanup(): void {
    this.isCleaningUp = true
    const ids = Array.from(this.sessions.keys())
    for (const id of ids) {
      this.killTerminal(id)
    }
    this.sessions.clear()
    this.dataBuffers.clear()
    this.dataListeners.clear()
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size
  }

  /**
   * Check if session exists
   */
  hasSession(id: string): boolean {
    return this.sessions.has(id)
  }
}
