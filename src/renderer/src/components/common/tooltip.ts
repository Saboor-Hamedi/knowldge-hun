export interface TooltipOptions {
  className?: string
  delay?: number
  interactive?: boolean
}

export class RichTooltip {
  private el: HTMLElement
  private visible = false
  private hideTimer: ReturnType<typeof setTimeout> | null = null
  private currentTarget: HTMLElement | null = null
  public options: TooltipOptions

  constructor(options: TooltipOptions = {}) {
    this.options = {
      delay: 100,
      interactive: true,
      ...options
    }

    this.el = document.createElement('div')
    this.el.className = `rich-tooltip ${this.options.className || ''}`
    document.body.appendChild(this.el)

    if (this.options.interactive) {
      this.el.addEventListener('mouseenter', () => this.cancelHide())
      this.el.addEventListener('mouseleave', () => this.hide())
    }
  }

  public setCompact(compact: boolean): void {
    if (compact) this.el.classList.add('is-compact')
    else this.el.classList.remove('is-compact')
  }

  public setInteractive(interactive: boolean): void {
    this.options.interactive = interactive
  }

  public show(target: HTMLElement, content: string | HTMLElement): void {
    // If we are moving between items, reset immediately to prevent stretching
    if (this.currentTarget && this.currentTarget !== target) {
      this.hideImmediately()
    }

    this.cancelHide()
    this.currentTarget = target

    if (typeof content === 'string') {
      this.el.innerHTML = content
    } else {
      this.el.innerHTML = ''
      this.el.appendChild(content)
    }

    // Force reflow/reset before positioning
    this.el.classList.remove('is-discrete')

    const rect = target.getBoundingClientRect()
    this.position(rect)

    this.el.classList.add('is-visible')
    this.visible = true
  }

  public hide(): void {
    if (this.hideTimer) return

    this.hideTimer = setTimeout(() => {
      this.el.classList.remove('is-visible')
      this.visible = false
      this.hideTimer = null
      this.currentTarget = null
    }, this.options.delay)
  }

  private hideImmediately(): void {
    this.cancelHide()
    this.el.classList.add('is-discrete')
    this.el.classList.remove('is-visible')
    this.visible = false
    this.currentTarget = null
  }

  public update(content: string | HTMLElement): void {
    if (!this.visible) return

    if (typeof content === 'string') {
      this.el.innerHTML = content
    } else {
      this.el.innerHTML = ''
      this.el.appendChild(content)
    }
  }

  private cancelHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    }
  }

  private position(rect: DOMRect): void {
    // Position the tooltip centered above the target
    const x = rect.left + rect.width / 2
    const y = rect.top

    // Set initial position
    let finalX = x
    const activityBarWidth = 60 // Safe zone for activity bar
    const halfWidth = this.el.offsetWidth / 2

    // Shift right if it overlaps the activity bar area
    if (finalX - halfWidth < activityBarWidth) {
      finalX = activityBarWidth + halfWidth
    }

    this.el.style.left = `${finalX}px`
    this.el.style.bottom = `${window.innerHeight - y + 8}px`
    this.el.style.right = 'auto'

    // Calculate real dimensions
    const tooltipRect = this.el.getBoundingClientRect()

    // Align center
    const left = x - tooltipRect.width / 2

    // Bound checks
    const minLeft = 10
    const maxLeft = window.innerWidth - tooltipRect.width - 10
    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, left))

    this.el.style.left = `${clampedLeft}px`
    this.el.style.bottom = `${window.innerHeight - y + 8}px`

    // Update arrow offset
    const arrowOffset = x - clampedLeft
    this.el.style.setProperty('--tooltip-arrow-offset', `${arrowOffset}px`)
  }

  public destroy(): void {
    this.cancelHide()
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el)
    }
  }
}
