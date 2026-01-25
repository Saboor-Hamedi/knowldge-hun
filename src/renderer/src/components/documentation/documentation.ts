import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import './documentation.css'
import '../window-header/window-header.css'

export class DocumentationModal {
  private container: HTMLElement
  private modal: HTMLElement
  private isOpen = false
  private backdrop: HTMLElement | null = null
  private md: MarkdownIt

  constructor(containerId: string = 'app') {
    this.container = document.getElementById(containerId) || document.body
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    })

    this.modal = document.createElement('div')
    this.modal.className = 'documentation-modal'
    this.renderBase()
    this.container.appendChild(this.modal)
  }

  private renderBase(): void {
    this.modal.innerHTML = `
      <div class="documentation-modal__content">
        <div class="window-header" style="flex-shrink: 0;">
          <div class="window-header__brand">
            <span class="window-header__title">KnowledgeHub Documentation</span>
          </div>
          <div class="window-header__controls">
            <button class="wh-btn wh-close documentation-modal__close" title="Close (Esc)" aria-label="Close">×</button>
          </div>
        </div>
        <div class="documentation-modal__body">
          <div class="documentation-modal__loading">Loading Documentation...</div>
        </div>
      </div>
    `
    this.modal
      .querySelector('.documentation-modal__close')
      ?.addEventListener('click', () => this.close())
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  public async open(): Promise<void> {
    if (this.isOpen) return
    this.isOpen = true
    this.modal.classList.add('is-open')

    this.backdrop = document.createElement('div')
    this.backdrop.className = 'documentation-modal-backdrop'
    this.container.appendChild(this.backdrop)

    this.backdrop.addEventListener('click', () => this.close())
    document.addEventListener('keydown', this.handleKeyDown)

    await this.loadContent()
  }

  private async loadContent(): Promise<void> {
    try {
      // Safety check if API method exists
      if (typeof window.api.getDocumentation !== 'function') {
        console.error('[Documentation] getDocumentation is not a function. Preload might be stale.')
        const body = this.modal.querySelector('.documentation-modal__body')
        if (body) {
          body.innerHTML = `
            <div class="documentation-error">
              <h3>Configuration Error</h3>
              <p>The documentation API is not properly initialized.</p>
              <p>Please try <strong>restarting the application</strong> if this persists after a refresh.</p>
            </div>`
        }
        return
      }

      const content = await window.api.getDocumentation()
      const body = this.modal.querySelector('.documentation-modal__body')
      if (body) {
        const rawHtml = this.md.render(content)
        body.innerHTML = DOMPurify.sanitize(rawHtml)
      }
    } catch (e) {
      console.error('Failed to load documentation', e)
      const body = this.modal.querySelector('.documentation-modal__body')
      if (body)
        body.innerHTML = '<div class="documentation-error">Failed to load documentation.</div>'
    }
  }

  public close(): void {
    if (!this.isOpen) return
    this.isOpen = false
    this.modal.classList.remove('is-open')
    if (this.backdrop) {
      this.backdrop.remove()
      this.backdrop = null
    }
    document.removeEventListener('keydown', this.handleKeyDown)
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.close()
    }
  }
}
