import './modal.css'

/**
 * Modal configuration interface
 */
export interface ModalConfig {
  title?: string
  content?: string
  customHeader?: HTMLElement
  headerClass?: string
  footerClass?: string
  buttons?: ModalButton[]
  inputs?: ModalInput[]
  size?: 'sm' | 'md' | 'lg' // default: 'md'
  closeOnEscape?: boolean
  closeOnBackdrop?: boolean
  onClose?: () => void
  onSubmit?: (data: Record<string, any>) => void
  customContent?: HTMLElement
}

export interface ModalButton {
  label: string
  variant?: 'primary' | 'danger' | 'ghost'
  onClick: (modal: Modal) => void
}

export interface ModalInput {
  name: string
  type?: 'text' | 'email' | 'password' | 'textarea' | 'number'
  label?: string
  placeholder?: string
  value?: string
  required?: boolean
}

/**
 * Robust, reusable modal component
 */
export class Modal {
  private config: ModalConfig
  private backdrop: HTMLElement | null = null
  private modal: HTMLElement | null = null
  private inputs: Map<string, HTMLInputElement | HTMLTextAreaElement> = new Map()
  private isOpen = false
  private isSubmitting = false
  private handleEscape?: (event: KeyboardEvent) => void
  private handleEnter?: (event: KeyboardEvent) => void

  constructor(config: ModalConfig = {}) {
    this.config = {
      size: 'md',
      closeOnEscape: true,
      closeOnBackdrop: true,
      ...config
    }
  }

  /**
   * Open modal
   */
  open(): void {
    if (this.isOpen) return

    this.render()
    this.attachEvents()
    this.isOpen = true
    this.focusInitial()
  }

  /**
   * Close modal
   */
  close(): void {
    if (!this.isOpen) return

    this.destroy()
    this.config.onClose?.()
    this.isOpen = false
  }

  /**
   * Get input values
   */
  getValues(): Record<string, any> {
    const values: Record<string, any> = {}
    this.inputs.forEach((input, name) => {
      values[name] = input.value
    })
    return values
  }

  /**
   * Set input value
   */
  setValue(name: string, value: string): void {
    const input = this.inputs.get(name)
    if (input) input.value = value
  }

  /**
   * Set submitting state to prevent double actions
   */
  setLoading(loading: boolean): void {
    this.isSubmitting = loading
    const buttons = this.modal?.querySelectorAll('button')
    buttons?.forEach((btn) => {
      if (loading) {
        btn.setAttribute('disabled', 'true')
        btn.style.opacity = '0.7'
        btn.style.pointerEvents = 'none'
      } else {
        btn.removeAttribute('disabled')
        btn.style.opacity = ''
        btn.style.pointerEvents = ''
      }
    })
  }

  /**
   * Get main modal element
   */
  getElement(): HTMLElement | null {
    return this.modal
  }

  /**
   * Find an input element by name
   */
  findInput(name: string): HTMLInputElement | HTMLTextAreaElement | undefined {
    return this.inputs.get(name)
  }

