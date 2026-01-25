/**
 * GitHub Gist Sync Service
 * Handles backup and restore operations using GitHub Gists
 */

export interface GistConfig {
  token: string
  gistId?: string
  autoSync?: boolean
}

export interface SyncResult {
  success: boolean
  message: string
  gistId?: string
  timestamp?: number
}

export class GistSyncService {
  /**
   * Validates GitHub token format
   */
  validateToken(token: string): boolean {
    // GitHub personal access tokens are typically 40 characters (classic) or start with ghp_ (fine-grained)
    return token.length >= 20 && (token.startsWith('ghp_') || token.length === 40)
  }

  /**
   * Creates or updates a Gist with vault backup
   */
  async backupVault(config: GistConfig, vaultData: any): Promise<SyncResult> {
    try {
      if (!this.validateToken(config.token)) {
        return {
          success: false,
          message: 'Invalid GitHub token format'
        }
      }

      const result = await window.api.syncBackup(config.token, config.gistId, vaultData)

      return {
        success: result.success,
        message: result.message,
        gistId: result.gistId,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Backup failed'
      }
    }
  }

  /**
   * Restores vault from Gist
   */
  async restoreVault(config: GistConfig): Promise<SyncResult & { data?: any }> {
    try {
      if (!this.validateToken(config.token)) {
        return {
          success: false,
          message: 'Invalid GitHub token format'
        }
      }

      if (!config.gistId) {
        return {
          success: false,
          message: 'No Gist ID configured'
        }
      }

      const result = await window.api.syncRestore(config.token, config.gistId)

      return {
        success: result.success,
        message: result.message,
        data: result.data,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Restore failed'
      }
    }
  }

  /**
   * Tests GitHub token by making a simple API call
   */
  async testToken(token: string): Promise<{ valid: boolean; message: string }> {
    try {
      if (!this.validateToken(token)) {
        return {
          valid: false,
          message: 'Invalid token format'
        }
      }

      const result = await window.api.syncTestToken(token)
      return {
        valid: result.valid,
        message: result.message
      }
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Token test failed'
      }
    }
  }
}

export const gistSyncService = new GistSyncService()
