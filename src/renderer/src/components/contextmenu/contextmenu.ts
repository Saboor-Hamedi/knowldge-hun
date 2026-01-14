import './contextmenu.css'

export interface ContextMenuItem {
  label?: string
  icon?: string
  keybinding?: string
  separator?: boolean
  onClick?: () => void
  disabled?: boolean
}

export class ContextMenu {
  private menu: HTMLElement | null = null
  private isOpen = false

  show(x: number, y: number, items: ContextMenuItem[]): void {
    this.close()
    
    this.menu = document.createElement('div')
    this.menu.className = 'context-menu'
    this.menu.style.left = `${x}px`
    this.menu.style.top = `${y}px`

    items.forEach((item) => {
      if (item.separator) {
        const separator = document.createElement('div')
        separator.className = 'context-menu__separator'
        this.menu!.appendChild(separator)
        return
      }

      const menuItem = document.createElement('div')
      menuItem.className = `context-menu__item${item.disabled ? ' is-disabled' : ''}`
      
      if (item.icon) {
        const icon = document.createElement('span')
        icon.className = 'context-menu__icon'
        icon.innerHTML = item.icon
        menuItem.appendChild(icon)
      }

      const label = document.createElement('span')
      label.className = 'context-menu__label'
      label.textContent = item.label || null
      menuItem.appendChild(label)

      if (item.keybinding) {
        const kb = document.createElement('span')
        kb.className = 'context-menu__keybinding'
        kb.textContent = item.keybinding
        menuItem.appendChild(kb)
      }

      if (!item.disabled && item.onClick) {
        menuItem.addEventListener('click', () => {
          item.onClick?.()
          this.close()
        })
      }

      this.menu!.appendChild(menuItem)
    })

    document.body.appendChild(this.menu)
    this.isOpen = true

    // Adjust position if menu goes offscreen
    const rect = this.menu.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      this.menu.style.left = `${window.innerWidth - rect.width - 5}px`
    }
    if (rect.bottom > window.innerHeight) {
      this.menu.style.top = `${window.innerHeight - rect.height - 5}px`
    }

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick)
      document.addEventListener('contextmenu', this.handleOutsideClick)
    }, 0)
  }

  close(): void {
    if (!this.isOpen) return
    
    this.menu?.remove()
    this.menu = null
    this.isOpen = false
    
    document.removeEventListener('click', this.handleOutsideClick)
    document.removeEventListener('contextmenu', this.handleOutsideClick)
  }

  private handleOutsideClick = (): void => {
    this.close()
  }
}

export const contextMenu = new ContextMenu()
