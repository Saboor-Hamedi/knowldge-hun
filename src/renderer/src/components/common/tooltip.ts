export interface TooltipOptions {
  className?: string
  delay?: number
  interactive?: boolean
}

export class RichTooltip {
  private el: HTMLElement
  private visible = false
  private hideTimer: NodeJS.Timeout | null = null
  private currentTarget: HTMLElement | null = null
  private options: TooltipOptions

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

  public show(target: HTMLElement, content: string | HTMLElement): void {
    this.cancelHide()
    this.currentTarget = target

    if (typeof content === 'string') {
      this.el.innerHTML = content
    } else {
      this.el.innerHTML = ''
      this.el.appendChild(content)
    }

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
    }, this.options.delay)
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
    // Default position: above the target
    const x = rect.left
    const y = rect.top

    this.el.style.left = `${x}px`
    this.el.style.bottom = `${window.innerHeight - y + 8}px`

    // Check if it overflows on the right
    const tooltipRect = this.el.getBoundingClientRect()
    if (x + tooltipRect.width > window.innerWidth) {
      this.el.style.left = 'auto'
      this.el.style.right = `${window.innerWidth - rect.right}px`
    }
  }

  public destroy(): void {
    this.cancelHide()
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el)
    }
  }
}
