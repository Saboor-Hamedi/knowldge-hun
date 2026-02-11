import { Terminal, ILink } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'
import { CanvasAddon } from '@xterm/addon-canvas'
import { SerializeAddon } from '@xterm/addon-serialize'
import { state } from '../../core/state'
import { ConsoleComponent } from '../console/console'
import '@xterm/xterm/css/xterm.css'
import './real-terminal.css'

interface TerminalSession {
  id: string
  terminal: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
  isActive: boolean
  shellType?: string
  cwd?: string
  customName?: string
  color?: string
  isSplit?: boolean
  serializeAddon: SerializeAddon
}

export class RealTerminalComponent {
  private container: HTMLElement
  private terminalContainer: HTMLElement
  private sessions: Map<string, TerminalSession> = new Map()
  private activeSessionId: string | null = null
  private secondaryActiveSessionId: string | null = null // For split view
  private isVisible: boolean = false
  private isRestoring: boolean = false
  private isQuitting: boolean = false
  private isSplitMode: boolean = false
  private isResizing: boolean = false
  private startY: number = 0
  private startHeight: number = 0
  private onNoteSelect?: (id: string, path?: string) => void
  private hubConsole?: ConsoleComponent
  private lastVaultPath: string | null = null
  private resizeObserver: ResizeObserver | null = null
  private resizeDebounceTimeout: any = null

  constructor(containerId: string, hubConsole?: ConsoleComponent) {
    this.hubConsole = hubConsole
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Terminal container with id "${containerId}" not found`)
    }
    this.container = container
    this.terminalContainer = document.createElement('div')
    this.terminalContainer.className = 'real-terminal-container'
    this.container.appendChild(this.terminalContainer)

    this.init()
  }

  private async init(): Promise<void> {
    await this.render()

    // Get initial path BEFORE attaching listeners to avoid redundant switch on startup
    const path = await this.getVaultPath()
    this.lastVaultPath = path || null

    this.setupEventListeners()
    await this.restoreSessions()

    // Restore visibility if it was open (Scoped to vault)
    const vaultPath = await this.getVaultPath()
    const visibilityKey = vaultPath
      ? `terminal_panel_visible_${vaultPath}`
      : 'terminal_panel_visible'
    const savedVisibility = localStorage.getItem(visibilityKey) === 'true'
    if (savedVisibility) {
      this.show()
    }

    // Restore active tab (Scoped to vault)
    const tabKey = vaultPath ? `terminal_active_tab_${vaultPath}` : 'terminal_active_tab'
    const savedTab = localStorage.getItem(tabKey) as 'terminal' | 'console' | null
    if (savedTab) {
      this.switchView(savedTab)
    }
  }

  private async render(): Promise<void> {
    // Get available shells
    const availableShells = await this.getAvailableShells()

    const menuItems = availableShells
      .map(
        (shell) => `
        <div class="shell-menu-item" data-value="${shell.value}">
          <span class="shell-icon">${this.getShellIconSVG(shell.value)}</span>
          <span class="shell-label">${shell.label}</span>
        </div>
      `
      )
      .join('')

    this.container.innerHTML = `
      <div class="real-terminal-wrapper" style="position: relative;">
        <div class="real-terminal-knob"></div>
        <div class="real-terminal-header">
          <div class="real-terminal-tabs">
            <button class="terminal-tab active" data-tab="terminal">TERMINAL</button>
            <button class="terminal-tab" data-tab="console">CONSOLE</button>
          </div>
          <div class="real-terminal-actions">
            <!-- existing actions -->
            <button class="real-terminal-btn" id="toggle-search-btn" title="Find (Ctrl+F)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
            <button class="real-terminal-btn" id="toggle-sidebar-btn" title="Toggle Sidebar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
            
            <div class="terminal-actions-group">
              <div class="new-terminal-split-btn">
                <button class="real-terminal-btn" id="new-terminal-btn" title="New Terminal (Default)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
                <button class="real-terminal-btn shell-dropdown-chevron" id="shell-menu-trigger" title="Select Default Profile">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </div>

            <div class="shell-dropdown-menu" id="shell-dropdown-menu">
              ${menuItems}
            </div>

            <button class="real-terminal-btn" id="split-terminal-btn" title="Toggle Split View">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
            </button>
            <button class="real-terminal-btn" id="trash-terminal-btn" title="Kill Terminal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path>
              </svg>
            </button>
            <button class="real-terminal-btn" id="close-terminal-btn" title="Close Panel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="real-terminal-search-container unified-search-container animated" id="terminal-search-container" style="display: none;">
          <div class="unified-search-wrapper">
            <input type="text" id="terminal-search-input" class="unified-search-input" placeholder="Find" autocomplete="off" />
          </div>
          <div class="search-actions">
            <button id="search-prev" class="unified-search-action" title="Previous Match (Shift+Enter)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <polyline points="11 13 6 8 11 3"></polyline>
              </svg>
            </button>
            <button id="search-next" class="unified-search-action" title="Next Match (Enter)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <polyline points="5 3 10 8 5 13"></polyline>
              </svg>
            </button>
            <button id="search-close" class="unified-search-action close" title="Close (Escape)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <line x1="4" y1="4" x2="12" y2="12"></line>
                <line x1="12" y1="4" x2="4" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="real-terminal-body">
          <div class="real-terminal-sidebar">
            <div class="terminal-sessions-list" id="terminal-sessions-list"></div>
          </div>
          <div class="real-terminal-content" id="terminal-content"></div>
        </div>
        
        <div class="real-terminal-console-host" id="real-terminal-console-host" style="display: none;">
          <!-- Console will be moved here -->
        </div>
      </div>
    `

    // Embed Console
    this.initConsoleEmbedding()

    // Setup ResizeObserver for perfectly synced resizing
    this.initResizeObserver()
  }

  private initResizeObserver(): void {
    if (this.resizeObserver) this.resizeObserver.disconnect()

    this.resizeObserver = new ResizeObserver(() => {
      if (this.isVisible) {
        this.debounceFitAll()
      }
    })

    const body = this.container.querySelector('.real-terminal-body')
    if (body) {
      this.resizeObserver.observe(body)
    }
  }

  private debounceFitAll(): void {
    if (this.resizeDebounceTimeout) clearTimeout(this.resizeDebounceTimeout)
    this.resizeDebounceTimeout = setTimeout(() => {
      this.fitAll()
    }, 100)
  }

  private fitAll(): void {
    for (const [id, session] of this.sessions.entries()) {
      if (this.isVisible) {
        try {
          session.fitAddon.fit()
          // CRITICAL: Always notify backend of the new size
          this.resizeTerminal(id)
        } catch (err) {
          console.warn('[RealTerminal] Fit failed:', err)
        }
      }
    }
  }

  setNoteSelectHandler(handler: (id: string, path?: string) => void): void {
    this.onNoteSelect = handler
  }

  private initConsoleEmbedding(): void {
    // Attempt to find the global console element
    const consoleEl = document.querySelector('.hub-console')
    const host = this.container.querySelector('#real-terminal-console-host')

    if (consoleEl && host) {
      // Move it
      host.appendChild(consoleEl)
      consoleEl.classList.add('hub-console--embedded')
      // Ensure it's "open" so it renders content, but visibility is controlled by our host
      consoleEl.classList.add('is-open')
    }
  }

  public showConsole(): void {
    if (!this.isVisible) this.show()
    this.switchView('console')
  }

  public showTerminal(): void {
    if (!this.isVisible) this.show()
    this.switchView('terminal')
  }

  private switchView(view: 'terminal' | 'console'): void {
    const tabs = this.container.querySelectorAll('.terminal-tab')
    const termBody = this.container.querySelector('.real-terminal-body') as HTMLElement
    const consoleHost = this.container.querySelector('#real-terminal-console-host') as HTMLElement

    // Persist active tab (Scoped to vault if possible)
    const tabKey = this.lastVaultPath
      ? `terminal_active_tab_${this.lastVaultPath}`
      : 'terminal_active_tab'
    localStorage.setItem(tabKey, view)

    // Update tabs
    tabs.forEach((t) => {
      const tab = t as HTMLElement
      if (tab.dataset.tab === view) tab.classList.add('active')
      else tab.classList.remove('active')
    })

    // Toggle content
    if (view === 'terminal') {
      if (termBody) termBody.style.display = 'flex'
      if (consoleHost) consoleHost.style.display = 'none'

      // Focus terminal
      if (this.activeSessionId) {
        const session = this.sessions.get(this.activeSessionId)
        session?.terminal.focus()
      }
    } else {
      if (termBody) termBody.style.display = 'none'
      if (consoleHost) consoleHost.style.display = 'flex'

      // Update console state if we have it
      if (this.hubConsole) {
        this.hubConsole.setVisible(true)
      }

      // Focus console input
      const input = consoleHost.querySelector('.hub-console__input') as HTMLElement
      input?.focus()
    }
  }

  /**
   * Get available shells on the system
   */
  private async getAvailableShells(): Promise<Array<{ value: string; label: string }>> {
    try {
      const available = (await window.api.invoke('terminal:get-available-shells')) as Array<{
        value: string
        label: string
      }>
      // Extra safety: Filter out any stray docker distros that might have slipped through
      return available.filter(
        (shell) =>
          !shell.label.toLowerCase().includes('docker') &&
          !shell.label.toLowerCase().includes('desktop')
      )
    } catch (error) {
      console.error('[RealTerminal] Failed to get available shells:', error)
      // Fallback to PowerShell on Windows
      return [{ value: 'powershell', label: 'PowerShell' }]
    }
  }

  private getShellIconSVG(shell: string): string {
    const icons: Record<string, string> = {
      powershell: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
      pwsh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
      cmd: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
      bash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 12H15L13.5 15.5H8.5L7 12H2"></path><path d="M5.45 5.11L2 12V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V12L18.55 5.11C18.19 4.45 17.51 4 16.76 4H7.24C6.49 4 5.81 4.45 5.45 5.11Z"></path></svg>`,
      wsl: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"></path><path d="M12 8v4l3 3"></path></svg>`
    }

