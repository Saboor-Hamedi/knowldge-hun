import { sessionStorageService, type ChatSession } from '../../services/sessionStorageService'
import { modalManager } from '../modal/modal'
import { createElement, Search, Archive, RotateCcw } from 'lucide'

/**
 * Session Sidebar Component
 * Displays list of chat sessions with ability to open/delete them
 */
export class SessionSidebar {
  private container: HTMLElement
  private sidebarElement!: HTMLElement
  private sessionsList!: HTMLElement
  private searchInput!: HTMLInputElement
  private resizeHandle!: HTMLElement
  private isVisible = false
  private isResizing = false
  private onSessionSelect?: (sessionId: string) => void
  private onNewSession?: () => void
  private currentSessionId: string | null = null
  private allSessions: ChatSession[] = []
  private archivedSessions: ChatSession[] = []
  private searchQuery: string = ''
  private showArchived: boolean = false
  private sidebarWidth: number = 280 // Default width

  constructor(container: HTMLElement | string) {
    // Accept either HTMLElement or container ID string
    if (typeof container === 'string') {
      this.container = document.getElementById(container) as HTMLElement
    } else {
      this.container = container
    }

    if (!this.container) {
      console.error('[SessionSidebar] Container not found')
      return
    }

    this.render()
    this.attachEvents()
    void this.loadSessions()
  }

  setOnSessionSelect(callback: (sessionId: string) => void): void {
    this.onSessionSelect = callback
  }

  setOnNewSession(callback: () => void): void {
    this.onNewSession = callback
  }

  setCurrentSession(sessionId: string | null): void {
    this.currentSessionId = sessionId
    this.updateActiveSession()
  }

  toggle(): void {
    if (!this.sidebarElement) {
      console.error('[SessionSidebar] Sidebar element not found')
      return
    }

    this.isVisible = !this.isVisible

    if (this.isVisible) {
      this.sidebarElement.classList.add('rightbar__session-sidebar--visible')
      this.sidebarElement.style.width = `${this.sidebarWidth}px`
      // Add class to parent rightbar for content shifting (fallback for browsers without :has() support)
      const rightbar = this.container.closest('.rightbar')
      if (rightbar) {
        rightbar.classList.add('rightbar--session-sidebar-visible')
      }
      this.updateContentMargin()
      void this.loadSessions()
    } else {
      this.sidebarElement.classList.remove('rightbar__session-sidebar--visible')
      // Remove class from parent rightbar
      const rightbar = this.container.closest('.rightbar')
      if (rightbar) {
        rightbar.classList.remove('rightbar--session-sidebar-visible')
      }
      this.clearContentMargin()
    }
  }

  show(): void {
    this.isVisible = true
    this.sidebarElement.classList.add('rightbar__session-sidebar--visible')
    this.sidebarElement.style.width = `${this.sidebarWidth}px`
    // Add class to parent rightbar for content shifting
    const rightbar = this.container.closest('.rightbar')
    if (rightbar) {
      rightbar.classList.add('rightbar--session-sidebar-visible')
    }
    this.updateContentMargin()
    void this.loadSessions()
  }

  hide(): void {
    this.isVisible = false
    this.sidebarElement.classList.remove('rightbar__session-sidebar--visible')
    // Remove class from parent rightbar
    const rightbar = this.container.closest('.rightbar')
    if (rightbar) {
      rightbar.classList.remove('rightbar--session-sidebar-visible')
    }
    this.clearContentMargin()
  }

