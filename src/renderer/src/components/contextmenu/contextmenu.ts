import './contextmenu.css'

export interface ContextMenuItem {
  label?: string
  icon?: string
  keybinding?: string
  separator?: boolean
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  submenu?: ContextMenuItem[]
}

export class ContextMenu {
  private menu: HTMLElement | null = null
  private submenu: HTMLElement | null = null
  private isOpen = false
  private focusedIndex = -1
  private items: ContextMenuItem[] = []
  private menuItems: HTMLElement[] = []

  show(x: number, y: number, items: ContextMenuItem[]): void {
    this.close()
    this.items = items
    this.focusedIndex = -1
    this.menuItems = []

    this.menu = document.createElement('div')
    this.menu.className = 'context-menu'
    this.menu.setAttribute('role', 'menu')
    this.menu.setAttribute('tabindex', '-1')

    items.forEach((item, index) => {
      if (item.separator) {
        const separator = document.createElement('div')
        separator.className = 'context-menu__separator'
        separator.setAttribute('role', 'separator')
        this.menu!.appendChild(separator)
        return
      }

      const menuItem = this.createMenuItem(item, index)
      this.menu!.appendChild(menuItem)
      this.menuItems.push(menuItem)
    })

    document.body.appendChild(this.menu)
    this.isOpen = true

    // Position the menu
    this.positionMenu(this.menu, x, y)

    // Focus the menu for keyboard navigation
    this.menu.focus()

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick)
      document.addEventListener('contextmenu', this.handleOutsideClick)
      document.addEventListener('keydown', this.handleKeyDown)
      window.addEventListener('blur', this.handleWindowBlur)
      window.addEventListener('resize', this.handleResize)
    }, 0)
  }

  private createMenuItem(item: ContextMenuItem, index: number): HTMLElement {
    const menuItem = document.createElement('div')
    menuItem.className = 'context-menu__item'
    menuItem.setAttribute('role', 'menuitem')
    menuItem.setAttribute('data-index', String(index))

    if (item.disabled) {
      menuItem.classList.add('is-disabled')
      menuItem.setAttribute('aria-disabled', 'true')
    }

    if (item.danger) {
      menuItem.classList.add('is-danger')
    }

    if (item.submenu && item.submenu.length > 0) {
      menuItem.classList.add('has-submenu')
    }

    if (item.icon) {
      const icon = document.createElement('span')
      icon.className = 'context-menu__icon'
      icon.innerHTML = item.icon
      menuItem.appendChild(icon)
    } else {
      // Add empty icon space for alignment
      const iconSpace = document.createElement('span')
      iconSpace.className = 'context-menu__icon-space'
      menuItem.appendChild(iconSpace)
    }

    const label = document.createElement('span')
    label.className = 'context-menu__label'
    label.textContent = item.label || ''
    menuItem.appendChild(label)

    if (item.keybinding) {
      const kb = document.createElement('span')
      kb.className = 'context-menu__keybinding'
      kb.textContent = item.keybinding
      menuItem.appendChild(kb)
    }

    if (item.submenu && item.submenu.length > 0) {
      const arrow = document.createElement('span')
      arrow.className = 'context-menu__arrow'
      arrow.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`
      menuItem.appendChild(arrow)
    }

    if (!item.disabled) {
      if (item.submenu && item.submenu.length > 0) {
        menuItem.addEventListener('mouseenter', () => this.showSubmenu(menuItem, item.submenu!))
        menuItem.addEventListener('mouseleave', (e) => {
          const relatedTarget = e.relatedTarget as HTMLElement
          if (!relatedTarget?.closest('.context-menu--submenu')) {
            this.closeSubmenu()
          }
        })
      } else if (item.onClick) {
        menuItem.addEventListener('click', () => {
          item.onClick?.()
          this.close()
        })
      }
    }

    menuItem.addEventListener('mouseenter', () => {
      // Clear all keyboard focus when mouse enters - let CSS :hover handle it
      this.clearFocus()
      if (!item.submenu) {
        this.closeSubmenu()
      }
    })

    return menuItem
  }

  private showSubmenu(parentItem: HTMLElement, items: ContextMenuItem[]): void {
    this.closeSubmenu()

    this.submenu = document.createElement('div')
    this.submenu.className = 'context-menu context-menu--submenu'
    this.submenu.setAttribute('role', 'menu')

    items.forEach((item) => {
      if (item.separator) {
        const separator = document.createElement('div')
        separator.className = 'context-menu__separator'
        this.submenu!.appendChild(separator)
        return
      }

      const menuItem = document.createElement('div')
      menuItem.className = 'context-menu__item'
      if (item.disabled) menuItem.classList.add('is-disabled')
      if (item.danger) menuItem.classList.add('is-danger')

      if (item.icon) {
        const icon = document.createElement('span')
        icon.className = 'context-menu__icon'
        icon.innerHTML = item.icon
        menuItem.appendChild(icon)
      } else {
        const iconSpace = document.createElement('span')
        iconSpace.className = 'context-menu__icon-space'
        menuItem.appendChild(iconSpace)
      }

      const label = document.createElement('span')
      label.className = 'context-menu__label'
      label.textContent = item.label || ''
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

      this.submenu!.appendChild(menuItem)
    })

    document.body.appendChild(this.submenu)

    // Position submenu relative to parent item
    const parentRect = parentItem.getBoundingClientRect()
    const menuRect = this.menu!.getBoundingClientRect()

    // Try to position to the right first
    let left = menuRect.right - 4
    let top = parentRect.top - 4

    this.submenu.style.left = `${left}px`
    this.submenu.style.top = `${top}px`

    // Check if submenu goes offscreen and flip if needed
    const submenuRect = this.submenu.getBoundingClientRect()

    if (submenuRect.right > window.innerWidth - 8) {
      // Flip to left side
      left = menuRect.left - submenuRect.width + 4
      this.submenu.style.left = `${left}px`
    }

    if (submenuRect.bottom > window.innerHeight - 8) {
      top = window.innerHeight - submenuRect.height - 8
      this.submenu.style.top = `${top}px`
    }

    // Keep submenu open when hovering over it
    this.submenu.addEventListener('mouseleave', (e) => {
      const relatedTarget = e.relatedTarget as HTMLElement
      if (!relatedTarget?.closest('.context-menu__item.has-submenu')) {
        this.closeSubmenu()
      }
    })
  }

  private closeSubmenu(): void {
    this.submenu?.remove()
    this.submenu = null
  }

  private positionMenu(menu: HTMLElement, x: number, y: number): void {
    // Set initial position
    menu.style.left = `${x}px`
    menu.style.top = `${y}px`

    // Get menu dimensions
    const rect = menu.getBoundingClientRect()

    // Get safe area (accounting for statusbar ~22px at bottom)
    const statusbarHeight = 22
    const padding = 8
    const maxX = window.innerWidth - padding
    const maxY = window.innerHeight - statusbarHeight - padding

    // Adjust horizontal position
    if (rect.right > maxX) {
      const newX = Math.max(padding, maxX - rect.width)
      menu.style.left = `${newX}px`
    }

    // Adjust vertical position
    if (rect.bottom > maxY) {
      // Try positioning above the click point first
      const newY = y - rect.height
      if (newY >= padding) {
        menu.style.top = `${newY}px`
      } else {
        // If that doesn't work, position at max visible area
        menu.style.top = `${Math.max(padding, maxY - rect.height)}px`
      }
    }

    // Final check - ensure menu is within viewport
    const finalRect = menu.getBoundingClientRect()
    if (finalRect.top < padding) {
      menu.style.top = `${padding}px`
    }
    if (finalRect.left < padding) {
      menu.style.left = `${padding}px`
    }

    // If menu is too tall, enable scrolling
    if (rect.height > maxY - padding) {
      menu.style.maxHeight = `${maxY - padding}px`
      menu.style.overflowY = 'auto'
    }
  }

  private clearFocus(): void {
    this.menuItems.forEach((item) => item.classList.remove('is-focused'))
    this.focusedIndex = -1
  }

  private setFocusedItem(index: number): void {
    // Remove previous focus
    this.clearFocus()

    if (index >= 0 && index < this.menuItems.length) {
      this.focusedIndex = index
      this.menuItems[index].classList.add('is-focused')
      this.menuItems[index].scrollIntoView({ block: 'nearest' })
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.isOpen) return

    const nonSeparatorIndices = this.items
      .map((item, i) => (!item.separator ? i : -1))
      .filter((i) => i !== -1)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        {
          const currentIdx = nonSeparatorIndices.indexOf(this.focusedIndex)
          const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % nonSeparatorIndices.length
          this.setFocusedItem(nonSeparatorIndices[nextIdx])
        }
        break

      case 'ArrowUp':
        e.preventDefault()
        {
          const currentIdx = nonSeparatorIndices.indexOf(this.focusedIndex)
          const prevIdx = currentIdx <= 0 ? nonSeparatorIndices.length - 1 : currentIdx - 1
          this.setFocusedItem(nonSeparatorIndices[prevIdx])
        }
        break

      case 'Enter':
      case ' ':
        e.preventDefault()
        if (this.focusedIndex >= 0) {
          const item = this.items[this.focusedIndex]
          if (item && !item.disabled && !item.separator && item.onClick) {
            item.onClick()
            this.close()
          }
        }
        break

      case 'Escape':
        e.preventDefault()
        this.close()
        break

      case 'ArrowRight':
        e.preventDefault()
        if (this.focusedIndex >= 0) {
          const item = this.items[this.focusedIndex]
          if (item?.submenu) {
            const menuItem = this.menuItems.find(
              (el) => el.dataset.index === String(this.focusedIndex)
            )
            if (menuItem) {
              this.showSubmenu(menuItem, item.submenu)
            }
          }
        }
        break

      case 'ArrowLeft':
        e.preventDefault()
        this.closeSubmenu()
        break
    }
  }

  private handleWindowBlur = (): void => {
    this.close()
  }

  private handleResize = (): void => {
    this.close()
  }

  close(): void {
    if (!this.isOpen) return

    this.closeSubmenu()
    this.menu?.remove()
    this.menu = null
    this.isOpen = false
    this.focusedIndex = -1
    this.menuItems = []
    this.items = []

    document.removeEventListener('click', this.handleOutsideClick)
    document.removeEventListener('contextmenu', this.handleOutsideClick)
    document.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('blur', this.handleWindowBlur)
    window.removeEventListener('resize', this.handleResize)
  }

  private handleOutsideClick = (e: Event): void => {
    const target = e.target as HTMLElement
    if (!target.closest('.context-menu')) {
      this.close()
    }
  }
}

export const contextMenu = new ContextMenu()
