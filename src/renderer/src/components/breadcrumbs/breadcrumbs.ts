import { state } from '../../core/state'
import { codicons } from '../../utils/codicons'
import getFileIcon from '../../utils/fileIconMappers'
import { getFolderIcon } from '../../utils/codicons'
import './breadcrumbs.css'

export class Breadcrumbs {
  private container: HTMLElement
  private onNoteOpen?: (id: string) => void

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
  }

  setNoteOpenHandler(handler: (id: string) => void): void {
    this.onNoteOpen = handler
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
    if (!activeId || activeId === 'settings') {
      this.container.style.display = 'none'
      return
    }

    this.container.style.display = 'flex'

    // Get the path components
    // activeId is the full relative path including extension
    const parts = activeId.split('/')
    let currentPath = ''

    parts.forEach((part, index) => {
      if (index > 0) {
        this.addSeparator()
      }

      const isLast = index === parts.length - 1
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (isLast) {
        // It's a note
        this.addItem(part, activeId, 'note')
      } else {
        // It's a folder
        this.addItem(part, currentPath, 'folder')
      }
    })
  }

  private addItem(label: string, id: string, type: 'note' | 'folder'): void {
    const item = document.createElement('div')
    item.className = 'breadcrumb-item'
    if (id === state.activeId) item.classList.add('is-active')

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

    item.addEventListener('click', () => {
      if (type === 'note') {
        this.onNoteOpen?.(id)
      } else {
        // For folders, maybe toggle in sidebar?
        // For now, just focus it in the sidebar
        const event = new CustomEvent('knowledge-hub:focus-folder', { detail: { path: id } })
        window.dispatchEvent(event)
      }
    })

    this.container.appendChild(item)
  }

  private addSeparator(): void {
    const sep = document.createElement('span')
    sep.className = 'breadcrumb-separator'
    sep.innerHTML = codicons.chevronRight
    this.container.appendChild(sep)
  }
}
