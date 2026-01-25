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
      this.indicator.classList.add('ready')
      if (this.spinner) this.spinner.style.display = 'none'
      if (this.check) this.check.style.display = 'block'
      if (this.tooltip) this.tooltip.textContent = message
    }
  }

  public updateProgress(current: number, total: number): void {
    if (!this.indicator) this.init()
    if (this.tooltip) {
      this.tooltip.textContent = `Indexing notes... ${current}/${total}`
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
