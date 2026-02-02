import { state } from '../../core/state'
import { codicons } from '../../utils/codicons'
import getFileIcon from '../../utils/fileIconMappers'
import { getFolderIcon } from '../../utils/codicons'
import { contextMenu, ContextMenuItem } from '../contextmenu/contextmenu'
import { notificationManager } from '../notification/notification'
import type { TreeItem } from '../../core/types'
import './breadcrumbs.css'

export class Breadcrumbs {
  private container: HTMLElement
  private onNoteOpen?: (id: string) => void
  private onDeleteItem?: (item: { id: string; type: 'note' | 'folder'; path?: string }) => void

  private activeDropdown: HTMLElement | null = null
  private boundCloseDropdown: (e: MouseEvent) => void

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.boundCloseDropdown = this.handleOutsideClick.bind(this)
  }

  setNoteOpenHandler(handler: (id: string) => void): void {
    this.onNoteOpen = handler
  }

  setDeleteItemHandler(
    handler: (item: { id: string; type: 'note' | 'folder'; path?: string }) => void
  ): void {
    this.onDeleteItem = handler
  }

  clear(): void {
    if (this.container) {
      this.container.innerHTML = ''
      this.container.style.display = 'none'
    }
  }

  render(): void {
    if (!this.container) return
    this.container.innerHTML = ''

    const activeId = state.activeId
    if (!activeId || activeId === 'settings' || activeId === 'graph') {
      this.container.style.display = 'none'
      return
    }

    this.container.style.display = 'flex'

    // 1. Root Item
    this.addRootItem()

    // 2. Path Segments
    const parts = activeId.split('/')
    let currentPath = ''

    parts.forEach((part, index) => {
      this.addSeparator()

      const isLast = index === parts.length - 1
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (isLast) {
        this.addItem(part, activeId, 'note', true)
      } else {
        this.addItem(part, currentPath, 'folder', false)
      }
    })

    // Scroll to the end of breadcrumbs
    requestAnimationFrame(() => {
      this.container.scrollLeft = this.container.scrollWidth
    })
  }

  private addRootItem(): void {
    const item = document.createElement('div')
    item.className = 'breadcrumb-item breadcrumb-item--root'

    const icon = document.createElement('span')
    icon.className = 'breadcrumb-item__icon'
    icon.innerHTML = codicons.folderRoot

    const text = document.createElement('span')
    text.className = 'breadcrumb-item__label'
    text.textContent = state.projectName || 'Vault'

    item.appendChild(icon)
    item.appendChild(text)

    // Add dropdown chevron for root
    this.addDropdownChevron(item, '')

    // Make entire item clickable to show dropdown
    item.addEventListener('click', (e) => {
      e.stopPropagation()
      const rect = item.getBoundingClientRect()
      this.showChildrenMenu(rect.left, rect.bottom, '')
    })

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.showContextMenu(e, '', 'folder', state.projectName)
    })

    this.container.appendChild(item)
  }

  private addItem(label: string, id: string, type: 'note' | 'folder', isLast: boolean): void {
    const item = document.createElement('div')
    item.className = 'breadcrumb-item'
    if (isLast) {
      item.classList.add('is-active')
      if (state.isDirty) item.classList.add('is-dirty')
    }

    const icon = document.createElement('span')
    icon.className = 'breadcrumb-item__icon'

    if (type === 'folder') {
      icon.innerHTML = getFolderIcon(label)
    } else {
      const extension = label.split('.').pop() || 'markdown'
      icon.innerHTML = getFileIcon(label, extension)
    }

    const text = document.createElement('span')
    text.className = 'breadcrumb-item__label'
    text.textContent = type === 'note' ? label.replace(/\.md$/i, '') : label

    item.appendChild(icon)
    item.appendChild(text)

    item.addEventListener('click', (e) => {
      e.stopPropagation()

      if (type === 'note') {
        this.onNoteOpen?.(id)
      } else {
        // For folders, show the dropdown menu
        const rect = item.getBoundingClientRect()
        this.showChildrenMenu(rect.left, rect.bottom, id)
      }
    })

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.showContextMenu(e, id, type, label)
    })

    // Add dropdown chevron only if not the last item (the active file)
    // This avoids redundancy and prevents showing the entire root tree for files at the root
    if (!isLast) {
      this.addDropdownChevron(item, id)
    }

    this.container.appendChild(item)
  }

  private addDropdownChevron(parent: HTMLElement, path: string): void {
    const chevron = document.createElement('span')
    chevron.className = 'breadcrumb-item__chevron'
    chevron.innerHTML = codicons.chevronDown

    chevron.addEventListener('click', (e) => {
      e.stopPropagation()
      const rect = chevron.getBoundingClientRect()
      this.showChildrenMenu(rect.left, rect.bottom, path)
    })

    parent.appendChild(chevron)
  }

  private addSeparator(): void {
    const sep = document.createElement('span')
    sep.className = 'breadcrumb-separator'
    sep.innerHTML = codicons.chevronRight
    this.container.appendChild(sep)
  }

  private showContextMenu(e: MouseEvent, id: string, type: 'note' | 'folder', title: string): void {
    const items: ContextMenuItem[] = [
      {
        label: `Copy ${type === 'note' ? 'Link' : 'Path'}`,
        icon: codicons.link,
        onClick: () => {
          navigator.clipboard.writeText(id)
          notificationManager.show('Path copied to clipboard')
        }
      },
      { separator: true },
      {
        label: 'Rename...',
        icon: codicons.edit,
        onClick: () => {
          window.dispatchEvent(
            new CustomEvent('knowledge-hub:rename-item', {
              detail: { id, type, title }
            })
          )
        }
      },
      {
        label: 'Delete',
        icon: codicons.trash,
        danger: true,
        onClick: () => {
          this.onDeleteItem?.({ id, type, path: id })
        }
      },
      { separator: true },
      {
        label: 'Reveal in Explorer',
        icon: codicons.folderOpened,
        onClick: () => {
          window.api.revealVault(id)
        }
      }
    ]

    contextMenu.show(e.clientX, e.clientY, items)
  }

  private showChildrenMenu(x: number, y: number, parentPath: string): void {
    // Close existing dropdown if any
    this.closeDropdown()

    const children = this.getChildren(parentPath)
    if (!children.length) return

    // Create dropdown container
    const dropdown = document.createElement('div')
    dropdown.className = 'breadcrumb-dropdown'
    dropdown.style.left = `${x}px`
    dropdown.style.top = `${y}px`

    // Render items
    this.renderTreeItems(dropdown, children, 0)

    document.body.appendChild(dropdown)
    this.activeDropdown = dropdown

    // Add global click listener to close
    requestAnimationFrame(() => {
      document.addEventListener('click', this.boundCloseDropdown)
      document.addEventListener('contextmenu', this.boundCloseDropdown)
    })
  }

  private renderTreeItems(container: HTMLElement, items: TreeItem[], depth: number): void {
    items.forEach((item) => {
      const itemEl = document.createElement('div')
      itemEl.className = 'breadcrumb-dropdown-item'
      if (item.id === state.activeId) {
        itemEl.classList.add('is-active')
      }
      itemEl.style.paddingLeft = `${depth * 16 + 8}px` // Indentation

      // Arrow for folders
      const arrow = document.createElement('span')
      arrow.className = 'breadcrumb-dropdown-arrow'
      if (item.type === 'folder') {
        arrow.innerHTML = codicons.chevronRight
      }
      itemEl.appendChild(arrow)

      // Icon
      const icon = document.createElement('span')
      icon.className = 'breadcrumb-dropdown-icon'
      icon.innerHTML =
        item.type === 'folder' ? getFolderIcon(item.title) : getFileIcon(item.title, 'markdown')
      itemEl.appendChild(icon)

      // Label
      const label = document.createElement('span')
      label.className = 'breadcrumb-dropdown-label'
      label.textContent = item.title.replace(/\.md$/i, '')
      itemEl.appendChild(label)

      container.appendChild(itemEl)

      // Children container (for folders)
      let childrenContainer: HTMLElement | null = null
      if (item.type === 'folder') {
        childrenContainer = document.createElement('div')
        childrenContainer.className = 'breadcrumb-dropdown-children'
        container.appendChild(childrenContainer)
      }

      // Interaction
      itemEl.addEventListener('click', (e) => {
        e.stopPropagation()

        if (item.type === 'folder') {
          // Toggle expansion
          const isExpanded = arrow.classList.contains('is-expanded')

          if (isExpanded) {
            // Collapse
            arrow.classList.remove('is-expanded')
            if (childrenContainer) {
              childrenContainer.innerHTML = ''
              childrenContainer.classList.remove('is-expanded')
            }
          } else {
            // Expand
            arrow.classList.add('is-expanded')
            if (childrenContainer) {
              const folderChildren = this.getChildren(item.id)
              this.renderTreeItems(childrenContainer, folderChildren, depth + 1)
              childrenContainer.classList.add('is-expanded')
            }
          }
        } else {
          // Open file
          this.onNoteOpen?.(item.id)
          this.closeDropdown()
        }
      })
    })
  }

  private closeDropdown(): void {
    if (this.activeDropdown) {
      this.activeDropdown.remove()
      this.activeDropdown = null
    }
    document.removeEventListener('click', this.boundCloseDropdown)
    document.removeEventListener('contextmenu', this.boundCloseDropdown)
  }

  private handleOutsideClick(e: MouseEvent): void {
    if (this.activeDropdown && !this.activeDropdown.contains(e.target as Node)) {
      this.closeDropdown()
    }
  }

  private getChildren(parentPath: string): TreeItem[] {
    // If no path, return top-level tree items (Root)
    if (!parentPath) {
      return state.tree
        .filter((item): item is TreeItem => item !== undefined)
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
          return a.title.localeCompare(b.title)
        })
    }

    const parent = this.findNodeRecursive(state.tree, parentPath)

    if (!parent || !parent.children) return []

    return parent.children
      .filter((item): item is TreeItem => item !== undefined)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.title.localeCompare(b.title)
      })
  }

  private findNodeRecursive(nodes: TreeItem[], id: string): TreeItem | undefined {
    for (const node of nodes) {
      if (node.id === id) {
        return node
      }
      if (node.children) {
        const found = this.findNodeRecursive(node.children, id)
        if (found) return found
      }
    }
    return undefined
  }
}
