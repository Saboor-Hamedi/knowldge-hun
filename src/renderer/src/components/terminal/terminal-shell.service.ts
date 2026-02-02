import type { ShellConfig } from './terminal.types'

/**
 * Terminal Shell Service
 * Handles shell detection, icon generation, and shell-related utilities
 */
export class TerminalShellService {
  /**
   * Get available shells from the main process
   */
  async getAvailableShells(): Promise<ShellConfig[]> {
    try {
      const available = await window.api.invoke('terminal:get-available-shells')
      return available
    } catch (error) {
      console.error('[TerminalShellService] Failed to get available shells:', error)
      // Fallback to PowerShell on Windows
      return [{ value: 'powershell', label: 'PowerShell' }]
    }
  }

  /**
   * Get SVG icon for a specific shell type
   */
  getShellIconSVG(shell: string): string {
    const icons: Record<string, string> = {
      powershell: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
      pwsh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
      cmd: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
      bash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 12H15L13.5 15.5H8.5L7 12H2"></path><path d="M5.45 5.11L2 12V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V12L18.55 5.11C18.19 4.45 17.51 4 16.76 4H7.24C6.49 4 5.81 4.45 5.45 5.11Z"></path></svg>`,
      wsl: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"></path><path d="M12 8v4l3 3"></path></svg>`
    }

    if (shell.startsWith('wsl:')) return icons.wsl
    return icons[shell] || icons.powershell
  }

  /**
   * Get display name for a shell type
   */
  getShellDisplayName(shellType: string, index: number, customName?: string): string {
    if (customName) return customName
    return `${shellType} ${index}`
  }

  /**
   * Validate shell type
   */
  isValidShellType(shellType: string): boolean {
    const validShells = ['powershell', 'pwsh', 'cmd', 'bash', 'wsl', 'zsh']
    return validShells.includes(shellType) || shellType.startsWith('wsl:')
  }
}
