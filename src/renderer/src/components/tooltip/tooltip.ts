import './tooltip.css'

export class TooltipManager {
  private el: HTMLElement
  private timeout: any = null

  constructor() {
    console.log('[Tooltip] Initializing custom tooltip system...')
    this.el = document.createElement('div')
    this.el.className = 'custom-tooltip'
    if (document.body) {
      document.body.appendChild(this.el)
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(this.el)
      })
    }
    this.attach()
  }

  private attach(): void {
    window.addEventListener('mouseover', (e) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement
      if (target) {
        const text = target.getAttribute('data-tooltip')
        if (text) {
          this.show(text, target)
        }
      }
    })

    window.addEventListener('mouseout', (e) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement
      const related = (e.relatedTarget as HTMLElement)?.closest('[data-tooltip]') as HTMLElement
      if (target && target !== related) {
        this.hide()
      }
    })
  }

  private show(text: string, target: HTMLElement): void {
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      this.el.textContent = text
      this.el.classList.add('is-visible')

      const rect = target.getBoundingClientRect()
      const tooltipRect = this.el.getBoundingClientRect()

      let top = rect.bottom + 6
      let left = rect.left + 20

      // Keep within bounds
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10
      }
      if (top + tooltipRect.height > window.innerHeight - 10) {
        top = rect.top - tooltipRect.height - 6
      }

      this.el.style.top = `${top}px`
      this.el.style.left = `${left}px`
    }, 300)
  }

  private hide(): void {
    clearTimeout(this.timeout)
    this.el.classList.remove('is-visible')
  }
}

export const tooltipManager = new TooltipManager()

// Helper to set tooltip programmatically
export const setTooltip = (el: HTMLElement, text: string): void => {
  el.setAttribute('data-tooltip', text)
}