  /**
   * Render modal structure
   */
  private render(): void {
    // Backdrop
    this.backdrop = document.createElement('div')
    this.backdrop.className = 'modal-backdrop'

    // Modal container
    this.modal = document.createElement('div')
    this.modal.className = `modal modal--${this.config.size || 'md'}`
    this.modal.setAttribute('role', 'dialog')
    this.modal.setAttribute('aria-modal', 'true')

    // Header
    if (this.config.customHeader) {
      const headerHost = document.createElement('div')
      headerHost.className = `modal__header ${this.config.headerClass || ''}`
      headerHost.appendChild(this.config.customHeader)
      const closeBtn = document.createElement('button')
      closeBtn.className = 'modal__close'
      closeBtn.setAttribute('aria-label', 'Close modal')
      closeBtn.innerHTML = '&times;'
      headerHost.appendChild(closeBtn)
      this.modal.appendChild(headerHost)
    } else if (this.config.title) {
      const header = document.createElement('div')
      header.className = `modal__header ${this.config.headerClass || ''}`
      header.innerHTML = `
        <h2 class="modal__title">${this.escapeHtml(this.config.title)}</h2>
        <button class="modal__close" aria-label="Close modal">×</button>
      `
      this.modal.appendChild(header)
      const titleEl = header.querySelector('.modal__title') as HTMLElement
      if (titleEl) {
        const titleId = `modal-title-${Date.now()}`
        titleEl.id = titleId
        this.modal.setAttribute('aria-labelledby', titleId)
      }
    }

    // Body
    const body = document.createElement('div')
    body.className = 'modal__body'

    if (this.config.customContent) {
      body.appendChild(this.config.customContent)
    } else if (this.config.content) {
      body.innerHTML = this.escapeHtml(this.config.content)
    }

    // Inputs
    if (this.config.inputs && this.config.inputs.length > 0) {
      const inputContainer = document.createElement('div')
      inputContainer.className = 'modal__inputs'

      this.config.inputs.forEach((inputConfig) => {
        const wrapper = document.createElement('div')
        wrapper.className = 'modal__input-wrapper'

        if (inputConfig.label) {
          const label = document.createElement('label')
          label.className = 'modal__label'
          label.textContent = inputConfig.label
          wrapper.appendChild(label)
        }

        const input = document.createElement(inputConfig.type === 'textarea' ? 'textarea' : 'input')
        input.className = 'modal__input'
        input.setAttribute('name', inputConfig.name)

        if (inputConfig.type && inputConfig.type !== 'textarea') {
          input.setAttribute('type', inputConfig.type)
        }
        if (inputConfig.placeholder) input.setAttribute('placeholder', inputConfig.placeholder)
        if (inputConfig.value) input.value = inputConfig.value
        if (inputConfig.required) input.required = true

        wrapper.appendChild(input)
        inputContainer.appendChild(wrapper)
        this.inputs.set(inputConfig.name, input as HTMLInputElement | HTMLTextAreaElement)
      })

      body.appendChild(inputContainer)
    }

    this.modal.appendChild(body)

    // Footer
    if (this.config.buttons && this.config.buttons.length > 0) {
      const footer = document.createElement('div')
      footer.className = `modal__footer ${this.config.footerClass || ''}`

      this.config.buttons.forEach((btn) => {
        const button = document.createElement('button')
        button.className = `btn btn--${btn.variant || 'primary'}`
        button.textContent = btn.label
        button.addEventListener('click', () => {
          if (this.isSubmitting) return
          btn.onClick(this)
        })
        footer.appendChild(button)
      })

      this.modal.appendChild(footer)
    }

    document.body.appendChild(this.backdrop)
    document.body.appendChild(this.modal)
  }

  private focusInitial(): void {
    const firstInput = this.inputs.values().next().value
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 50)
      return
    }

    // Focus primary action button (e.g., Delete, Save) if no inputs exist
    // Look specifically in the footer to avoid other buttons
    const actionBtn = this.modal?.querySelector(
      '.modal__footer .btn--primary, .modal__footer .btn--danger'
    ) as HTMLElement
    if (actionBtn) {
      setTimeout(() => actionBtn.focus(), 50)
      return
    }

    const closeBtn = this.modal?.querySelector('.modal__close') as HTMLElement
    if (closeBtn) setTimeout(() => closeBtn.focus(), 50)
  }

  /**
   * Attach event listeners
   */
  private attachEvents(): void {
    // Close button
    const closeBtn = this.modal?.querySelector('.modal__close')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close())
    }

    // Escape key
    if (this.config.closeOnEscape) {
      this.handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.close()
        }
      }
      document.addEventListener('keydown', this.handleEscape)
    }

    // Backdrop click
    if (this.config.closeOnBackdrop) {
      this.backdrop?.addEventListener('click', (event) => {
        if (event.target === this.backdrop) {
          this.close()
        }
      })
    }

    // Enter key for submit (first button or custom handler)
    this.handleEnter = (event: KeyboardEvent) => {
      if (this.isSubmitting) return

      const activeTag = (document.activeElement?.tagName || '').toLowerCase()
      const isTextArea = activeTag === 'textarea'
      if (event.key === 'Enter' && !event.shiftKey && !isTextArea) {
        event.preventDefault()
        const firstBtn = this.modal?.querySelector(
          'button.btn--primary, button.btn--danger'
        ) as HTMLButtonElement
        if (firstBtn) {
          firstBtn.click()
        } else if (this.config.onSubmit) {
          this.config.onSubmit(this.getValues())
          this.close()
        }
      }
    }
    document.addEventListener('keydown', this.handleEnter)
  }

  /**
   * Destroy modal
   */
  private destroy(): void {
    if (this.handleEscape) {
      document.removeEventListener('keydown', this.handleEscape)
      this.handleEscape = undefined
    }

    if (this.handleEnter) {
      document.removeEventListener('keydown', this.handleEnter)
      this.handleEnter = undefined
    }

    this.backdrop?.remove()
    this.modal?.remove()
    this.inputs.clear()
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

/**
 * Modal manager for global modal instance
 */
export class ModalManager {
  private currentModal: Modal | null = null

  open(config: ModalConfig): Modal {
    this.close()
    this.currentModal = new Modal(config)
    this.currentModal.open()
    return this.currentModal
  }

  close(): void {
    this.currentModal?.close()
    this.currentModal = null
  }

  getCurrent(): Modal | null {
    return this.currentModal
  }
}

export const modalManager = new ModalManager()
