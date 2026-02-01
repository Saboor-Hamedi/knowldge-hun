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

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
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
    icon.innerHTML = codicons.folderRoot // Using correct icon from codicons.ts

    const text = document.createElement('span')
    text.className = 'breadcrumb-item__label'
    text.textContent = state.projectName || 'Vault'

    item.appendChild(icon)
    item.appendChild(text)

    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.breadcrumb-item__chevron')) return
      // Focus root in sidebar
      window.dispatchEvent(new CustomEvent('knowledge-hub:focus-folder', { detail: { path: '' } }))
    })

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.showContextMenu(e, '', 'folder', state.projectName)
    })

    // Add dropdown chevron for root
    this.addDropdownChevron(item, '')

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
      // Don't trigger if clicking the chevron
      if ((e.target as HTMLElement).closest('.breadcrumb-item__chevron')) return

      if (type === 'note') {
        this.onNoteOpen?.(id)
      } else {
        window.dispatchEvent(
          new CustomEvent('knowledge-hub:focus-folder', { detail: { path: id } })
        )
      }
    })

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.showContextMenu(e, id, type, label)
    })

    // Add dropdown chevron
    this.addDropdownChevron(item, id, type)

    this.container.appendChild(item)
  }

  private addDropdownChevron(parent: HTMLElement, path: string, type?: 'note' | 'folder'): void {
    const chevron = document.createElement('span')
    chevron.className = 'breadcrumb-item__chevron'
    chevron.innerHTML = codicons.chevronDown

    chevron.addEventListener('click', (e) => {
      e.stopPropagation()
      const rect = chevron.getBoundingClientRect()
      this.showChildrenMenu(rect.left, rect.bottom, path, type)
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

  private showChildrenMenu(x: number, y: number, path: string, type?: 'note' | 'folder'): void {
    let children: TreeItem[] = []

    if (!path) {
      children = state.tree
    } else {
      const folder = this.findInTree(state.tree, path)
      if (folder && folder.type === 'folder') {
        children = folder.children || []
      } else if (type === 'note') {
        const parentPath = path.split('/').slice(0, -1).join('/')
        if (!parentPath) {
          children = state.tree
        } else {
          const parentFolder = this.findInTree(state.tree, parentPath)
          children = parentFolder?.children || []
        }
      }
    }

    if (children.length === 0) return

    const menuItems: ContextMenuItem[] = children.map((child) => ({
      label: child.title.replace(/\.md$/i, ''),
      icon:
        child.type === 'folder' ? getFolderIcon(child.title) : getFileIcon(child.title, 'markdown'),
      onClick: () => {
        if (child.type === 'note') {
          this.onNoteOpen?.(child.id)
        } else {
          window.dispatchEvent(
            new CustomEvent('knowledge-hub:focus-folder', { detail: { path: child.id } })
          )
        }
      }
    }))

    contextMenu.show(x, y, menuItems)
  }

  private findInTree(items: TreeItem[], path: string): TreeItem | null {
    for (const item of items) {
      if (item.id === path) return item
      if (item.children) {
        const found = this.findInTree(item.children, path)
        if (found) return found
      }
    }
    return null
  }
}
