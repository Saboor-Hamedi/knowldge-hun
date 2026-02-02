import { state } from '../../core/state'
import { codicons } from '../../utils/codicons'
import getFileIcon from '../../utils/fileIconMappers'
import { createElement, Eye, Pin, Settings } from 'lucide'
import './tabbar.css'
import { setTooltip } from '../tooltip/tooltip'

export class TabBar {
  private container: HTMLElement
  private onTabSelect?: (id: string) => void
  private onTabClose?: (id: string) => void
  private onTabContextMenu?: (id: string, event: MouseEvent) => void
  private onTabReorder?: () => void
  private draggedTabId: string | null = null

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

  setTabReorderHandler(handler: () => void): void {
    this.onTabReorder = handler
  }

  render(): void {
    this.container.innerHTML = ''
    if (state.openTabs.length === 0) {
      this.container.style.display = 'none'
      return
    }

    // Apply custom tab settings
    const tabSettings = state.settings?.tab
    if (tabSettings) {
      if (tabSettings.backgroundColor)
        this.container.style.setProperty('--tab-bg', tabSettings.backgroundColor)
      else this.container.style.removeProperty('--tab-bg')

      if (tabSettings.borderColor)
        this.container.style.setProperty('--tab-border-color', tabSettings.borderColor)
      else this.container.style.removeProperty('--tab-border-color')

      if (tabSettings.activeTabColor)
        this.container.style.setProperty('--tab-active-bg', tabSettings.activeTabColor)
      else this.container.style.removeProperty('--tab-active-bg')

      if (tabSettings.inactiveTabColor)
        this.container.style.setProperty('--tab-inactive-bg', tabSettings.inactiveTabColor)
      else this.container.style.removeProperty('--tab-inactive-bg')

      if (tabSettings.activeTextColor)
        this.container.style.setProperty('--tab-active-text', tabSettings.activeTextColor)
      else this.container.style.removeProperty('--tab-active-text')

      if (tabSettings.inactiveTextColor)
        this.container.style.setProperty('--tab-inactive-text', tabSettings.inactiveTextColor)
      else this.container.style.removeProperty('--tab-inactive-text')

      // Border Position logic
      let shadow = 'inset 0 2px 0 var(--tab-border-color, var(--primary))' // Default top
      if (tabSettings.borderPosition === 'bottom')
        shadow = 'inset 0 -2px 0 var(--tab-border-color, var(--primary))'
      else if (tabSettings.borderPosition === 'left')
        shadow = 'inset 2px 0 0 var(--tab-border-color, var(--primary))'
      else if (tabSettings.borderPosition === 'right')
        shadow = 'inset -2px 0 0 var(--tab-border-color, var(--primary))'

      this.container.style.setProperty('--tab-active-shadow', shadow)

      // Compact Mode
      this.container.classList.toggle('is-compact', !!tabSettings.compactMode)
    } else {
      this.container.classList.remove('is-compact')
      this.container.style.removeProperty('--tab-bg')
      this.container.style.removeProperty('--tab-border-color')
      this.container.style.removeProperty('--tab-active-bg')
      this.container.style.removeProperty('--tab-inactive-bg')
      this.container.style.removeProperty('--tab-active-text')
      this.container.style.removeProperty('--tab-inactive-text')
      this.container.style.removeProperty('--tab-active-shadow')
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
      button.draggable = true

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
      } else if (tab.id === 'settings') {
        const settingsIcon = createElement(Settings, {
          size: 16,
          'stroke-width': 1.5,
          stroke: 'currentColor',
          color: 'currentColor'
        })
        icon.innerHTML = settingsIcon.outerHTML || codicons.settingsGear
      } else {
        icon.innerHTML = getFileIcon(title, 'markdown')
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
          size: 10,
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
    this.container.addEventListener('wheel', (_event: WheelEvent) => {
      // Prevent horizontal scrolling from propagating to the parent when scrolling on tabs
      // This is a common UX pattern for horizontal scrollable elements
      _event.stopPropagation()
    })
    this.container.addEventListener('click', this.handleClick)
    this.container.addEventListener('contextmenu', this.handleContextMenu)
    this.container.addEventListener('dragstart', this.handleDragStart)
    this.container.addEventListener('dragover', this.handleDragOver)
    this.container.addEventListener('dragenter', this.handleDragEnter)
    this.container.addEventListener('dragleave', this.handleDragLeave)
    this.container.addEventListener('drop', this.handleDrop)
    this.container.addEventListener('dragend', this.handleDragEnd)
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

  private handleDragStart = (event: DragEvent): void => {
    const button = (event.target as HTMLElement).closest('.tab') as HTMLElement
    if (button && button.dataset.id) {
      this.draggedTabId = button.dataset.id
      button.classList.add('is-dragging')
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', this.draggedTabId)
      }
    }
  }

  private handleDragOver = (event: DragEvent): void => {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }

    const target = (event.target as HTMLElement).closest('.tab') as HTMLElement
    if (
      !target ||
      !target.dataset.id ||
      !this.draggedTabId ||
      target.dataset.id === this.draggedTabId
    ) {
      return
    }

    const draggedEl = this.container.querySelector(
      `.tab[data-id="${this.draggedTabId}"]`
    ) as HTMLElement
    if (!draggedEl) return

    // Autoscroll logic
    const rect = this.container.getBoundingClientRect()
    const threshold = 50
    if (event.clientX < rect.left + threshold) {
      this.container.scrollLeft -= 5
    } else if (event.clientX > rect.right - threshold) {
      this.container.scrollLeft += 5
    }

    const children = Array.from(this.container.children) as HTMLElement[]
    const draggedIndex = children.indexOf(draggedEl)
    const targetIndex = children.indexOf(target)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Calculate midpoint check to prevent flickering/ping-ponging
    const targetRect = target.getBoundingClientRect()
    const midpoint = targetRect.left + targetRect.width / 2
    const isAfter = event.clientX > midpoint

    // Only move if the dragged element isn't already in the desired relative position
    if (draggedIndex < targetIndex && !isAfter) return
    if (draggedIndex > targetIndex && isAfter) return

    // --- FLIP Animation ---
    const tabRects = children.map((child) => ({
      el: child,
      left: child.getBoundingClientRect().left
    }))

    if (draggedIndex < targetIndex) {
      target.after(draggedEl)
    } else {
      target.before(draggedEl)
    }

    requestAnimationFrame(() => {
      tabRects.forEach((data) => {
        const first = data.left
        const last = data.el.getBoundingClientRect().left
        const invert = first - last

        if (invert !== 0) {
          data.el.style.transition = 'none'
          data.el.style.transform = `translateX(${invert}px)`
          void data.el.offsetWidth // Force reflow

          data.el.classList.add('is-reordering')
          data.el.style.transform = ''

          // Cleanup after animation
          const onEnd = (e: TransitionEvent): void => {
            if (e.propertyName === 'transform') {
              data.el.classList.remove('is-reordering')
              data.el.removeEventListener('transitionend', onEnd)
            }
          }
          data.el.addEventListener('transitionend', onEnd)
        }
      })
    })
  }

  private handleDragEnter = (event: DragEvent): void => {
    event.preventDefault()
  }

  private handleDragLeave = (): void => {
    // Logic removed as it conflicted with live reordering
  }

  private handleDrop = (event: DragEvent): void => {
    event.preventDefault()
    if (!this.draggedTabId) return

    // Final state sync
    const tabElements = Array.from(this.container.querySelectorAll('.tab')) as HTMLElement[]
    const newOrder = tabElements
      .map((el) => (el as HTMLElement).dataset.id)
      .filter(Boolean) as string[]

    // We already do live reordering, but this ensures state is fully synced
    this.container.dispatchEvent(new CustomEvent('tabs-reordered', { detail: { order: newOrder } }))
    this.draggedTabId = null
  }

  private handleDragEnd = (): void => {
    this.container.classList.remove('is-dragging-tab')
    const tabs = this.container.querySelectorAll('.tab')
    tabs.forEach((tab) => {
      ;(tab as HTMLElement).classList.remove('is-dragging', 'is-hidden')
      ;(tab as HTMLElement).style.transform = ''
    })
    this.draggedTabId = null
  }
}
