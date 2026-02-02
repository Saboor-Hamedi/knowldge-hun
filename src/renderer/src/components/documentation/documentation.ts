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
            <button class="wh-btn wh-close documentation-modal__close" title="Close (Esc)" aria-label="Close">
              <span style="display: inline-block; transform: translateY(-1px);">×</span>
            </button>
          </div>
        </div>
        <div class="documentation-modal__layout">
          <aside class="documentation-modal__sidebar">
            <div class="documentation-modal__sidebar-header">
              <span class="sidebar-title">NAVIGATION</span>
            </div>
            <nav class="documentation-modal__nav">
              <div class="documentation-modal__loading-nav">Loading sections...</div>
            </nav>
          </aside>
          <div class="documentation-modal__body">
            <div class="documentation-modal__inner">
              <div class="documentation-modal__loading">Select a section to begin...</div>
            </div>
          </div>
        </div>
      </div>
    `

    this.modal
      .querySelector('.documentation-modal__close')
      ?.addEventListener('click', () => this.close())

    // Intercept link clicks in the body
    this.modal.querySelector('.documentation-modal__body')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      if (link) {
        const href = link.getAttribute('href')
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          e.preventDefault()
          this.loadSection(href)
        }
      }
    })
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
      if (typeof window.api.getDocumentation !== 'function') {
        throw new Error('Documentation API not initialized')
      }

      // 1. Load the list of sections
      const sections = await window.api.getDocumentation('list')
      this.renderSidebar(sections)

      // 2. Load the default section (introduction)
      await this.loadSection('introduction')
    } catch (e) {
      console.error('Failed to load documentation', e)
      const inner = this.modal.querySelector('.documentation-modal__inner')
      if (inner)
        inner.innerHTML = '<div class="documentation-error">Failed to load documentation.</div>'
    }
  }

  private renderSidebar(sections: string[]): void {
    const nav = this.modal.querySelector('.documentation-modal__nav')
    if (!nav) return

    // Order priority for sidebar items
    const priority = [
      'introduction',
      'architecture',
      'terminal',
      'console',
      'features',
      'shortcuts',
      'best-practices',
      'security',
      'privacy',
      'version-history'
    ]

    const sortedSections = [...sections].sort((a, b) => {
      const ia = priority.indexOf(a)
      const ib = priority.indexOf(b)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b)
    })

    nav.innerHTML = sortedSections
      .map((section) => {
        const label = section
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        return `<div class="documentation-modal__nav-item" data-section="${section}">${label}</div>`
      })
      .join('')

    // Add click listeners
    nav.querySelectorAll('.documentation-modal__nav-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement
        const section = target.getAttribute('data-section')
        if (section) this.loadSection(section)
      })
    })
  }

  private async loadSection(section: string): Promise<void> {
    try {
      const body = this.modal.querySelector('.documentation-modal__body')
      const inner = this.modal.querySelector('.documentation-modal__inner')
      if (inner) inner.innerHTML = '<div class="documentation-modal__loading">Loading...</div>'

      // Update active state in sidebar
      this.modal.querySelectorAll('.documentation-modal__nav-item').forEach((item) => {
        if (item.getAttribute('data-section') === section) {
          item.classList.add('is-active')
        } else {
          item.classList.remove('is-active')
        }
      })

      const content = await window.api.getDocumentation(section)
      if (inner && body) {
        const rawHtml = this.md.render(content)
        inner.innerHTML = DOMPurify.sanitize(rawHtml)
        body.scrollTop = 0
      }
    } catch (e) {
      console.error(`Failed to load section ${section}`, e)
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
