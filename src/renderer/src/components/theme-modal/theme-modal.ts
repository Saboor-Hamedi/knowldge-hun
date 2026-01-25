import { state } from '../../core/state'
import { themes } from '../../core/themes'
import { themeManager } from '../../core/themeManager'
import { codicons } from '../../utils/codicons'
import './theme-modal.css'

export class ThemeModal {
  private container: HTMLElement
  private modal: HTMLElement | null = null
  private isOpen = false
  private backdrop: HTMLElement | null = null
  private onThemeChange?: (themeId: string) => void

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
    this.attachInternalListeners()
  }

  private attachInternalListeners(): void {
    window.addEventListener('toggle-theme-modal', () => this.toggle())
    window.addEventListener('close-theme-modal', () => this.close())
  }

  setThemeChangeHandler(handler: (themeId: string) => void): void {
    this.onThemeChange = handler
  }

  toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  open(): void {
    if (this.isOpen || !this.modal) return
    this.isOpen = true
    this.modal.classList.add('is-open')
    this.renderList()

    // Create invisible backdrop to close on click outside
    this.backdrop = document.createElement('div')
    this.backdrop.className = 'theme-modal-backdrop'
    this.container.appendChild(this.backdrop)

    this.backdrop.addEventListener('click', () => this.close())
    document.addEventListener('keydown', this.handleKeyDown)
  }

  close(): void {
    if (!this.isOpen || !this.modal) return
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
      this.close()
    }
  }

  private render(): void {
    this.modal = document.createElement('div')
    this.modal.className = 'theme-modal'
    this.modal.innerHTML = `
      <div class="theme-modal__header">
        <div class="theme-modal__title-group">
          <h3 class="theme-modal__title">Themes</h3>
        </div>
        <div class="theme-modal__actions">
          <button class="theme-modal__close wh-btn">${codicons.close}</button>
        </div>
      </div>
      <div class="theme-modal__list"></div>
    `
    this.container.appendChild(this.modal)

    // Events
    this.modal.querySelector('.theme-modal__close')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.close()
    })
  }

  private renderList(): void {
    const list = this.modal?.querySelector('.theme-modal__list')
    if (!list) return

    const currentId = themeManager.getCurrentThemeId()

    list.innerHTML = Object.values(themes)
      .map((theme) => {
        const isActive = theme.id === currentId ? 'is-active' : ''
        const bg = theme.colors['--bg']
        const primary = theme.colors['--primary']

        return `
        <div class="theme-item ${isActive}" data-id="${theme.id}">
          <div class="theme-preview">
            <div class="theme-preview__c1" style="background: ${bg}"></div>
            <div class="theme-preview__c2" style="background: ${primary}"></div>
          </div>
          <div class="theme-info">
            <div class="theme-name">${theme.name}</div>
          </div>
          ${isActive ? `<div class="theme-check">${codicons.check || '✓'}</div>` : ''}
        </div>
      `
      })
      .join('')

    // Attach click handlers
    list.querySelectorAll('.theme-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const id = (item as HTMLElement).dataset.id
        if (id) {
          this.applyTheme(id)
        }
      })
    })
  }

  private async applyTheme(id: string): Promise<void> {
    // 1. Apply theme immediately
    themeManager.setTheme(id)
    this.onThemeChange?.(id)

    // 2. Update toggle state
    if (state.settings) {
      state.settings.theme = id
    }

    // 3. Render list to show checkmark
    this.renderList()

    // 4. Persist
    try {
      await window.api.updateSettings({ theme: id })
    } catch (e) {
      console.error('Failed to save theme', e)
    }
  }
}
