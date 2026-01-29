import { state } from '../../core/state'
import { codicons } from '../../utils/codicons'
import getFileIcon from '../../utils/fileIconMappers'
import { createElement, Eye, Pin } from 'lucide'
import './tabbar.css'
import { setTooltip } from '../tooltip/tooltip'

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
      this.container.style.display = 'none'
      return
    }

    this.container.style.display = 'flex'
    state.openTabs.forEach((tab) => {
      const isPinned = state.pinnedTabs.has(tab.id)
      const title = tab.title || ''

      // Detect file extension - since this is a .md project, default to 'md'
      // But check for special patterns like "settings.json" which should be "json"
      let ext = 'md' // Default to markdown
      const name = title.toLowerCase()

      if (name.includes('.json')) {
        ext = 'json'
      } else if (name.includes('.js') && (name.includes('.jsx') || name.endsWith('.js'))) {
        ext = name.includes('.jsx') ? 'jsx' : 'js'
      } else if (name.includes('.ts') && (name.includes('.tsx') || name.endsWith('.ts'))) {
        ext = name.includes('.tsx') ? 'tsx' : 'ts'
      } else if (name.includes('.html')) {
        ext = 'html'
      } else if (name.includes('.css') || name.includes('.scss') || name.includes('.sass')) {
        ext = 'css'
      } else if (title.includes('.')) {
        // If title has extension, use it (for special cases)
        ext = title.split('.').pop()?.toLowerCase() || 'md'
      }

      const button = document.createElement('button')
      const isDirty = state.isDirty && tab.id === state.activeId
      button.className = `tab${tab.id === state.activeId ? ' is-active' : ''}${isPinned ? ' is-pinned' : ''}${isDirty ? ' is-dirty' : ''}`
      button.dataset.id = tab.id
      button.dataset.ext = ext

      // Add tooltip with full path
      if (tab.id !== 'settings' && !tab.id.startsWith('preview-')) {
        const fullPath = state.vaultPath ? `${state.vaultPath}/${tab.id}` : tab.id
        setTooltip(button, fullPath.replace(/\\/g, '/'))
      } else if (tab.id === 'settings') {
        setTooltip(button, 'Application Settings')
      } else if (tab.id.startsWith('preview-')) {
        setTooltip(button, `Preview: ${tab.title}`)
      }

      const icon = document.createElement('span')
      icon.className = 'tab__icon'
      // Preview tabs get a special eye icon
      if (tab.id.startsWith('preview-')) {
        const eyeIcon = createElement(Eye, {
          size: 16,
          'stroke-width': 1.5,
          stroke: 'currentColor',
          color: 'currentColor'
        })
        icon.innerHTML = eyeIcon.outerHTML || getFileIcon(title, 'markdown')
      } else {
        icon.innerHTML =
          tab.id === 'settings' ? codicons.settingsGear : getFileIcon(title, 'markdown')
      }

      const label = document.createElement('span')
      label.className = 'tab__label'
      label.textContent = tab.title.replace(/\.md$/i, '')

      button.appendChild(icon)
      button.appendChild(label)

      if (isPinned) {
        const pinIcon = document.createElement('span')
        pinIcon.className = 'tab__pin-icon'
        const lucidePin = createElement(Pin, {
          size: 14,
          'stroke-width': 1.5,
          stroke: 'currentColor',
          color: 'currentColor'
        })
        pinIcon.innerHTML = lucidePin.outerHTML || codicons.pin
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

    // Scroll active tab into view
    this.scrollActiveTabIntoView()
  }

  /**
   * Scrolls the active tab into view, centering it when possible
   */
  public scrollActiveTabIntoView(): void {
    requestAnimationFrame(() => {
      const activeTab = this.container.querySelector('.tab.is-active') as HTMLElement
      if (!activeTab) return

      const containerRect = this.container.getBoundingClientRect()
      const tabRect = activeTab.getBoundingClientRect()

      // Check if tab is already fully visible
      const isFullyVisible =
        tabRect.left >= containerRect.left && tabRect.right <= containerRect.right

      if (!isFullyVisible) {
        // Calculate scroll position to center the tab
        const tabCenter = activeTab.offsetLeft + activeTab.offsetWidth / 2
        const containerCenter = this.container.offsetWidth / 2
        const scrollTarget = tabCenter - containerCenter

        this.container.scrollTo({
          left: Math.max(0, scrollTarget),
          behavior: 'smooth'
        })
      }
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
      // Scroll the clicked tab into view (it will become active)
      this.scrollActiveTabIntoView()
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
