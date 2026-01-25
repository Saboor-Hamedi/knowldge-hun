import { createElement, MoreVertical } from 'lucide'
import './ai-menu.css'

export interface AIMenuItem {
  separator?: true
  id?: string
  label?: string
  icon?: any
  onClick?: () => void
  disabled?: boolean
  shortcut?: string
}

export class AIMenu {
  private container: HTMLElement
  private buttonElement!: HTMLElement
  private menuElement!: HTMLElement
  private isOpen = false
  private items: AIMenuItem[] = []
  private onItemClick?: (itemId: string) => void

  constructor(container: HTMLElement | string) {
    if (typeof container === 'string') {
      this.container = document.getElementById(container) as HTMLElement
    } else {
      this.container = container
    }
  }

  setItems(items: AIMenuItem[]): void {
    this.items = items
    this.renderMenu()
  }

  setOnItemClick(callback: (itemId: string) => void): void {
    this.onItemClick = callback
  }

  render(buttonId: string): void {
    const button = this.container.querySelector(`#${buttonId}`) as HTMLElement
    if (!button) {
      console.error(`[AIMenu] Button #${buttonId} not found`)
      return
    }

    this.buttonElement = button
    this.buttonElement.innerHTML = this.createLucideIcon(MoreVertical, 14, 1.5)
    this.buttonElement.classList.add('rightbar__ai-menu-button')

    // Create menu element - append to header actions for proper positioning
    const headerActions = this.buttonElement.closest('.rightbar__header-actions')
    if (headerActions) {
      const menuHTML = `<div class="rightbar__ai-menu" id="rightbar-ai-menu"></div>`
      headerActions.insertAdjacentHTML('beforeend', menuHTML)
      this.menuElement = headerActions.querySelector('#rightbar-ai-menu') as HTMLElement
    } else {
      // Fallback: append to container
      const menuHTML = `<div class="rightbar__ai-menu" id="rightbar-ai-menu"></div>`
      this.container.insertAdjacentHTML('beforeend', menuHTML)
      this.menuElement = this.container.querySelector('#rightbar-ai-menu') as HTMLElement
    }

    this.attachEvents()
    this.renderMenu()
  }

  private renderMenu(): void {
    if (!this.menuElement) return

    if (this.items.length === 0) {
      this.menuElement.innerHTML = ''
      return
    }

    const menuItemsHTML = this.items
      .map((item) => {
        if (item.separator) {
          return '<div class="rightbar__ai-menu-separator"></div>'
        }

        const iconHTML = this.createLucideIcon(item.icon, 14, 1.5)
        const shortcutHTML = item.shortcut
          ? `<span class="rightbar__ai-menu-shortcut">${item.shortcut}</span>`
          : ''

        return `
        <button 
          class="rightbar__ai-menu-item ${item.disabled ? 'rightbar__ai-menu-item--disabled' : ''}" 
          data-item-id="${item.id}"
          ${item.disabled ? 'disabled' : ''}
        >
          <span class="rightbar__ai-menu-icon">${iconHTML}</span>
          <span class="rightbar__ai-menu-label">${this.escapeHtml(item.label || '')}</span>
          ${shortcutHTML}
        </button>
      `
      })
      .join('')

    this.menuElement.innerHTML = menuItemsHTML
    this.attachMenuEvents()
  }

  private attachEvents(): void {
    if (!this.buttonElement) return

    this.buttonElement.addEventListener('click', (e) => {
      e.stopPropagation()
      this.toggle()
    })

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (
        this.isOpen &&
        !this.menuElement.contains(e.target as Node) &&
        !this.buttonElement.contains(e.target as Node)
      ) {
        this.close()
      }
    })

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close()
        this.buttonElement.focus()
      }
    })
  }

  private attachMenuEvents(): void {
    if (!this.menuElement) return

    this.menuElement.querySelectorAll('.rightbar__ai-menu-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation()
        const itemId = (item as HTMLElement).dataset.itemId
        if (itemId && !item.classList.contains('rightbar__ai-menu-item--disabled')) {
          if (this.onItemClick) {
            this.onItemClick(itemId)
          }
          this.close()
        }
      })
    })

    // Keyboard navigation
    this.menuElement.addEventListener('keydown', (e) => {
      const items = Array.from(
        this.menuElement.querySelectorAll(
          '.rightbar__ai-menu-item:not(.rightbar__ai-menu-item--disabled)'
        )
      ) as HTMLElement[]
      const currentIndex = items.findIndex((item) => item === document.activeElement)

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
        items[nextIndex]?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
        items[prevIndex]?.focus()
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const activeItem = document.activeElement as HTMLElement
        if (activeItem && activeItem.dataset.itemId) {
          if (this.onItemClick) {
            this.onItemClick(activeItem.dataset.itemId)
          }
          this.close()
        }
      }
    })
  }

  toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  open(): void {
    if (!this.menuElement || this.items.length === 0) return

    this.isOpen = true
    this.menuElement.classList.add('rightbar__ai-menu--open')
    this.buttonElement.classList.add('rightbar__ai-menu-button--active')

    // Focus first item for keyboard navigation
    const firstItem = this.menuElement.querySelector(
      '.rightbar__ai-menu-item:not(.rightbar__ai-menu-item--disabled)'
    ) as HTMLElement
    if (firstItem) {
      setTimeout(() => firstItem.focus(), 0)
    }
  }

  close(): void {
    if (!this.menuElement) return

    this.isOpen = false
    this.menuElement.classList.remove('rightbar__ai-menu--open')
    this.buttonElement.classList.remove('rightbar__ai-menu-button--active')
  }

  private createLucideIcon(
    IconComponent: any,
    size: number = 14,
    strokeWidth: number = 1.5,
    color?: string
  ): string {
    const svgElement = createElement(IconComponent, {
      size: size,
      'stroke-width': strokeWidth,
      stroke: color || 'currentColor',
      color: color || 'currentColor'
    })
    if (svgElement && svgElement.outerHTML) {
      return svgElement.outerHTML
    }
    return ''
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