    if (shell.startsWith('wsl:')) return icons.wsl
    return icons[shell] || icons.powershell
  }

  /**
   * Setup resizing logic for the terminal panel knob
   */
  private setupSyncResizing(): void {
    const knob = this.container.querySelector('.real-terminal-knob') as HTMLElement
    if (!knob) return

    knob.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()

      this.isResizing = true
      this.startY = e.clientY
      const host = document.getElementById('terminalHost')
      if (!host) return
      this.startHeight = host.offsetHeight

      document.body.style.cursor = 'ns-resize'
      this.container.classList.add('is-resizing')

      const onMouseMove = (moveEvent: MouseEvent): void => {
        if (!this.isResizing) return

        requestAnimationFrame(() => {
          const delta = this.startY - moveEvent.clientY

          // CRITICAL: Limit height so we don't push breadcrumbs/tabs out of view.
          // This ensures the terminal layout never breaks the main workspace navigation.
          // Calculation: Header (32) + Tabs (40) + Breadcrumbs (28) + Statusbar (28) + Min Editor (50)
          const maxHeight = window.innerHeight - (32 + 40 + 28 + 28 + 50)

          const newHeight = Math.max(100, Math.min(maxHeight, this.startHeight + delta))

          if (host) {
            host.style.height = `${newHeight}px`
            // optimization: Do NOT fit() during drag to prevent flickering.
            // The text will reflow once when the user releases the mouse.
          }
        })
      }

      const onMouseUp = (): void => {
        this.isResizing = false
        document.body.style.cursor = ''
        this.container.classList.remove('is-resizing')

        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)

        // Final fit to be sure
        setTimeout(() => {
          this.sessions.forEach((session) => session.fitAddon.fit())
        }, 50)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    })
  }

  private setupEventListeners(): void {
    // Setup resize knob
    this.setupSyncResizing()

    const tabs = this.container.querySelectorAll('.terminal-tab')
    tabs.forEach((t) => {
      t.addEventListener('click', (e) => {
        const view = (e.currentTarget as HTMLElement).dataset.tab as 'terminal' | 'console'
        if (view) {
          this.switchView(view)
        }
      })
    })

    const newTerminalBtn = document.getElementById('new-terminal-btn')
    const closeTerminalBtn = document.getElementById('close-terminal-btn')
    const splitTerminalBtn = document.getElementById('split-terminal-btn')
    const trashTerminalBtn = document.getElementById('trash-terminal-btn')

    newTerminalBtn?.addEventListener('click', () => {
      this.createNewTerminal()
    })

    const shellMenuTrigger = document.getElementById('shell-menu-trigger')
    const shellMenu = document.getElementById('shell-dropdown-menu')

    shellMenuTrigger?.addEventListener('click', (e) => {
      e.stopPropagation()
      const isVisible = shellMenu?.style.display === 'block'
      const nextVisible = !isVisible

      if (shellMenu) shellMenu.style.display = nextVisible ? 'block' : 'none'

      // If we are opening the shell menu, close the search
      if (nextVisible) {
        this.toggleSearch(false)
      }
    })

    document.addEventListener('click', () => {
      if (shellMenu) shellMenu.style.display = 'none'
    })

    shellMenu?.querySelectorAll('.shell-menu-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation()
        const shell = (item as HTMLElement).dataset.value
        if (shell) {
          this.createNewTerminal(shell)
          if (shellMenu) shellMenu.style.display = 'none'
        }
      })
    })

    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn')
    toggleSidebarBtn?.addEventListener('click', () => {
      this.toggleSidebar()
    })

    closeTerminalBtn?.addEventListener('click', () => this.toggle())

    const toggleSearchBtn = document.getElementById('toggle-search-btn')
    const searchInput = document.getElementById('terminal-search-input') as HTMLInputElement
    const searchPrev = document.getElementById('search-prev')
    const searchNext = document.getElementById('search-next')
    const searchClose = document.getElementById('search-close')

    toggleSearchBtn?.addEventListener('click', () => this.toggleSearch())
    searchClose?.addEventListener('click', () => this.toggleSearch(false))

    searchInput?.addEventListener('input', () => {
      this.doSearch(searchInput.value)
    })

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.doSearch(searchInput.value, e.shiftKey ? 'prev' : 'next')
      }
      if (e.key === 'Escape') {
        this.toggleSearch(false)
      }
    })

    searchPrev?.addEventListener('click', () => this.doSearch(searchInput.value, 'prev'))
    searchNext?.addEventListener('click', () => this.doSearch(searchInput.value, 'next'))

    splitTerminalBtn?.addEventListener('click', () => {
      this.toggleSplitView()
    })

    // Global Keybinds (handled via keyboardManager in app.ts for better focus routing)

    trashTerminalBtn?.addEventListener('click', () => {
      if (this.activeSessionId) {
        this.closeTerminal(this.activeSessionId)
      }
    })

    // Handle window focus/resize for robustness
    window.addEventListener('resize', () => {
      this.debounceFitAll()
    })

    window.addEventListener('focus', () => {
      if (this.isVisible) {
        this.fitAll()
      }
    })

    // Track when the app is quitting to prevent partial session saves
    window.addEventListener('beforeunload', () => {
      this.isQuitting = true

      // Attempt to kill backend sessions
      this.sessions.forEach((s) => {
        // Fire and forget kill command to backend
        try {
          // specific check for api availability
          if (window.api && window.api.invoke) {
            window.api
              .invoke('terminal:kill', s.id)
              .catch((err) => console.warn('Kill failed', err))
          }
        } catch (e) {
          // ignore errors during unload
        }
      })

      // Dispose all terminal instances to free up resources
      this.sessions.forEach((s) => s.terminal.dispose())
    })

    // Listen for vault switch to handle cleanup and restoration
    window.addEventListener('vault-changed', () => {
      void this.handleVaultSwitch()
    })
  }

  private async handleVaultSwitch(): Promise<void> {
    if (this.isRestoring) {
      console.log('[RealTerminal] Already restoring sessions, skipping vault switch trigger')
      return
    }

    const newPath = await this.getVaultPath()
    if (!newPath) return

    // IGNORE if it's the same vault (prevents terminal restart on folder create/rename/etc)
    if (this.lastVaultPath === newPath) {
      console.log('[RealTerminal] Vault path unchanged, skipping terminal reset')
      return
    }

    console.log(
      `[RealTerminal] Vault switched: ${this.lastVaultPath} -> ${newPath}. Cleaning up...`
    )

    // 1. Save sessions for the OLD vault before cleaning up
    if (this.lastVaultPath) {
      this.saveSessions(this.lastVaultPath)
    }

    this.lastVaultPath = newPath

    // 2. Kill all backend processes and clear UI for the OLD vault
    await this.cleanupAllSessions()

    // 3. Restore sessions for the NEW vault
    await this.restoreSessions()

    // 3. Fallback: If no sessions were restored, start a fresh terminal
    if (this.sessions.size === 0) {
      console.log('[RealTerminal] No sessions restored for new vault, creating fresh terminal')
      await this.createNewTerminal()
    }
  }

  private async cleanupAllSessions(): Promise<void> {
    const ids = Array.from(this.sessions.keys())
    console.log(`[RealTerminal] Cleaning up ${ids.length} sessions...`)

    // Kill backend processes and dispose UI
    for (const id of ids) {
      const session = this.sessions.get(id)

      // 1. Clean up backend
      try {
        await window.api.invoke('terminal:kill', id)
      } catch (err) {
        console.warn(`[RealTerminal] Failed to kill session ${id}`, err)
      }

      // 2. Dispose Xterm terminal instance to free resources and stop listeners
      if (session) {
        try {
          session.terminal.dispose()
        } catch (err) {
          console.warn(`[RealTerminal] Error disposing terminal ${id}:`, err)
        }
      }

      // 3. Remove DOM elements
      const el = document.getElementById(`terminal-${id}`)
      if (el) el.remove()
      const item = document.getElementById(`session-${id}`)
      if (item) item.remove()
    }

    // Clear internal state
    this.sessions.clear()
    this.activeSessionId = null
    this.secondaryActiveSessionId = null

    const list = document.getElementById('terminal-sessions-list')
    if (list) list.innerHTML = ''

    console.log('[RealTerminal] Cleanup complete')
  }

  /**
   * Apply settings to all active terminal sessions
   */
  public async applySettings(settings: any): Promise<void> {
    if (!settings) return

    const fontSize = settings.terminalFontSize || 14
    const fontFamily = settings.terminalFontFamily || 'Consolas, "Courier New", monospace'
    const background = settings.terminalBackground || '#1e1e1e'
    const foreground = settings.terminalForeground || '#cccccc'
    const cursor = settings.terminalCursor || '#ffffff'
    const frameColor = settings.terminalFrameColor || '#1e1e1e'

    // Update frame colors
    const frameElements = [
      '.real-terminal-wrapper',
      '.real-terminal-header',
      '.real-terminal-sidebar'
    ]

    frameElements.forEach((selector) => {
      const el = this.container.querySelector(selector) as HTMLElement
      if (el) {
        el.style.backgroundColor = frameColor
      }
    })

    // CRITICAL: The body and instances must match the terminal background EXACTLY to hide any "bottom gap"
    // caused by the terminal height not being a perfect multiple of line height.
    this.container.style.setProperty('--terminal-bg', background)

    const bodyEl = this.container.querySelector('.real-terminal-body') as HTMLElement
    if (bodyEl) {
      bodyEl.style.backgroundColor = background
    }

    const theme = {
      background,
      foreground,
      cursor,
      selectionBackground: 'rgba(255, 255, 255, 0.15)',
      black: '#282c34',
      red: '#e06c75',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#61afef',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#abb2bf',
      brightBlack: '#5c6370',
      brightRed: '#e06c75',
      brightGreen: '#98c379',
      brightYellow: '#e5c07b',
      brightBlue: '#61afef',
      brightMagenta: '#c678dd',
      brightCyan: '#56b6c2',
      brightWhite: '#ffffff'
    }

    this.sessions.forEach((session) => {
      session.terminal.options.fontSize = fontSize
      session.terminal.options.fontFamily = fontFamily
      session.terminal.options.lineHeight = 1.2
      session.terminal.options.theme = theme

      // Force refresh of the terminal
      session.terminal.refresh(0, session.terminal.rows - 1)
      session.fitAddon.fit()
    })
  }

  /**
   * Create a new terminal session
   */
  async createNewTerminal(shell?: string, cwd?: string, id?: string): Promise<string> {
    const sessionId = id || `terminal-${Date.now()}`

    // Fetch settings explicitly to ensure fresh values
    const settings = await window.api.invoke('settings:get')

    // Get default shell from settings if not provided
    let shellType: string = shell || 'powershell'
    if (!shell) {
      shellType = settings?.terminalDefaultShell || 'powershell'
    }

    // Get appearance settings
    const fontSize = settings?.terminalFontSize || 14
    const fontFamily = settings?.terminalFontFamily || 'Consolas, "Courier New", monospace'
    const background = settings?.terminalBackground || '#1e1e1e'
    const foreground = settings?.terminalForeground || '#cccccc'
    const cursor = settings?.terminalCursor || '#ffffff'

    // Create xterm instance
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily,
      theme: {
        background,
        foreground,
        cursor,
        selectionBackground: 'rgba(255, 255, 255, 0.15)',
        black: '#282c34',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
        brightBlack: '#5c6370',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#d670d6',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff'
      },
      lineHeight: 1.2,
      allowProposedApi: true
    })

    // Add addons
    const fitAddon = new FitAddon()
    // Explicitly handle web links using Electron's shell to avoid protocol issues
    const webLinksAddon = new WebLinksAddon((_event, url) => {
      console.log(`[RealTerminal] Opening external link: ${url}`)
      // Defensive: preload changes require a full app restart, fallback if needed
      if (typeof window.api.openExternal === 'function') {
        window.api.openExternal(url)
      } else if (typeof window.api.send === 'function') {
        window.api.send('app:open-external', url)
      } else {
        window.open(url, '_blank')
      }
    })
    const searchAddon = new SearchAddon()
    const serializeAddon = new SerializeAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.loadAddon(searchAddon)
    terminal.loadAddon(serializeAddon)

    this.setupPathLinks(terminal, cwd)

    // Hardware Acceleration: Try WebGL first, fallback to Canvas
    try {
      const webglAddon = new WebglAddon()
      terminal.loadAddon(webglAddon)
      console.log(`[RealTerminal] WebGL acceleration enabled for ${sessionId}`)
    } catch (e) {
      console.warn(`[RealTerminal] WebGL failed for ${sessionId}, falling back to Canvas`, e)
      try {
        const canvasAddon = new CanvasAddon()
        terminal.loadAddon(canvasAddon)
        console.log(`[RealTerminal] Canvas acceleration enabled for ${sessionId}`)
      } catch (e2) {
        console.warn(`[RealTerminal] All hardware acceleration failed for ${sessionId}`, e2)
      }
    }

    // Create terminal element
    const terminalElement = document.createElement('div')
    terminalElement.className = 'terminal-instance'
    terminalElement.id = `terminal-${sessionId}`
    terminalElement.style.display = 'none'

    // Open terminal
    const terminalContent = document.getElementById('terminal-content')
    if (terminalContent) {
      terminalContent.appendChild(terminalElement)

      // Ensure element is visible so fit() works
      // Ensure element is visible so fit() works
      terminalElement.style.display = 'block'

      // We create a nested container for xterm to handle padding correctly.
      // FitAddon results are based on the parent element's content box.
      const xtermContainer = document.createElement('div')
      xtermContainer.className = 'xterm-container'
      terminalElement.appendChild(xtermContainer)

      terminal.open(xtermContainer)

      // Wait for fonts and next frame to ensure accurate fit
      await document.fonts.ready
      await new Promise((r) => requestAnimationFrame(r))

      fitAddon.fit()

      // RESTORE BUFFER: If we have a saved buffer for this ID, write it now
      const savedBuffer = localStorage.getItem(`terminal_buffer_${sessionId}`)
      if (savedBuffer) {
        terminal.write(savedBuffer)
        // Add a small visual marker that this is restored history
        terminal.write('\r\n\x1b[2m--- Restored History ---\x1b[0m\r\n')
      }

      // If this is a secondary terminal being created in background, hide it again
      if (this.sessions.size > 0 && !this.isVisible) {
        terminalElement.style.display = 'none'
      }
    } else {
      const xtermContainer = document.createElement('div')
      xtermContainer.className = 'xterm-container'
      terminalElement.appendChild(xtermContainer)
      terminal.open(xtermContainer)
      await document.fonts.ready
      fitAddon.fit()

      // RESTORE BUFFER: If we have a saved buffer for this ID, write it now
      const savedBuffer = localStorage.getItem(`terminal_buffer_${sessionId}`)
      // Guard against common storage pollution ('false', 'true', 'null' strings)
      if (
        savedBuffer &&
        savedBuffer !== 'false' &&
        savedBuffer !== 'true' &&
        savedBuffer !== 'null'
      ) {
        terminal.write(savedBuffer)
        // Add a small visual marker that this is restored history
        terminal.write('\r\n\x1b[2m--- Restored History ---\x1b[0m\r\n')
      }

      // If this is a secondary terminal being created in background, hide it again
      if (this.sessions.size > 0 && !this.isVisible) {
        terminalElement.style.display = 'none'
      }

      // CRITICAL: We wait for the DOM to settle and fit the terminal BEFORE creating the backend.
      // This ensures node-pty starts with the correct dimensions, preventing the
      // "truncated copyright" (rved.) issue common in ConPTY.
      await new Promise((r) => setTimeout(r, 60))
      fitAddon.fit()
    }

    // Create terminal in main process
    try {
      // Prioritize provided cwd (e.g. from restored session) over default vault path
      const vaultPath = await this.getVaultPath()
      const workingDir = cwd || vaultPath

      // Get dimensions after fit()
      // Create terminal in main process
      await window.api.invoke(
        'terminal:create',
        sessionId,
        workingDir,
        shellType,
        terminal.cols || 80,
        terminal.rows || 24
      )

      // Setup data listener
      let initialBurst = true
      window.api.on(`terminal:data:${sessionId}`, (data: string) => {
        // Double safety for boolean pollution from IPC
        if (typeof data !== 'string') return

        terminal.write(data)

        // Anti-scroll hack: After the first data (shell header),
        // ensure we are at the bottom and the fit is definitely correct.
        if (initialBurst) {
          initialBurst = false
          // A bit longer delay for the first shell output to stabilize
          setTimeout(() => {
            fitAddon.fit()
            terminal.scrollToBottom()
            this.resizeTerminal(sessionId)
          }, 150)
        }
      })

      // Setup exit listener
      window.api.on(`terminal:exit:${sessionId}`, (exitCode: number) => {
        console.log(`Terminal ${sessionId} exited with code ${exitCode}`)

        // Don't close if we want robust reconnection, just show a message
        const sess = this.sessions.get(sessionId)
        if (sess && !this.isQuitting) {
          sess.terminal.write(
            '\r\n\x1b[31m[Process Exited] Click the session icon to restart.\x1b[0m\r\n'
          )
          // Add a visual indicator to the sidebar
          const item = document.getElementById(`session-${sessionId}`)
          if (item) item.classList.add('exited')
        } else {
          this.closeTerminal(sessionId)
        }
      })

      // Setup input handler
      terminal.onData((data) => {
        window.api.send('terminal:write', sessionId, data)
      })

      // Setup copy/paste handling
      terminal.attachCustomKeyEventHandler((event) => {
        // Ctrl+C (copy when text is selected)
        if (event.ctrlKey && event.code === 'KeyC' && terminal.hasSelection()) {
          const selectedText = terminal.getSelection()
          if (selectedText) {
            navigator.clipboard.writeText(selectedText)
          }
          return false
        }
        // Ctrl+V (paste)
        if (event.ctrlKey && event.code === 'KeyV') {
          navigator.clipboard.readText().then((text) => {
            terminal.write(text)
            window.api.send('terminal:write', sessionId, text)
          })
          return false
        }
        // Global Shortcuts that must bubble up for the App manager to see them
        // This fixes the "Terminal focused = Ctrl+J doesn't work" bug.
        const bubbleKeys = ['KeyJ', 'Backquote', 'KeyB', 'KeyP', 'Comma']
        if (event.ctrlKey && bubbleKeys.includes(event.code)) {
          return false
        }
        return true
      })

      // Mouse Paste handling (Standard terminals often use Right-click or Middle-click)
      // The user specifically asked for "left click pastes" or similar,
      // but usually contextmenu (Right-click) is safer. I'll add both/ensure it works.
      terminalElement.addEventListener('contextmenu', async (e) => {
        e.preventDefault()
        const text = await navigator.clipboard.readText()
        if (text) {
          terminal.write(text)
          window.api.send('terminal:write', sessionId, text)
        }
      })

      // Handle terminal panel resize
      const resizeObserver = new ResizeObserver(() => {
        if (terminalElement.style.display !== 'none') {
          fitAddon.fit()
        }
      })
      resizeObserver.observe(this.container)

      // Listen for terminal data
      window.api.send('terminal:listen', sessionId)

      // Load session customizations from config with error handling
      let sessionConfig: Record<string, string> = {}
      try {
        const config = (await window.api.invoke('config:get')) as Record<string, unknown>
        const terminalSessions = config?.terminalSessions as Record<string, Record<string, string>>
        sessionConfig = terminalSessions?.[sessionId] || {}
      } catch (e) {
        console.warn(`[RealTerminal] Failed to fetch config for session ${sessionId}:`, e)
      }

      // Store session with metadata for persistence
      const session: TerminalSession = {
        id: sessionId,
        terminal,
        fitAddon,
        searchAddon,
        isActive: false,
        shellType,
        cwd: workingDir,
        customName: sessionConfig.name,
        color: sessionConfig.color,
        serializeAddon
      }
      this.sessions.set(sessionId, session)

      // Add to session list UI
      this.addSessionToList(sessionId, shellType, sessionConfig.name, sessionConfig.color)

      // Update sidebar visibility
      await this.updateSidebarVisibility()

      // Save sessions to persistence if not restoring
      if (!this.isRestoring) {
        this.saveSessions()
      }

      // Switch to the new terminal immediately
      this.switchToTerminal(sessionId)

      console.log(`[RealTerminal] Created session ${sessionId}`)
      return sessionId
    } catch (error) {
      console.error(`[RealTerminal] Failed to create terminal:`, error)
      this.sessions.delete(sessionId)
      terminalElement.remove()
      throw error
    }
  }

  /**
   * Add a session to the sidebar list
   */
  private addSessionToList(
    sessionId: string,
    shellType: string,
    customName?: string,
    color?: string
  ): void {
    const sessionsList = document.getElementById('terminal-sessions-list')
    if (!sessionsList) return

    const sessionIndex = Array.from(this.sessions.keys()).indexOf(sessionId) + 1
    const displayName = customName || `${shellType} ${sessionIndex}`
    const iconColor = color || '#4ec9b0' // Default green

    const sessionItem = document.createElement('div')
    sessionItem.className = 'terminal-session-item'
    sessionItem.id = `session-${sessionId}`
    sessionItem.style.setProperty('--session-color', iconColor)
    sessionItem.draggable = true

    sessionItem.innerHTML = `
      <span class="session-icon" style="color: ${iconColor}">${this.getShellIconSVG(shellType)}</span>
      <span class="session-label" id="label-${sessionId}" title="${displayName}">${displayName}</span>
      <div class="session-actions">
        <button class="session-color-btn" data-session-id="${sessionId}" title="Change Color">
          <div class="color-dot" style="background: ${iconColor}"></div>
        </button>
        <button class="session-close" data-session-id="${sessionId}" title="Kill Terminal">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `

    this.setupDragAndDrop(sessionItem)

    sessionItem.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (
        target.closest('.session-close') ||
        target.closest('.session-color-btn') ||
        target.closest('.session-rename-input')
      ) {
        return
      }
      this.switchToTerminal(sessionId)
    })

    // Handle Rename (Double click)
    const label = sessionItem.querySelector('.session-label') as HTMLElement
    label?.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      this.renameSession(sessionId)
    })

    // Handle Color Change
    const colorBtn = sessionItem.querySelector('.session-color-btn')
    colorBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.showColorPicker(sessionId)
    })

    const closeBtn = sessionItem.querySelector('.session-close')
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.closeTerminal(sessionId)
    })

    sessionsList.appendChild(sessionItem)
  }

  /**
   * Switch to a specific terminal session
   */
  private switchToTerminal(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    // If session has exited, treat click as restart
    const item = document.getElementById(`session-${sessionId}`)
    if (item?.classList.contains('exited')) {
      this.restartSession(sessionId)
      return
    }

    // Optimization: Don't re-activate if already active (prevents "jump")
    if (!this.isSplitMode && this.activeSessionId === sessionId) {
      return
    }

    // Save active session for persistence
    localStorage.setItem('terminal_active_session', sessionId)

    if (this.isSplitMode) {
      this.handleSplitSwitch(sessionId)
      return
    }

    // Normal Switch: Hide all others
    this.sessions.forEach((s, id) => {
      s.isActive = false
      const element = document.getElementById(`terminal-${id}`)
      if (element) {
        element.style.display = 'none'
        element.classList.remove('split-active')
      }
      const sessionItem = document.getElementById(`session-${id}`)
      if (sessionItem) sessionItem.classList.remove('active', 'active-secondary')
    })

    this.activateTerminalUI(sessionId, 'primary')
    this.activeSessionId = sessionId
    this.secondaryActiveSessionId = null
  }

  private activateTerminalUI(sessionId: string, mode: 'primary' | 'secondary'): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.isActive = true
    const element = document.getElementById(`terminal-${sessionId}`)
    const sessionItem = document.getElementById(`session-${sessionId}`)

    if (element) {
      element.style.display = 'block'
      element.classList.remove('fade-in')
      void element.offsetWidth
      element.classList.add('fade-in')

      if (this.isSplitMode) {
        element.classList.add('split-active')
      }

      requestAnimationFrame(() => {
        session.fitAddon.fit()
        this.resizeTerminal(sessionId)
        requestAnimationFrame(() => {
          session.terminal.focus()
        })
      })
    }

    if (sessionItem) {
      sessionItem.classList.add(mode === 'primary' ? 'active' : 'active-secondary')
    }
  }

  private handleSplitSwitch(sessionId: string): void {
    // In split mode, the clicked session becomes primary,
    // and the old primary becomes secondary.
    if (this.activeSessionId === sessionId) return

    this.secondaryActiveSessionId = this.activeSessionId
    this.activeSessionId = sessionId

    // Update UI
    this.sessions.forEach((s, id) => {
      s.isActive = id === this.activeSessionId || id === this.secondaryActiveSessionId
      const element = document.getElementById(`terminal-${id}`)
      if (element) {
        element.style.display = s.isActive ? 'block' : 'none'
        element.classList.toggle('split-active', this.isSplitMode && s.isActive)
      }
      const item = document.getElementById(`session-${id}`)
      if (item) {
        item.classList.remove('active', 'active-secondary')
        if (id === this.activeSessionId) item.classList.add('active')
        if (id === this.secondaryActiveSessionId) item.classList.add('active-secondary')
      }
    })

    if (this.activeSessionId) this.activateTerminalUI(this.activeSessionId, 'primary')
    if (this.secondaryActiveSessionId)
      this.activateTerminalUI(this.secondaryActiveSessionId, 'secondary')

    this.updateSplitLayout()
  }

  private toggleSplitView(): void {
    this.isSplitMode = !this.isSplitMode
    const wrapper = this.container.querySelector('.real-terminal-wrapper')
    wrapper?.classList.toggle('split-mode', this.isSplitMode)

    if (this.isSplitMode) {
      // If we only have one session, nothing to split with yet
      const ids = Array.from(this.sessions.keys())
      if (ids.length > 1 && !this.secondaryActiveSessionId) {
        // Pick the second most recent or just the first available non-active
        this.secondaryActiveSessionId = ids.find((id) => id !== this.activeSessionId) || null
      }
    } else {
      this.secondaryActiveSessionId = null
    }

    if (this.activeSessionId) this.switchToTerminal(this.activeSessionId)
    this.updateSplitLayout()
  }

  private updateSplitLayout(): void {
    const content = document.getElementById('terminal-content')
    if (content) {
      content.classList.toggle('split-layout', this.isSplitMode && !!this.secondaryActiveSessionId)
    }
  }

  private async restartSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    try {
      const item = document.getElementById(`session-${sessionId}`)
      item?.classList.remove('exited')

      session.terminal.reset()
      session.terminal.write('\x1b[32m[Restarting Session...]\x1b[0m\r\n')

      const cols = session.terminal.cols || 80
      const rows = session.terminal.rows || 24
      await window.api.invoke(
        'terminal:restart',
        sessionId,
        session.cwd,
        session.shellType,
        cols,
        rows
      )
      console.log(`[RealTerminal] Session ${sessionId} restarted`)

      this.switchToTerminal(sessionId)
    } catch (err) {
      console.error(`[RealTerminal] Failed to restart session ${sessionId}:`, err)
    }
  }

  public toggleSearch(force?: boolean): void {
    const searchContainer = document.getElementById('terminal-search-container')
    const searchInput = document.getElementById('terminal-search-input') as HTMLInputElement

    const show = force !== undefined ? force : searchContainer?.style.display === 'none'

    if (searchContainer) {
      searchContainer.style.display = show ? 'flex' : 'none'
      if (show) {
        // If we are opening search, close the shell menu
        const shellMenu = document.getElementById('shell-dropdown-menu')
        if (shellMenu) shellMenu.style.display = 'none'

        searchInput?.focus()
        searchInput?.select()
      }
    }
  }

  private doSearch(term: string, direction: 'next' | 'prev' = 'next'): void {
    if (!this.activeSessionId) return
    const session = this.sessions.get(this.activeSessionId)
    if (!session) return

    if (direction === 'next') {
      session.searchAddon.findNext(term)
    } else {
      session.searchAddon.findPrevious(term)
    }
  }

  /**
   * Close a terminal session
   */
  private async closeTerminal(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    try {
      // Kill terminal in main process
      await window.api.invoke('terminal:kill', sessionId)

      // Dispose terminal
      session.terminal.dispose()

      // Remove element
      const element = document.getElementById(`terminal-${sessionId}`)
      element?.remove()

      // Remove from session list
      const sessionItem = document.getElementById(`session-${sessionId}`)
      sessionItem?.remove()

      // Remove from sessions
      this.sessions.delete(sessionId)

      // If this was the active terminal, switch to another
      if (this.activeSessionId === sessionId) {
        const remainingSessions = Array.from(this.sessions.keys())
        if (remainingSessions.length > 0) {
          this.switchToTerminal(remainingSessions[0])
        } else {
          this.activeSessionId = null
          // Automatically hide the terminal panel if no sessions are left
          this.hide()
        }
      } else if (this.sessions.size === 0) {
        // Fallback for cases where activeSessionId might have been out of sync
        this.hide()
      }

      // Update sidebar visibility
      await this.updateSidebarVisibility()

      // Save sessions to persistence if not quitting
      if (!this.isQuitting) {
        this.saveSessions()
      }

      console.log(`[RealTerminal] Closed session ${sessionId}`)
    } catch (error) {
      console.error(`[RealTerminal] Error closing terminal:`, error)
    }
  }

  public hasFocus(): boolean {
    // Check if focus is inside our container
    return this.container.contains(document.activeElement)
  }

  /**
   * Resize terminal in main process
   */
  private resizeTerminal(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const { cols, rows } = session.terminal // Notify backend
    window.api.send('terminal:resize', sessionId, cols, rows)
  }

  /**
   * Toggle terminal visibility
   */
  toggle(): boolean {
    console.log('[RealTerminal] Toggle called, current visibility:', this.isVisible)
    this.isVisible = !this.isVisible
    this.container.style.display = this.isVisible ? 'block' : 'none'

    // Persist visibility
    // Persist visibility scoped to vault
    this.getVaultPath().then((vaultPath) => {
      const key = vaultPath ? `terminal_panel_visible_${vaultPath}` : 'terminal_panel_visible'
      localStorage.setItem(key, String(this.isVisible))
    })

    console.log(
      '[RealTerminal] New visibility:',
      this.isVisible,
      'display:',
      this.container.style.display
    )

    if (this.isVisible) {
      // Create first terminal if none exist (and we didn't just restore any)
      if (this.sessions.size === 0) {
        console.log('[RealTerminal] Creating first terminal session')
        this.createNewTerminal()
      } else if (this.activeSessionId) {
        // Focus active terminal
        const session = this.sessions.get(this.activeSessionId)
        if (session) {
          // Use setTimeout to allow layout to settle and prevent ResizeObserver loops
          // when switching to absolute positioning overlays
          setTimeout(() => {
            session.fitAddon.fit()
            this.resizeTerminal(this.activeSessionId!)
            session.terminal.focus()
          }, 10)
        }
      }
    }

    return this.isVisible
  }

  /**
   * Show terminal
   */
  show(): void {
    if (!this.isVisible) {
      this.toggle()
    }
  }

  /**
   * Hide terminal
   */
  hide(): void {
    if (this.isVisible) {
      this.toggle()
    }
  }

  /**
   * Check if terminal is visible
   */
  isOpen(): boolean {
    return this.isVisible
  }

  /**
   * Cleanup all terminals
   */
  destroy(): void {
    this.sessions.forEach((_, id) => {
      this.closeTerminal(id)
    })
  }

  /**
   * Update sidebar visibility based on number of sessions and user preference
   */
  private async updateSidebarVisibility(): Promise<void> {
    const wrapper = this.container.querySelector('.real-terminal-wrapper')
    if (wrapper) {
      const settings = await window.api.invoke('settings:get')

      // If the user has explicitly set a preference, honor it absolutely
      if (typeof settings?.terminalSidebarVisible === 'boolean') {
        if (settings.terminalSidebarVisible) {
          wrapper.classList.remove('sidebar-hidden')
        } else {
          wrapper.classList.add('sidebar-hidden')
        }
        return
      }

      // Otherwise, default to "auto" mode:
      // Show sidebar if there's more than one session, otherwise hide it to save space
      if (this.sessions.size > 1) {
        wrapper.classList.remove('sidebar-hidden')
      } else {
        wrapper.classList.add('sidebar-hidden')
      }
    }
  }

  /**
   * Toggle sidebar visibility manually
   */
  private async toggleSidebar(): Promise<void> {
    const wrapper = this.container.querySelector('.real-terminal-wrapper')
    if (wrapper) {
      const isHidden = wrapper.classList.contains('sidebar-hidden')
      // If currently hidden, we want it visible (true). If visible, we want it hidden (false).
      await window.api.invoke('settings:update', { terminalSidebarVisible: isHidden })
      await this.updateSidebarVisibility()
    }
  }

  /**
   * Save current terminal sessions to local storage
   */
  public saveSessions(vaultPathOverride?: string): void {
    if (this.isRestoring || this.isQuitting) return

    const vaultPath = vaultPathOverride || state.vaultPath

    // Strict Scope: Do not save sessions if we don't have a valid vault path.
    // This prevents writing to a global key that could be picked up by other projects.
    if (!vaultPath) return

    const key = `terminal_sessions_${vaultPath}`

    const sessionData = Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      shellType: session.shellType || 'powershell',
      cwd: session.cwd || ''
    }))
    localStorage.setItem(key, JSON.stringify(sessionData))
    // Also save the active session ID scoped
    if (this.activeSessionId) {
      localStorage.setItem(`terminal_active_${vaultPath}`, this.activeSessionId)
    }

    // Save buffers for each session (last 1000 lines)
    this.sessions.forEach((session, id) => {
      try {
        const buffer = session.serializeAddon.serialize()
        localStorage.setItem(`terminal_buffer_${id}`, buffer)
      } catch (err) {
        console.error(`[RealTerminal] Failed to save buffer for ${id}:`, err)
      }
    })

    console.log(`[RealTerminal] Saved ${sessionData.length} sessions to persistence (${key})`)
  }

  /**
   * Restore terminal sessions from local storage
   */
  private async restoreSessions(): Promise<void> {
    // Determine the key based on current vault path to avoid cross-project pollution
    const vaultPath = await this.getVaultPath()

    // Strict Scope: If we don't know the vault, we cannot restore sessions safely.
    // Do NOT fallback to global storage.
    if (!vaultPath) {
      return
    }

    const key = `terminal_sessions_${vaultPath}`

    const saved = localStorage.getItem(key)
    /* 
       If no specific session is found, do NOT fallback to global 'terminal_sessions' 
       because that causes the "ghost session from other project" bug.
       Better to start fresh in a new/untracked vault.
    */
    if (!saved) {
      // Update our tracker even if no sessions found, to ensure next save is correct
      // (Removed unused tracker)
      return
    }

    this.isRestoring = true
    try {
      const sessionData = JSON.parse(saved)
      if (Array.isArray(sessionData)) {
        console.log(`[RealTerminal] Restoring ${sessionData.length} sessions from ${key}...`)

        // Filter out any stray docker-desktop sessions from the restoration list
        const filteredData = (
          sessionData as Array<{ shellType?: string; cwd?: string; id: string }>
        ).filter((data) => {
          const shell = (data.shellType || '').toLowerCase()
          return !shell.includes('docker') && !shell.includes('desktop')
        })

        if (filteredData.length < sessionData.length) {
          console.log(
            `[RealTerminal] Filtered out ${sessionData.length - filteredData.length} invalid sessions.`
          )
        }

        // Use a for...of loop with individual try/catch to ensure one failure doesn't stop others
        const restoredIds: string[] = []
        for (const data of filteredData) {
          try {
            await this.createNewTerminal(data.shellType, data.cwd, data.id)
            restoredIds.push(data.id)
          } catch (err) {
            console.error(`[RealTerminal] Failed to restore session ${data.id}:`, err)
          }
        }

        // Restore active session
        const activeKey = `terminal_active_${vaultPath}`
        const activeId = localStorage.getItem(activeKey)
        if (activeId && this.sessions.has(activeId)) {
          this.switchToTerminal(activeId)
        } else if (this.sessions.size > 0) {
          const firstId = this.sessions.keys().next().value
          if (firstId) this.switchToTerminal(firstId)
        }

        // Final verification: if we restored fewer sessions than we were supposed to,
        // we should still keep the others in localStorage for the next attempt
        // OR we should at least log it.
        if (restoredIds.length < sessionData.length) {
          console.warn(
            `[RealTerminal] Only restored ${restoredIds.length} out of ${sessionData.length} sessions.`
          )
        }
      }
    } catch (error) {
      console.error('[RealTerminal] Failed to parse saved sessions:', error)
    } finally {
      this.isRestoring = false
      // Save the final state once after all restorations are done (or attempted)
      this.saveSessions()
    }
  }

  /**
   * Rename a terminal session
   */
  private renameSession(sessionId: string): void {
    const label = document.getElementById(`label-${sessionId}`)
    if (!label) return

    const currentName = label.textContent || ''
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'session-rename-input'
    input.value = currentName

    let isSaving = false
    const saveRename = async (): Promise<void> => {
      if (isSaving) return
      isSaving = true

      const newName = input.value.trim() || currentName
      label.textContent = newName
      if (input.parentNode) {
        input.replaceWith(label)
      }

      // Update session object
      const session = this.sessions.get(sessionId)
      if (session) {
        session.customName = newName
      }

      // Save to config
      try {
        const config = await window.api.invoke('config:get')
        const terminalSessions = config.terminalSessions || {}
        terminalSessions[sessionId] = {
          ...terminalSessions[sessionId],
          name: newName
        }
        await window.api.invoke('config:update', { terminalSessions })
      } catch (err) {
        console.error('[RealTerminal] Failed to save name:', err)
      }
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        saveRename()
      }
      if (e.key === 'Escape') {
        isSaving = true // Prevent saveRename on blur
        if (input.parentNode) {
          input.replaceWith(label)
        }
      }
    })

    input.addEventListener('blur', () => {
      saveRename()
    })

    label.replaceWith(input)
    setTimeout(() => {
      input.focus()
      input.select()
    }, 50)
  }

  /**
   * Show a color picker for session
   */
  private async showColorPicker(sessionId: string): Promise<void> {
    const colors = ['#4ec9b0', '#cd3131', '#2472c8', '#e5e510', '#bc3fbc', '#11a8cd', '#ffffff']
    const session = this.sessions.get(sessionId)
    if (!session) return

    const currentColor = session.color || '#4ec9b0'
    const currentIndex = colors.indexOf(currentColor)
    const nextIndex = (currentIndex + 1) % colors.length
    const nextColor = colors[nextIndex]

    // Update UI
    const sessionItem = document.getElementById(`session-${sessionId}`)
    if (sessionItem) {
      sessionItem.style.setProperty('--session-color', nextColor)
      const icon = sessionItem.querySelector('.session-icon') as HTMLElement
      const dot = sessionItem.querySelector('.color-dot') as HTMLElement
      if (icon) icon.style.color = nextColor
      if (dot) dot.style.background = nextColor
    }

    // Update session
    session.color = nextColor

    // Save to config
    const config = await window.api.invoke('config:get')
    const terminalSessions = config.terminalSessions || {}
    terminalSessions[sessionId] = {
      ...terminalSessions[sessionId],
      color: nextColor
    }
    await window.api.invoke('config:update', { terminalSessions })
  }

  /**
   * Setup drag and drop for session reordering
   */
  private setupDragAndDrop(item: HTMLElement): void {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', item.id)
      item.classList.add('dragging')
    })

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging')
      this.saveSessions()
    })

    const list = document.getElementById('terminal-sessions-list')
    list?.addEventListener('dragover', (e) => {
      e.preventDefault()
      const draggingItem = document.querySelector('.dragging') as HTMLElement
      if (!draggingItem) return

      const siblings = Array.from(list.querySelectorAll('.terminal-session-item:not(.dragging)'))
      const nextSibling = siblings.find((sibling) => {
        const rect = sibling.getBoundingClientRect()
        return e.clientY <= rect.top + rect.height / 2
      })

      if (nextSibling) {
        list.insertBefore(draggingItem, nextSibling)
      } else {
        list.appendChild(draggingItem)
      }
    })
  }

  /**
   * Get current vault path
   */
  private async getVaultPath(): Promise<string | undefined> {
    try {
      // Try to get vault path from window API
      const vaultPath = await window.api.invoke('vault:get-path')
      return vaultPath
    } catch (error) {
      console.warn('[RealTerminal] Could not get vault path:', error)
      return undefined
    }
  }

  /**
   * Setup interactive link provider for file paths
   */
  private setupPathLinks(terminal: Terminal, cwd?: string): void {
    terminal.registerLinkProvider({
      provideLinks: (bufferLine: any, callback: (links: ILink[] | undefined) => void) => {
        // Use a safe way to get the line text, supporting different xterm versions
        const line =
          typeof bufferLine === 'object' && bufferLine.translateToString
            ? bufferLine.translateToString(true)
            : terminal.buffer.active.getLine(bufferLine as number)?.translateToString(true) || ''

        // Detection regex for common path patterns - improved boundary checks to avoid matching URLs
        const pathRegex =
          /(((?:\/|\b[A-Za-z]:[\\/])[\w\-.\\/]+)|(\.\.?[\/][\w\-.\\/]+))(:\d+)?(:\d+)?/g

        const links: ILink[] = []
        let match: RegExpExecArray | null
        while ((match = pathRegex.exec(line)) !== null) {
          const matchedPath = match[1]
          const lineNum = match[4] ? parseInt(match[4].slice(1)) : 1

          // NEW: Heuristic to avoid overlapping with URLs (http://, etc)
          // If the match is preceded by 'http:' or 'https:' or is part of a '//', skip it.
          const beforeMatch = line.slice(Math.max(0, match.index - 8), match.index).toLowerCase()
          if (
            beforeMatch.includes('http') ||
            beforeMatch.includes('://') ||
            beforeMatch.endsWith('/')
          ) {
            continue
          }

          links.push({
            range: {
              start: { x: match.index + 1, y: 1 },
              end: { x: match.index + match[0].length, y: 1 }
            },
            text: match[0],
            activate: () => {
              void this.handlePathClick(matchedPath, lineNum, cwd)
            }
          })
        }
        callback(links)
      }
    })
  }

  /**
   * Resolve a clicked path and try to open it
   */
  private async handlePathClick(
    pathStr: string,
    _lineNum: number,
    sessionCwd?: string
  ): Promise<void> {
    try {
      const vaultPath = await this.getVaultPath()
      if (!vaultPath) return

      let fullPath = pathStr
      const isAbs = await window.api.path.isAbsolute(pathStr)

      if (!isAbs) {
        // Resolve relative to session CWD or vault root
        const base = sessionCwd || vaultPath
        fullPath = await window.api.path.join(base, pathStr)
      }

      // Check if it exists
      const exists = await window.api.path.exists(fullPath)
      if (!exists) {
        console.warn(`[RealTerminal] Path does not exist: ${fullPath}`)
        return
      }

      // Normalize for comparison
      const normalizedPath = fullPath.replace(/\\/g, '/')
      const normalizedVaultRoot = vaultPath.replace(/\\/g, '/')

      // If it's inside the vault, open in our editor
      if (normalizedPath.startsWith(normalizedVaultRoot)) {
        // Get relative path from vault root
        const relativePath = normalizedPath
          .substring(normalizedVaultRoot.length)
          .replace(/^[\\/]/, '')

        // Find if this note exists in state
        const note = state.notes.find(
          (n: any) =>
            n.path === relativePath ||
            n.path ===
              (relativePath.includes('/')
                ? relativePath.replace(/\//g, '\\')
                : relativePath.replace(/\\/g, '/'))
        )
        if (note && this.onNoteSelect) {
          this.onNoteSelect(note.id, note.path)
        } else {
          // Not in notes list (maybe hidden or not a note), try reveal in vault anyway
          window.api.revealVault(fullPath)
        }
      } else {
        // Outside vault, reveal in explorer
        window.api.revealVault(fullPath)
      }
    } catch (err) {
      console.error('[RealTerminal] Failed to handle path click:', err)
    }
  }
}
