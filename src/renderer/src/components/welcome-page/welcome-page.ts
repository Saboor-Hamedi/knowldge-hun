import { state } from '../../core/state'
import { codicons } from '../../utils/codicons'
import './welcome-page.css'

export class WelcomePage {
  private container: HTMLElement
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
    const recentProjects = state.recentProjects || []

    this.container.innerHTML = `
      <div class="welcome-container">
        <div class="welcome-content">
          <div class="welcome-header">
            <div class="welcome-logo">
              ${codicons.fileCode}
            </div>
            <h1>Knowledge Hub</h1>
            <p>Your beautiful, connected second brain.</p>
          </div>

          <div class="welcome-sections">
            <div class="welcome-section">
              <h2>Recent Projects</h2>
              <div class="recent-list">
                ${
                  recentProjects.length > 0
                    ? recentProjects
                        .slice(0, 3)
                        .map(
                          (p) => `
                  <div class="recent-item" data-path="${p.path}">
                    <div class="recent-item__icon">
                      ${codicons.folder}
                    </div>
                    <div class="recent-item__info">
                      <div class="recent-item__name">${p.name}</div>
                      <div class="recent-item__path">${p.path}</div>
                    </div>
                  </div>
                `
                        )
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
                  Open Local Folder
                </button>
                <button class="start-btn" id="welcome-new">
                  <span class="start-btn__icon">${codicons.folderGit}</span>
                  Create New Vault
                </button>
              </div>

              <div class="welcome-footer">
                <div class="footer-links">
                  <button class="footer-link" id="welcome-docs">Documentation <span class="footer-link__shortcut" style="font-size: 8px">Ctrl+Shift+\\</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    this.attachEvents()
  }

  show(): void {
    this.container.style.display = 'block'
    this.render() // Re-render to show latest recent projects
  }

  hide(): void {
    this.container.style.display = 'none'
  }

  private attachEvents(): void {
    // Recent project clicks
    this.container.querySelectorAll('.recent-item').forEach((item) => {
      item.addEventListener('click', () => {
        const path = (item as HTMLElement).dataset.path
        if (path && this.onProjectSelect) {
          this.onProjectSelect(path)
        }
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
