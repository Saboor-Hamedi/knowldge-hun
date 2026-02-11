import { CHAT_MODES, ChatMode, aiService } from '../../services/aiService'
import { codicons } from '../../utils/codicons'

export interface ModeSwitcherOptions {
  onModeChange?: (mode: ChatMode) => void
  className?: string
}

/**
 * Shared Mode Switcher Component for AI Capabilities
 */
export class ModeSwitcher {
  private container: HTMLElement
  private triggerEl!: HTMLElement
  private currentMode: ChatMode = 'balanced'
  private options: ModeSwitcherOptions
  private closeHandler: () => void

  constructor(parent: HTMLElement, options: ModeSwitcherOptions = {}) {
    this.container = document.createElement('div')
    this.container.className = `kb-mode-switcher ${options.className || ''}`
    this.options = options
    this.closeHandler = () => this.close()
    parent.appendChild(this.container)

    this.render()
    this.attachEvents()
  }

  private render(): void {
    const activeMode = CHAT_MODES.find((m) => m.id === this.currentMode) || CHAT_MODES[0]

    this.container.innerHTML = `
      <button class="kb-mode-switcher__trigger" type="button" title="Select AI mode">
        <span class="kb-mode-switcher__icon">${activeMode.icon}</span>
        <span class="kb-mode-switcher__label">${activeMode.label}</span>
        <span class="kb-mode-switcher__chevron">${codicons.chevronDownLucide}</span>
      </button>
      <div class="kb-mode-switcher__dropdown">
        ${CHAT_MODES.map(
          (mode) => `
          <button class="kb-mode-switcher__option ${mode.id === this.currentMode ? 'is-active' : ''}" data-mode="${mode.id}">
            <div class="kb-mode-switcher__option-header">
              <span class="kb-mode-switcher__option-icon">${mode.icon}</span>
              <span class="kb-mode-switcher__option-label">${mode.label}</span>
              ${mode.id === this.currentMode ? `<span class="kb-mode-switcher__option-check">${codicons.check || '✓'}</span>` : ''}
            </div>
            <span class="kb-mode-switcher__option-desc">${mode.description}</span>
          </button>
        `
        ).join('')}
      </div>
    `

    this.triggerEl = this.container.querySelector('.kb-mode-switcher__trigger') as HTMLElement
  }

  private attachEvents(): void {
    this.triggerEl.addEventListener('click', (e) => {
      e.stopPropagation()
      this.toggle()
    })

    this.container.querySelectorAll('.kb-mode-switcher__option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation()
        const mode = (opt as HTMLElement).dataset.mode as ChatMode
        this.setMode(mode)
        this.close()
      })
    })

    document.addEventListener('click', this.closeHandler)
  }

  public destroy(): void {
    document.removeEventListener('click', this.closeHandler)
    this.container.remove()
  }

  public setMode(mode: ChatMode): void {
    if (this.currentMode === mode) return
    this.currentMode = mode

    // Update AI service
    aiService.setMode(mode)

    // Update UI
    this.render()
    this.attachEvents() // Re-attach because we replaced innerHTML

    if (this.options.onModeChange) {
      this.options.onModeChange(mode)
    }
  }

  public getMode(): ChatMode {
    return this.currentMode
  }

  public toggle(): void {
    this.container.classList.toggle('is-open')
  }

  public open(): void {
    this.container.classList.add('is-open')
  }

  public close(): void {
    this.container.classList.remove('is-open')
  }
}
