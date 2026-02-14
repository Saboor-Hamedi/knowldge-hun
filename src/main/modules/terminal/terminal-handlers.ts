import { ipcMain } from 'electron'
import * as os from 'os'
import { existsSync } from 'fs'
import { execSync, exec } from 'child_process'
import { TerminalManager } from './terminal-manager'

/**
 * Terminal IPC Handlers
 * Registers all IPC communication handlers for terminal operations
 */
export class TerminalHandlers {
  private terminalManager: TerminalManager

  constructor(terminalManager: TerminalManager) {
    this.terminalManager = terminalManager
  }

  /**
   * Register all IPC handlers
   */
  register(): void {
    this.registerCreateHandler()
    this.registerWriteHandler()
    this.registerResizeHandler()
    this.registerKillHandler()
    this.registerRestartHandler()
    this.registerListenHandler()
    this.registerGetAvailableShellsHandler()
    this.registerRunCommandHandler()
    this.registerGetBufferHandler()

    console.log('[TerminalHandlers] IPC handlers registered')
  }

  /**
   * Register terminal get buffer handler
   */
  private registerGetBufferHandler(): void {
    ipcMain.handle('terminal:get-buffer', (_, id: string) => {
      const buffer = this.terminalManager.getTerminalBuffer(id)
      return { success: true, buffer }
    })
  }

  /**
   * Register terminal run command handler
   */
  private registerRunCommandHandler(): void {
    ipcMain.handle('terminal:run-command', async (_, command: string, cwd?: string) => {
      const finalCwd = cwd || undefined

      return new Promise((resolve) => {
        exec(command, { cwd: finalCwd }, (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            resolve({
              success: false,
              output: stdout,
              error: stderr || error.message
            })
          } else {
            resolve({
              success: true,
              output: stdout,
              error: stderr
            })
          }
        })
      })
    })
  }

  /**
   * Register terminal creation handler
   */
  private registerCreateHandler(): void {
    ipcMain.handle(
      'terminal:create',
      (_, id: string, cwd?: string, shellType?: string, cols?: number, rows?: number) => {
        this.terminalManager.createTerminal(id, cwd, shellType, cols, rows)
        return { success: true }
      }
    )
  }

  /**
   * Register terminal write handler
   */
  private registerWriteHandler(): void {
    ipcMain.on('terminal:write', (_, id: string, data: string) => {
      this.terminalManager.writeToTerminal(id, data)
    })
  }

  /**
   * Register terminal resize handler
   */
  private registerResizeHandler(): void {
    ipcMain.on('terminal:resize', (_, id: string, cols: number, rows: number) => {
      this.terminalManager.resizeTerminal(id, cols, rows)
    })
  }

  /**
   * Register terminal kill handler
   */
  private registerKillHandler(): void {
    ipcMain.handle('terminal:kill', (_, id: string) => {
      this.terminalManager.killTerminal(id)
      return { success: true }
    })
  }

  /**
   * Register terminal restart handler
   */
  private registerRestartHandler(): void {
    ipcMain.handle(
      'terminal:restart',
      (_, id: string, cwd?: string, shellType?: string, cols?: number, rows?: number) => {
        this.terminalManager.killTerminal(id)
        this.terminalManager.createTerminal(id, cwd, shellType, cols, rows)
        return { success: true }
      }
    )
  }

  /**
   * Register terminal listen handler
   */
  private registerListenHandler(): void {
    ipcMain.on('terminal:listen', (event, id: string) => {
      this.terminalManager.onTerminalData(id, (data) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(`terminal:data:${id}`, data)
        }
      })

      this.terminalManager.onTerminalExit(id, (exitCode) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(`terminal:exit:${id}`, exitCode)
        }
      })
    })
  }

  /**
   * Register get available shells handler
   */
  private registerGetAvailableShellsHandler(): void {
    ipcMain.handle('terminal:get-available-shells', async () => {
      const platform = os.platform()
      const available: Array<{ value: string; label: string }> = []

      if (platform === 'win32') {
        this.addWindowsShells(available)
      } else {
        this.addUnixShells(available, platform)
      }

      return available
    })
  }

  /**
   * Add Windows shells to available list
   */
  private addWindowsShells(available: Array<{ value: string; label: string }>): void {
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
    if (existsSync(gitBashPath)) {
      available.push({ value: 'bash', label: 'Git Bash' })
    }

    // Check for WSL
    try {
      // Use wsl.exe --list --quiet. Note: output is often UTF-16 LE and can contain null chars in node execSync
      const stdout = execSync('wsl.exe --list --quiet', { encoding: 'utf8' })
      // Clean up potential null characters/encoding artifacts
      const cleanStdout = stdout.replace(/\0/g, '')
      const distros = cleanStdout
        .split('\n')
        .map((d) => d.trim())
        .filter((d) => d.length > 0)

      available.push({ value: 'wsl', label: 'WSL (Default)' })
      distros.forEach((distro) => {
        const lowerDistro = distro.toLowerCase()
        // Robustly filter out docker and desktop helper distros
        if (!lowerDistro.includes('docker') && !lowerDistro.includes('desktop')) {
          available.push({ value: `wsl:${distro}`, label: `WSL: ${distro}` })
        }
      })
    } catch {
      // WSL not installed or failed
    }
  }

  /**
   * Add Unix shells to available list
   */
  private addUnixShells(
    available: Array<{ value: string; label: string }>,
    platform: string
  ): void {
    available.push({ value: 'bash', label: 'Bash' })
    if (platform === 'darwin') {
      available.push({ value: 'zsh', label: 'Zsh' })
    }
  }
}
