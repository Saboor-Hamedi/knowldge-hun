import { ipcMain } from 'electron'
import * as pty from 'node-pty'
import * as os from 'os'
import * as path from 'path'

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
  createTerminal(id: string, cwd?: string): void {
    // Clean up existing session if it exists
    this.killTerminal(id)

    // Determine shell based on platform
    const shell = this.getDefaultShell()
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
   * Get default shell based on platform
   */
  private getDefaultShell(): string {
    const platform = os.platform()

    if (platform === 'win32') {
      // Try PowerShell first, fallback to cmd
      const pwsh = process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe'
      return pwsh.includes('powershell') ? pwsh : 'powershell.exe'
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
  ipcMain.handle('terminal:create', (event, id: string, cwd?: string) => {
    terminalManager.createTerminal(id, cwd)
    return { success: true }
  })

  // Write to terminal
  ipcMain.on('terminal:write', (event, id: string, data: string) => {
    terminalManager.writeToTerminal(id, data)
  })

  // Resize terminal
  ipcMain.on('terminal:resize', (event, id: string, cols: number, rows: number) => {
    terminalManager.resizeTerminal(id, cols, rows)
  })

  // Kill terminal
  ipcMain.handle('terminal:kill', (event, id: string) => {
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

  console.log('[Terminal] IPC handlers registered')
}

/**
 * Cleanup on app quit
 */
export function cleanupTerminals(): void {
  terminalManager.cleanup()
}
