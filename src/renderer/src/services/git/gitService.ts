export type GitStatus = 'modified' | 'staged' | 'untracked' | 'deleted' | 'none'

export class GitService {
  private static instance: GitService
  private statusMap: Record<string, GitStatus> = {}
  private pollInterval: number | null = null

  private constructor() {
    this.startPolling()
  }

  public static getInstance(): GitService {
    if (!GitService.instance) {
      GitService.instance = new GitService()
    }
    return GitService.instance
  }

  public async refreshStatus(): Promise<void> {
    try {
      const rawStatus = await window.api.getGitStatus()
      const newMap: Record<string, GitStatus> = {}

      Object.entries(rawStatus).forEach(([filePath, status]) => {
        // status is 2 chars: X (index) and Y (worktree)
        const x = status[0]
        const y = status[1]
        let type: GitStatus = 'none'

        if (status === '??' || x === 'A') {
          type = 'untracked' // Shown as Green
        } else if (x === 'M' || y === 'M' || x === 'R') {
          type = 'modified' // Shown as Yellow
        } else if (x === 'D' || y === 'D') {
          type = 'deleted' // Shown as Red
        }

        if (type !== 'none') {
          newMap[filePath] = type
        }
      })

      this.statusMap = newMap
      window.dispatchEvent(new CustomEvent('git-status-changed', { detail: this.statusMap }))
    } catch (err) {
      console.error('[GitService] Failed to refresh status:', err)
    }
  }

  public getStatus(filePath: string): GitStatus {
    // Normalize path (Git uses forward slashes, root is vault path)
    const normalizedPath = filePath.replace(/\\/g, '/')
    return this.statusMap[normalizedPath] || 'none'
  }

  private startPolling(): void {
    if (this.pollInterval) return

    // Initial refresh
    void this.refreshStatus()

    // Poll every 10 seconds for git status updates
    this.pollInterval = window.setInterval(() => {
      void this.refreshStatus()
    }, 10000)

    // Also refresh on vault changes or focus
    window.addEventListener('focus', () => void this.refreshStatus())
    window.addEventListener('vault-changed', () => void this.refreshStatus())
  }

  public stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }
}

export const gitService = GitService.getInstance()
