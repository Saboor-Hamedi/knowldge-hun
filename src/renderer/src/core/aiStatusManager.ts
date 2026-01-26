/**
 * Global AI Status Manager
 * Controls the AI status indicator in the window header
 */
export class AIStatusManager {
  private indicator: HTMLElement | null = null
  private spinner: SVGElement | null = null
  private check: SVGElement | null = null
  private tooltip: HTMLElement | null = null

  constructor() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init())
    } else {
      this.init()
    }
  }

  private init(): void {
    this.indicator = document.getElementById('ai-status-indicator')
    if (this.indicator) {
      this.spinner = this.indicator.querySelector('.ai-status-spinner')
      this.check = this.indicator.querySelector('.ai-status-check')
      this.tooltip = this.indicator.querySelector('.ai-status-tooltip')
    }
  }

  public show(message: string = 'Initializing AI...'): void {
    if (!this.indicator) this.init()
    if (this.indicator) {
      this.indicator.style.display = 'flex'
      this.indicator.classList.remove('ready')
      if (this.spinner) this.spinner.style.display = 'block'
      if (this.check) this.check.style.display = 'none'
      if (this.tooltip) this.tooltip.textContent = message
    }
  }

  public setReady(message: string = 'AI Ready'): void {
    if (!this.indicator) this.init()
    if (this.indicator) {
      this.indicator.style.display = 'flex'
      this.indicator.classList.add('ready')
      this.indicator.classList.remove('error')
      if (this.spinner) this.spinner.style.display = 'none'
      if (this.check) this.check.style.display = 'block'
      const warningIcon = this.indicator.querySelector('.ai-status-warning') as HTMLElement
      if (warningIcon) warningIcon.style.display = 'none'
      if (this.tooltip) this.tooltip.textContent = message
    }
  }

  public setError(message: string = 'AI Error'): void {
    if (!this.indicator) this.init()
    if (this.indicator) {
      this.indicator.classList.remove('ready')
      this.indicator.classList.add('error')
      if (this.spinner) this.spinner.style.display = 'none'
      if (this.check) this.check.style.display = 'none'

      // Ensure we have a warning icon or similar
      let warningIcon = this.indicator.querySelector('.ai-status-warning') as SVGElement
      if (!warningIcon) {
        const iconContainer = this.indicator.querySelector('.ai-status-icon')
        if (iconContainer) {
          iconContainer.insertAdjacentHTML(
            'beforeend',
            `
            <svg class="ai-status-warning" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          `
          )
          warningIcon = iconContainer.querySelector('.ai-status-warning') as SVGElement
        }
      }

      if (warningIcon) warningIcon.style.display = 'block'
      if (this.tooltip) this.tooltip.textContent = message
    }
  }

  public hide(): void {
    if (!this.indicator) this.init()
    if (this.indicator) {
      this.indicator.style.display = 'none'
    }
  }
}

export const aiStatusManager = new AIStatusManager()

// Make it globally accessible
if (typeof window !== 'undefined') {
  ;(window as any).aiStatusManager = aiStatusManager
}
