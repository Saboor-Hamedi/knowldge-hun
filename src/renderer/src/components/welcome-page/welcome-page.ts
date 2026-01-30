import { state } from '../../core/state'
import { codicons } from '../../utils/codicons'
import { vaultService, VaultInfo } from '../../services/vaultService'
import { modalManager } from '../modal/modal'
import './welcome-page.css'

export class WelcomePage {
  private container: HTMLElement
  private recentVaults: VaultInfo[] = []
  private onProjectSelect?: (path: string) => void
  private onOpenFolder?: () => void
  private onCreateNew?: () => void
  private onOpenDocs?: () => void

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
  }

  setProjectSelectHandler(handler: (path: string) => void): void {
    this.onProjectSelect = handler
  }

  setOpenFolderHandler(handler: () => void): void {
    this.onOpenFolder = handler
  }

  setCreateNewHandler(handler: () => void): void {
    this.onCreateNew = handler
  }

  setOpenDocsHandler(handler: () => void): void {
    this.onOpenDocs = handler
  }

  /**
   * Check if the welcome page is currently visible
   */
  public isVisible(): boolean {
    return this.container.style.display !== 'none'
  }

  render(): void {
    this.container.innerHTML = `
      <div class="welcome-container">
        <button class="welcome-top-action" id="welcome-docs" title="Documentation (Ctrl+Shift+\)">
          <span class="welcome-top-action__icon">${codicons.info}</span>
          Documentation
        </button>
        <div class="welcome-content">
          <div class="welcome-header">
            <div class="welcome-header__info">
              <h1>Knowledge Hub</h1>
            </div>
          </div>

          <div class="welcome-sections">
            <div class="welcome-section">
              <h2>Recent Projects</h2>
              <div class="recent-list">
                ${
                  this.recentVaults.length > 0
                    ? this.recentVaults
                        .slice(0, 5)
                        .map((p) => {
                          const isCurrent = p.path === state.vaultPath
                          return `
                    <div class="recent-item ${isCurrent ? 'is-active' : ''} ${!p.exists ? 'is-missing' : ''}" data-path="${p.path}">
                      <div class="recent-item__icon">
                        ${p.exists ? codicons.folder : codicons.error}
                      </div>
                      <div class="recent-item__info">
                        <div class="recent-item__name">
                          ${this.escapeHtml(p.name)}
                          ${isCurrent ? '<span class="recent-item__badge">Active</span>' : ''}
                        </div>
                        <div class="recent-item__path" title="${this.escapeHtml(p.path)}">${this.escapeHtml(p.path)}</div>
                      </div>
                      <div class="recent-item__actions">
                        ${
                          p.exists
                            ? isCurrent
                              ? `<div class="recent-item__status-dot" title="Active Project"></div>`
                              : `
                            <button class="recent-item__btn recent-item__btn--open" data-action="select" data-path="${this.escapeHtml(p.path)}" title="Open Vault">
                              ${codicons.signIn}
                            </button>
                          `
                            : ''
                        }
                        ${
                          !isCurrent
                            ? `
                          <button class="recent-item__btn recent-item__btn--delete" data-action="delete" data-path="${this.escapeHtml(p.path)}" title="Remove record">
                              ${codicons.trash}
                          </button>
                        `
                            : ''
                        }
                      </div>
                    </div>
                  `
                        })
                        .join('')
                    : '<div class="recent-empty">No recent projects</div>'
                }
              </div>
            </div>

            <div class="welcome-section">
              <h2>Start</h2>
              <div class="start-actions">
                <button class="start-btn" id="welcome-open">
                  <span class="start-btn__icon">${codicons.folderOpened}</span>
                  <div class="start-btn__content">
                    <div class="start-btn__title">Open Local Folder</div>
                    <div class="start-btn__desc">Open an existing knowledge hub</div>
                  </div>
                </button>
                <button class="start-btn" id="welcome-new">
                  <span class="start-btn__icon">${codicons.folderGit}</span>
                  <div class="start-btn__content">
                    <div class="start-btn__title">Create New Vault</div>
                    <div class="start-btn__desc">Initialize a fresh workspace</div>
                  </div>
                </button>
              </div>


              </div>
            </div>
          </div>
        </div>
      </div>
    `

    this.attachEvents()
  }

  async show(): Promise<void> {
    this.container.style.display = 'block'
    await this.loadRecentVaults()
  }

  private async loadRecentVaults(): Promise<void> {
    try {
      this.recentVaults = await vaultService.getRecentVaults()
      this.render()
    } catch (error) {
      console.error('[WelcomePage] Failed to load recent vaults:', error)
      this.render()
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  hide(): void {
    this.container.style.display = 'none'
  }

  private attachEvents(): void {
    // Recent project action: Select/Switch
    this.container.querySelectorAll('[data-action="select"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const path = (e.currentTarget as HTMLElement).dataset.path
        if (path && this.onProjectSelect) {
          this.onProjectSelect(path)
        }
      })
    })

    // Click on the row itself (if not already current)
    this.container.querySelectorAll('.recent-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        // Only trigger if we didn't click a button
        if ((e.target as HTMLElement).closest('button')) return

        const path = (item as HTMLElement).dataset.path
        const isCurrent = path === state.vaultPath
        if (path && !isCurrent && this.onProjectSelect) {
          this.onProjectSelect(path)
        }
      })
    })

    // Delete handler
    this.container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const path = (e.currentTarget as HTMLElement).dataset.path
        if (!path) return

        modalManager.open({
          title: 'Remove Recent Vault',
          content: `Are you sure you want to remove this vault from your recent list?<br/><br/><code style="font-size: 11px; opacity: 0.7;">${path}</code>`,
          size: 'md',
          buttons: [
            {
              label: 'Remove',
              variant: 'danger',
              onClick: async (m) => {
                m.setLoading(true)
                try {
                  await vaultService.removeRecentVault(path)
                  await this.loadRecentVaults()
                  m.close()
                } catch (error) {
                  m.setLoading(false)
                  console.error('[WelcomePage] Failed to remove recent vault:', error)
                }
              }
            },
            { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() }
          ]
        })
      })
    })

    // Action clicks
    this.container.querySelector('#welcome-open')?.addEventListener('click', () => {
      this.onOpenFolder?.()
    })

    this.container.querySelector('#welcome-new')?.addEventListener('click', () => {
      this.onCreateNew?.()
    })

    // Footer links
    this.container.querySelector('#welcome-docs')?.addEventListener('click', (e) => {
      e.preventDefault()
      this.onOpenDocs?.()
    })

    this.container.querySelector('#welcome-shortcuts')?.addEventListener('click', (e) => {
      e.preventDefault()
      this.onOpenDocs?.()
    })
  }
}