  private render(): void {
    if (!this.container) {
      console.error('[SessionSidebar] Cannot render: container is null')
      return
    }

    // Load saved width from localStorage
    const savedWidth = localStorage.getItem('knowledgeHub_sessionSidebarWidth')
    if (savedWidth) {
      this.sidebarWidth = parseInt(savedWidth, 10)
    }

    const sidebarHTML = `
      <div class="rightbar__session-sidebar" id="rightbar-session-sidebar" style="width: ${this.sidebarWidth}px;">
        <div class="rightbar__session-sidebar-resize" id="rightbar-session-sidebar-resize"></div>
        <div class="rightbar__session-sidebar-resize" id="rightbar-session-sidebar-resize"></div>
        <div class="rightbar__session-sidebar-actions">
          <div class="rightbar__session-sidebar-search">
            <div class="rightbar__session-sidebar-search-icon">
              ${this.createLucideIcon(Search, 14, 1.5)}
            </div>
            <input 
              type="text" 
              class="rightbar__session-sidebar-search-input" 
              id="rightbar-session-sidebar-search" 
              placeholder="Search sessions..."
              autocomplete="off"
            />
          </div>
          <div class="rightbar__session-sidebar-buttons">
            <button class="rightbar__session-sidebar-new" id="rightbar-session-sidebar-new" title="New Session">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 2v12M2 8h12"/>
              </svg>
              New
            </button>
            <button class="rightbar__session-sidebar-archived" id="rightbar-session-sidebar-archived" title="View Archived Sessions">
              ${this.createLucideIcon(Archive, 14, 1.5)}
              Archived
            </button>
          </div>
        </div>
        <div class="rightbar__session-sidebar-list" id="rightbar-session-sidebar-list">
          <div class="rightbar__session-sidebar-loading">Loading sessions...</div>
        </div>
      </div>
    `
    this.container.insertAdjacentHTML('beforeend', sidebarHTML)
    this.sidebarElement = this.container.querySelector('#rightbar-session-sidebar') as HTMLElement
    this.sessionsList = this.container.querySelector(
      '#rightbar-session-sidebar-list'
    ) as HTMLElement
    this.searchInput = this.container.querySelector(
      '#rightbar-session-sidebar-search'
    ) as HTMLInputElement
    this.resizeHandle = this.container.querySelector(
      '#rightbar-session-sidebar-resize'
    ) as HTMLElement

    if (!this.sidebarElement) {
      console.error('[SessionSidebar] Failed to find sidebar element after render')
    }
    if (!this.sessionsList) {
      console.error('[SessionSidebar] Failed to find sessions list after render')
    }
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

  private attachEvents(): void {
    const closeBtn = this.container.querySelector('#rightbar-session-sidebar-close')
    const newBtn = this.container.querySelector('#rightbar-session-sidebar-new')
    const archivedBtn = this.container.querySelector('#rightbar-session-sidebar-archived')

    closeBtn?.addEventListener('click', () => this.hide())
    newBtn?.addEventListener('click', () => {
      if (this.onNewSession) {
        this.onNewSession()
      }
    })

    archivedBtn?.addEventListener('click', () => {
      this.showArchived = !this.showArchived
      archivedBtn.classList.toggle('rightbar__session-sidebar-archived--active', this.showArchived)
      void this.loadSessions()
    })

    // Resize functionality
    if (this.resizeHandle) {
      this.resizeHandle.addEventListener('mousedown', (e) => this.handleResizeStart(e))
    }

    // Search functionality
    if (this.searchInput) {
      let searchTimeout: number | null = null
      this.searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.toLowerCase().trim()
        this.searchQuery = query

        // Debounce search
        if (searchTimeout) clearTimeout(searchTimeout)
        searchTimeout = window.setTimeout(() => {
          this.filterAndRenderSessions()
        }, 200)
      })

      // Clear search on Escape
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.searchInput.value = ''
          this.searchQuery = ''
          this.filterAndRenderSessions()
          this.searchInput.blur()
        }
      })
    }
  }

  async loadSessions(): Promise<void> {
    try {
      // Load both regular and archived sessions
      const allSessionsIncludingArchived = await sessionStorageService.getAllSessions(true)
      this.allSessions = allSessionsIncludingArchived.filter((s) => !s.is_archived)
      this.archivedSessions = allSessionsIncludingArchived.filter((s) => s.is_archived)
      this.filterAndRenderSessions()
    } catch (error) {
      console.error('[SessionSidebar] Failed to load sessions:', error)
      this.sessionsList.innerHTML = `
        <div class="rightbar__session-sidebar-error">Failed to load sessions</div>
      `
    }
  }

  private filterAndRenderSessions(): void {
    // Choose which sessions to display based on archive toggle
    const sessionsToFilter = this.showArchived ? this.archivedSessions : this.allSessions

    if (this.searchQuery) {
      const filtered = sessionsToFilter.filter((session) => {
        const titleMatch = session.title.toLowerCase().includes(this.searchQuery)
        const contentMatch = session.messages.some((msg) =>
          msg.content.toLowerCase().includes(this.searchQuery)
        )
        return titleMatch || contentMatch
      })
      this.renderSessions(filtered, this.showArchived)
    } else {
      this.renderSessions(sessionsToFilter, this.showArchived)
    }
  }

  private renderSessions(sessions: ChatSession[], isArchived: boolean = false): void {
    if (sessions.length === 0) {
      const emptyMessage = isArchived
        ? 'No archived sessions.'
        : 'No sessions yet. Start a conversation!'
      this.sessionsList.innerHTML = `
        <div class="rightbar__session-sidebar-empty">${emptyMessage}</div>
      `
      return
    }

    const sessionsHTML = sessions
      .map((session) => {
        const isActive = session.id === this.currentSessionId
        const date = new Date(session.metadata.updated_at)
        const timeAgo = this.formatTimeAgo(date)

        // Different actions for archived vs regular sessions
        const actionsHTML = isArchived
          ? `
        <button class="rightbar__session-item-unarchive" 
                data-session-id="${session.id}" 
                title="Restore session"
                aria-label="Restore session">
          ${this.createLucideIcon(RotateCcw, 14, 1.5)}
        </button>
        <button class="rightbar__session-item-delete" 
                data-session-id="${session.id}" 
                title="Delete permanently"
                aria-label="Delete permanently">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h10M5 6v8a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V6M8 4V2M8 4h4M8 4H4"/>
          </svg>
        </button>
      `
          : `
        <button class="rightbar__session-item-rename" 
                data-session-id="${session.id}" 
                title="Rename session"
                aria-label="Rename session">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4l1 1-7 7H4v-1l7-7zM9.5 2.5l3 3"/>
          </svg>
        </button>
        <button class="rightbar__session-item-delete" 
                data-session-id="${session.id}" 
                title="Delete session"
                aria-label="Delete session">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h10M5 6v8a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V6M8 4V2M8 4h4M8 4H4"/>
          </svg>
        </button>
      `

        return `
        <div class="rightbar__session-item ${isActive ? 'rightbar__session-item--active' : ''} ${isArchived ? 'rightbar__session-item--archived' : ''}" 
             data-session-id="${session.id}">
          <div class="rightbar__session-item-content">
            <div class="rightbar__session-item-title-wrapper">
              <div class="rightbar__session-item-title" data-session-id="${session.id}">${this.escapeHtml(session.title)}</div>
            </div>
            <div class="rightbar__session-item-meta">
              <span class="rightbar__session-item-time">${timeAgo}</span>
              <span class="rightbar__session-item-count">${session.messages.length} messages</span>
            </div>
          </div>
          <div class="rightbar__session-item-actions">
            ${actionsHTML}
          </div>
        </div>
      `
      })
      .join('')

    this.sessionsList.innerHTML = sessionsHTML

    // Handle session item clicks
    this.sessionsList.querySelectorAll('.rightbar__session-item').forEach((item) => {
      const sessionId = (item as HTMLElement).dataset.sessionId
      if (sessionId) {
        item.addEventListener('click', (e) => {
          // Don't trigger if clicking on action buttons
          if (
            (e.target as HTMLElement).closest('.rightbar__session-item-delete') ||
            (e.target as HTMLElement).closest('.rightbar__session-item-rename')
          ) {
            return
          }
          if (this.onSessionSelect) {
            this.onSessionSelect(sessionId)
          }
        })
      }
    })

    // Handle rename buttons
    this.sessionsList.querySelectorAll('.rightbar__session-item-rename').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const sessionId = (btn as HTMLElement).dataset.sessionId
        if (sessionId) {
          await this.startRenameSession(sessionId)
        }
      })
    })

    // Handle delete buttons
    this.sessionsList.querySelectorAll('.rightbar__session-item-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const sessionId = (btn as HTMLElement).dataset.sessionId
        if (sessionId) {
          // Find session title for better UX
          const sessionItem = btn.closest('.rightbar__session-item') as HTMLElement
          const sessionTitle =
            sessionItem?.querySelector('.rightbar__session-item-title')?.textContent ||
            'this session'

          modalManager.open({
            title: 'Delete Session',
            content: `Are you sure you want to delete "${sessionTitle}"? This action cannot be undone.`,
            size: 'sm',
            buttons: [
              {
                label: 'Delete',
                variant: 'danger',
                onClick: async (m) => {
                  m.close()
                  try {
                    await sessionStorageService.deleteSession(sessionId)
                    await this.loadSessions()
                  } catch (error) {
                    console.error('[SessionSidebar] Failed to delete session:', error)
                    modalManager.open({
                      title: 'Error',
                      content: 'Failed to delete session. Please try again.',
                      size: 'sm',
                      buttons: [{ label: 'OK', variant: 'primary', onClick: (m) => m.close() }]
                    })
                  }
                }
              },
              { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() }
            ]
          })
        }
      })
    })

    // Handle unarchive buttons (for archived sessions)
    this.sessionsList.querySelectorAll('.rightbar__session-item-unarchive').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const sessionId = (btn as HTMLElement).dataset.sessionId
        if (sessionId) {
          try {
            await sessionStorageService.archiveSession(sessionId, false) // false = unarchive
            await this.loadSessions()
          } catch (error) {
            console.error('[SessionSidebar] Failed to unarchive session:', error)
          }
        }
      })
    })
  }

  private async startRenameSession(sessionId: string): Promise<void> {
    try {
      const session = await sessionStorageService.getSession(sessionId)
      if (!session) return

      const item = this.sessionsList.querySelector(
        `[data-session-id="${sessionId}"]`
      ) as HTMLElement
      if (!item) return

      const titleElement = item.querySelector('.rightbar__session-item-title') as HTMLElement
      if (!titleElement) return

      const currentTitle = session.title
      const titleWrapper = titleElement.parentElement
      if (!titleWrapper) return

      // Create input element
      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'rightbar__session-item-title-input'
      input.value = currentTitle
      input.maxLength = 100

      // Replace title with input
      titleElement.style.display = 'none'
      titleWrapper.insertBefore(input, titleElement)
      input.focus()
      input.select()

      const finishRename = async () => {
        const newTitle = input.value.trim()

        if (newTitle && newTitle !== currentTitle) {
          try {
            await sessionStorageService.updateSessionTitle(sessionId, newTitle)
            await this.loadSessions()
          } catch (error) {
            console.error('[SessionSidebar] Failed to rename session:', error)
            alert('Failed to rename session')
            titleElement.style.display = ''
            input.remove()
          }
        } else {
          titleElement.style.display = ''
          input.remove()
        }
      }

      input.addEventListener('blur', finishRename)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          input.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          titleElement.style.display = ''
          input.remove()
        }
      })
    } catch (error) {
      console.error('[SessionSidebar] Failed to start rename:', error)
    }
  }

  private updateActiveSession(): void {
    this.sessionsList.querySelectorAll('.rightbar__session-item').forEach((item) => {
      const sessionId = (item as HTMLElement).dataset.sessionId
      if (sessionId === this.currentSessionId) {
        item.classList.add('rightbar__session-item--active')
      } else {
        item.classList.remove('rightbar__session-item--active')
      }
    })
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  async refresh(): Promise<void> {
    await this.loadSessions()
  }

  // ---- Resize handlers ----
  private handleResizeStart(e: MouseEvent): void {
    e.preventDefault()
    this.isResizing = true

    document.addEventListener('mousemove', this.handleResizeMove)
    document.addEventListener('mouseup', this.handleResizeEnd)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  private handleResizeMove = (e: MouseEvent): void => {
    if (!this.isResizing || !this.sidebarElement) return

    // Calculate new width based on mouse position relative to the sidebar's left edge
    const sidebarRect = this.sidebarElement.getBoundingClientRect()
    const newWidth = e.clientX - sidebarRect.left

    // Clamp width between min and max
    const minWidth = 200
    const maxWidth = 500
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))

    this.sidebarWidth = clampedWidth
    this.sidebarElement.style.width = `${clampedWidth}px`

    // Update the margin on content areas that are pushed by the sidebar
    this.updateContentMargin()
  }

  private handleResizeEnd = (): void => {
    if (!this.isResizing) return
    this.isResizing = false

    document.removeEventListener('mousemove', this.handleResizeMove)
    document.removeEventListener('mouseup', this.handleResizeEnd)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // Save width to localStorage
    localStorage.setItem('knowledgeHub_sessionSidebarWidth', String(this.sidebarWidth))
  }

  private updateContentMargin(): void {
    // Update the margin-left of content areas when sidebar is visible
    if (!this.isVisible) return

    const rightbar = this.container.closest('.rightbar')
    if (!rightbar) return

    // Only push chat container and input wrapper, NOT header
    const chatContainer = rightbar.querySelector('.rightbar__chat-container') as HTMLElement
    const chatInputWrapper = rightbar.querySelector('.rightbar__chat-input-wrapper') as HTMLElement

    const marginValue = `${this.sidebarWidth}px`

    if (chatContainer) chatContainer.style.marginLeft = marginValue
    if (chatInputWrapper) chatInputWrapper.style.marginLeft = marginValue
  }

  private clearContentMargin(): void {
    const rightbar = this.container.closest('.rightbar')
    if (!rightbar) return

    const chatContainer = rightbar.querySelector('.rightbar__chat-container') as HTMLElement
    const chatInputWrapper = rightbar.querySelector('.rightbar__chat-input-wrapper') as HTMLElement

    if (chatContainer) chatContainer.style.marginLeft = ''
    if (chatInputWrapper) chatInputWrapper.style.marginLeft = ''
  }
}
