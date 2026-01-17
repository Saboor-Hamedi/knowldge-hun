import type { AppSettings } from '../core/types'

export interface VaultInfo {
  path: string
  name: string
  exists: boolean
  lastOpened?: number
}

export interface VaultValidationResult {
  isValid: boolean
  vaultPath: string
  error?: string
  suggestion?: string
}

export class VaultService {
  /**
   * Validates if a vault path exists and is accessible
   */
  async validateVaultPath(path: string | undefined): Promise<VaultValidationResult> {
    if (!path || path.trim().length === 0) {
      return {
        isValid: false,
        vaultPath: '',
        error: 'No vault path specified',
        suggestion: 'Please select a vault folder'
      }
    }

    try {
      const result = await window.api.validateVaultPath(path)
      if (result.exists) {
        return {
          isValid: true,
          vaultPath: path
        }
      } else {
        return {
          isValid: false,
          vaultPath: path,
          error: 'Vault path does not exist',
          suggestion: 'The vault folder may have been moved or deleted'
        }
      }
    } catch (error) {
      return {
        isValid: false,
        vaultPath: path,
        error: error instanceof Error ? error.message : 'Failed to validate vault path',
        suggestion: 'Please check the vault path and try again'
      }
    }
  }

  /**
   * Gets list of recent vaults with their status
   */
  async getRecentVaults(): Promise<VaultInfo[]> {
    try {
      const settings = await window.api.getSettings()
      const recentPaths = (settings as AppSettings).recentVaults || []

      const vaults: VaultInfo[] = []
      for (const path of recentPaths) {
        try {
          const validation = await window.api.validateVaultPath(path)
          vaults.push({
            path,
            name: this.getVaultName(path),
            exists: validation.exists,
            lastOpened: validation.lastOpened
          })
        } catch {
          // Skip invalid paths
          vaults.push({
            path,
            name: this.getVaultName(path),
            exists: false
          })
        }
      }

      return vaults
    } catch (error) {
      console.error('[VaultService] Failed to get recent vaults:', error)
      return []
    }
  }

  /**
   * Attempts to locate a moved vault by searching common locations
   */
  async locateMovedVault(originalPath: string): Promise<string | null> {
    try {
      const result = await window.api.locateMovedVault(originalPath)
      return result.foundPath || null
    } catch (error) {
      console.error('[VaultService] Failed to locate moved vault:', error)
      return null
    }
  }

  /**
   * Opens a vault by path
   */
  async openVault(path: string): Promise<{ success: boolean; error?: string }> {
    try {
      await window.api.setVault(path)
      await window.api.updateSettings({ vaultPath: path })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open vault'
      }
    }
  }

  /**
   * Chooses a new vault folder
   */
  async chooseVault(): Promise<{ path: string; name: string; changed: boolean }> {
    try {
      return await window.api.chooseVault()
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to choose vault')
    }
  }

  /**
   * Extracts vault name from path
   */
  getVaultName(path: string): string {
    const parts = path.split(/[\\/]/)
    return parts[parts.length - 1] || 'Vault'
  }

  /**
   * Removes a vault from recent vaults
   */
  async removeRecentVault(path: string): Promise<void> {
    try {
      const settings = await window.api.getSettings()
      const recentPaths = (settings as AppSettings).recentVaults || []
      const filtered = recentPaths.filter(p => p !== path)
      await window.api.updateSettings({ recentVaults: filtered })
    } catch (error) {
      console.error('[VaultService] Failed to remove recent vault:', error)
      throw error
    }
  }
}

export const vaultService = new VaultService()
