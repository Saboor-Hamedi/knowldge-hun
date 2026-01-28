import { vaultService } from '../../services/vaultService'
import { codicons } from '../../utils/codicons'
import './welcome-page.css'

export interface WelcomePageCallbacks {
  onOpenVault: () => void
  onOpenRecent: (path: string) => void
  onCreateVault: () => void
}

export class WelcomePage {
  private container: HTMLElement
  private parent: HTMLElement
  private callbacks: WelcomePageCallbacks | null = null

  constructor(parentId: string) {
    this.parent = document.getElementById(parentId) as HTMLElement
    this.container = document.createElement('div')
    this.container.className = 'welcome-page'
    this.container.style.display = 'none' // Hidden by default
    this.parent.appendChild(this.container)
  }

  setCallbacks(callbacks: WelcomePageCallbacks): void {
    this.callbacks = callbacks
  }

  show(): void {
    this.container.style.display = 'flex'
    this.render()
  }

  hide(): void {
    this.container.style.display = 'none'
  }

  isVisible(): boolean {
    return this.container.style.display !== 'none'
  }

  private async render(): Promise<void> {
    this.container.innerHTML = `
      <div class="welcome-content">
        <div class="welcome-header">
          <h1 class="welcome-title">Knowledge Hub</h1>
          <p class="welcome-subtitle">Your personal knowledge base</p>
        </div>

        <div class="welcome-grid">
          <div class="welcome-section">
            <div class="welcome-section-title">Start</div>
            <div class="welcome-action-list">
              <button class="welcome-action-button" id="welcome-new">
                <span class="welcome-icon">${codicons.newFolder}</span>
                <div class="welcome-action-text">
                  <div class="welcome-action-title">New File...</div> <!-- "Create New Vault" contextually -->
                </div>
              </button>
              <button class="welcome-action-button" id="welcome-open">
                <span class="welcome-icon">${codicons.folder}</span>
                <div class="welcome-action-text">
                  <div class="welcome-action-title">Open File...</div> <!-- "Open Vault" contextually -->
                </div>
              </button>
            </div>
          </div>

          <div class="welcome-section">
            <div class="welcome-section-title">Recent</div>
            <div class="recent-list" id="welcome-recents">
              <div class="welcome-loading">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    `

    this.attachEvents()
    await this.loadRecents()
  }

  private attachEvents(): void {
    const newBtn = this.container.querySelector('#welcome-new')
    const openBtn = this.container.querySelector('#welcome-open')

    newBtn?.addEventListener('click', () => this.callbacks?.onCreateVault())
    openBtn?.addEventListener('click', () => this.callbacks?.onOpenVault())
  }

  private async loadRecents(): Promise<void> {
    const recentList = this.container.querySelector('#welcome-recents')
    if (!recentList) return

    try {
      const vaults = await vaultService.getRecentVaults()

      if (vaults.length === 0) {
        recentList.innerHTML = '<div class="welcome-empty">No recent workspaces</div>'
        return
      }

      recentList.innerHTML = vaults
        .slice(0, 3) // Limit to top 3
        .map(
          (vault) => `
        <div class="recent-item" data-path="${this.escapeHtml(vault.path)}">
          <div class="recent-name">${this.escapeHtml(vault.name)}</div>
          <div class="recent-path">${this.escapeHtml(vault.path)}</div>
        </div>
      `
        )
        .join('')

      // Attach click handlers
      const items = recentList.querySelectorAll('.recent-item')
      items.forEach((item) => {
        item.addEventListener('click', () => {
          const path = (item as HTMLElement).dataset.path
          if (path) this.callbacks?.onOpenRecent(path)
        })
      })
    } catch (err) {
      console.error('Failed to load recents:', err)
      recentList.innerHTML = '<div class="welcome-error">Failed to load recent vaults</div>'
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
