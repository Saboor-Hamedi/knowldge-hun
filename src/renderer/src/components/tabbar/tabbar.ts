import { state } from '../../core/state'
import { getFileIcon, codicons } from '../../utils/codicons'
import './tabbar.css'

export class TabBar {
  private container: HTMLElement
  private onTabSelect?: (id: string) => void
  private onTabClose?: (id: string) => void
  private onTabContextMenu?: (id: string, event: MouseEvent) => void

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.attachEvents()
  }

  setTabSelectHandler(handler: (id: string) => void): void {
    this.onTabSelect = handler
  }

  setTabCloseHandler(handler: (id: string) => void): void {
    this.onTabClose = handler
  }

  setTabContextMenuHandler(handler: (id: string, event: MouseEvent) => void): void {
    this.onTabContextMenu = handler
  }

  render(): void {
    this.container.innerHTML = ''
    if (state.openTabs.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'tabbar__empty'
      empty.textContent = 'No open editors'
      this.container.appendChild(empty)
      return
    }

    state.openTabs.forEach((tab) => {
      const isPinned = state.pinnedTabs.has(tab.id)
      const ext = tab.title.split('.').pop()?.toLowerCase() || 'txt'
      
      const button = document.createElement('button')
      button.className = `tab${tab.id === state.activeId ? ' is-active' : ''}${isPinned ? ' is-pinned' : ''}`
      button.dataset.id = tab.id
      button.dataset.ext = ext
      
      const dirtyPrefix = state.isDirty && tab.id === state.activeId ? '● ' : ''
      if (isPinned) button.title = `${tab.title} (Pinned)`

      const icon = document.createElement('span')
      icon.className = 'tab__icon'
      icon.innerHTML = getFileIcon(tab.title)

      const label = document.createElement('span')
      label.className = 'tab__label'
      label.textContent = `${dirtyPrefix}${tab.title}`

      button.appendChild(icon)
      button.appendChild(label)

      if (isPinned) {
          const pinIcon = document.createElement('span')
          pinIcon.className = 'tab__pin-icon'
          pinIcon.innerHTML = codicons.pin
          button.appendChild(pinIcon)
      } else {
          const close = document.createElement('span')
          close.className = 'tab__close'
          close.innerHTML = codicons.close // SVG
          close.title = 'Close (Ctrl+W)'
          
          close.setAttribute('data-action', 'close')
          close.setAttribute('data-id', tab.id)
          
          button.appendChild(close)
      }
      
      this.container.appendChild(button)
    })
  }

  private attachEvents(): void {
    this.container.addEventListener('click', this.handleClick)
    this.container.addEventListener('contextmenu', this.handleContextMenu)
  }

  private handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement

    // Robust close check
    const closeBtn = target.closest('.tab__close') as HTMLElement
    if (closeBtn && closeBtn.dataset.id) {
      event.stopPropagation()
      this.onTabClose?.(closeBtn.dataset.id)
      return
    }

    const button = target.closest('.tab') as HTMLElement
    if (button && button.dataset.id) {
      this.onTabSelect?.(button.dataset.id)
    }
  }

  private handleContextMenu = (event: MouseEvent): void => {
    const target = event.target as HTMLElement
    const button = target.closest('.tab') as HTMLElement
    
    if (button && button.dataset.id) {
        event.preventDefault()
        this.onTabContextMenu?.(button.dataset.id, event)
    }
  }
}
