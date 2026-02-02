export type GitStatus = 'modified' | 'staged' | 'untracked' | 'deleted' | 'none'

export interface GitMetadata {
  branch: string
  remote?: string
  repoName?: string
}

export class GitService {
  private static instance: GitService
  private statusMap: Record<string, GitStatus> = {}
  private metadata: GitMetadata = { branch: '' }
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private isRefreshing = false

  private constructor() {
    this.startPolling()
    this.attachListeners()
  }

  public static getInstance(): GitService {
    if (!GitService.instance) {
      GitService.instance = new GitService()
    }
    return GitService.instance
  }

  /**
   * Refreshes the Git status and metadata from the main process.
   */
  public async refreshStatus(): Promise<void> {
    if (this.isRefreshing) return

    // Check if API is available (it might not be in some contexts)
    if (!window.api || typeof window.api.getGitInfo !== 'function') {
      return
    }

    this.isRefreshing = true
    try {
      const { status: rawStatus, metadata: rawMetadata } = await window.api.getGitInfo()
      const newMap: Record<string, GitStatus> = {}

      Object.entries(rawStatus).forEach(([filePath, status]) => {
        // status is 2 chars: X (index) and Y (worktree)
        const x = status[0]
        const y = status[1]
        let type: GitStatus = 'none'

        if (status === '??' || x === 'A') {
          type = 'untracked'
        } else if (x === 'M' || y === 'M' || x === 'R') {
          type = 'modified'
        } else if (x === 'D' || y === 'D') {
          type = 'deleted'
        }

        if (type !== 'none') {
          newMap[filePath] = type
        }
      })

      // Only dispatch if status or metadata actually changed
      const statusChanged = JSON.stringify(this.statusMap) !== JSON.stringify(newMap)
      const metadataChanged = JSON.stringify(this.metadata) !== JSON.stringify(rawMetadata)

      this.statusMap = newMap
      this.metadata = rawMetadata

      if (statusChanged || metadataChanged) {
        window.dispatchEvent(
          new CustomEvent('git-status-changed', {
            detail: { status: this.statusMap, metadata: this.metadata }
          })
        )
      }
    } catch (err) {
      console.error('[GitService] Failed to refresh info:', err)
    } finally {
      this.isRefreshing = false
    }
  }

  /**
   * Returns the Git status of a specific file/id.
   */
  public getStatus(id: string): GitStatus {
    // Normalize path for lookup
    const path = id.replace(/\\/g, '/')
    return this.statusMap[path] || 'none'
  }

  /**
   * Returns the repository metadata.
   */
  public getMetadata(): GitMetadata {
    return this.metadata
  }

  private startPolling(): void {
    if (this.pollInterval) return
    // Initial refresh
    this.refreshStatus()
    // Poll every 15 seconds (slightly less aggressive)
    this.pollInterval = setInterval(() => this.refreshStatus(), 15000)
  }

  private attachListeners(): void {
    // Refresh on focus
    window.addEventListener('focus', () => this.refreshStatus())
    // Refresh on vault changes
    window.addEventListener('vault-changed', () => this.refreshStatus())
    // Refresh on manual re-renders from tree
    window.addEventListener('refresh-git', () => this.refreshStatus())
  }

  public stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }
}

export const gitService = GitService.getInstance()
