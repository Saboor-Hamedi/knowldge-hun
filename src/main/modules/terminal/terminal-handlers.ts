import { ipcMain } from 'electron'
import * as os from 'os'
import { execSync } from 'child_process'
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

    console.log('[TerminalHandlers] IPC handlers registered')
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
    try {
      const fs = require('fs')
      fs.accessSync(gitBashPath)
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
