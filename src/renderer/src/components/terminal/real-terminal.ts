import { Terminal, ILink } from '@xterm/xterm'
import { state } from '../../core/state'
import { ConsoleComponent } from '../console/console'
import { TerminalSessionManager } from './terminal-session.manager'
import { TerminalUiManager } from './terminal-ui.manager'
import { TerminalSearchManager } from './terminal-search.manager'
import { TerminalShellService } from './terminal-shell.service'
import { TERMINAL_CONSTANTS, STORAGE_KEYS, TerminalSession } from './terminal.types'

import '@xterm/xterm/css/xterm.css'
import './real-terminal.css'

export class RealTerminalComponent {
  private container: HTMLElement
  private terminalContainer: HTMLElement
  private sessionManager: TerminalSessionManager
  private uiManager: TerminalUiManager
  private searchManager!: TerminalSearchManager
  private shellService: TerminalShellService

  private isVisible: boolean = false
  private isRestoring: boolean = false
  private isQuitting: boolean = false
  private isSplitMode: boolean = false
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

    this.sessionManager = new TerminalSessionManager()
    this.shellService = new TerminalShellService()
    this.uiManager = new TerminalUiManager(this.container, this.shellService)

    this.init()
  }

  private async init(): Promise<void> {
    const availableShells = await this.shellService.getAvailableShells()
    this.container.innerHTML = this.uiManager.renderHeader(availableShells)

    // Embed Console
    this.initConsoleEmbedding()

    // Setup search manager after render
    this.searchManager = new TerminalSearchManager(this.container)

    // Get initial path BEFORE attaching listeners to avoid redundant switch on startup
    const path = await this.getVaultPath()
    this.lastVaultPath = path || null

    this.setupEventListeners()
    await this.restoreSessions()

    // Restore visibility if it was open (Scoped to vault)
    const vaultPath = await this.getVaultPath()
    const visibilityKey = vaultPath
      ? `terminal_panel_visible_${vaultPath}`
      : STORAGE_KEYS.TERMINAL_PANEL_VISIBLE
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
    }, TERMINAL_CONSTANTS.FIT_DELAY)
  }

  private fitAll(): void {
    this.sessionManager.getSessions().forEach((session, id) => {
      if (this.isVisible) {
        try {
          session.fitAddon.fit()
          this.resizeTerminal(id)
        } catch (err) {
          console.warn('[RealTerminal] Fit failed:', err)
        }
      }
    })
  }

  setNoteSelectHandler(handler: (id: string, path?: string) => void): void {
    this.onNoteSelect = handler
  }

  private initConsoleEmbedding(): void {
    const consoleEl = document.querySelector('.hub-console')
    const host = this.container.querySelector('#real-terminal-console-host')

    if (consoleEl && host) {
      host.appendChild(consoleEl)
      consoleEl.classList.add('hub-console--embedded')
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
    const tabKey = this.lastVaultPath
      ? `terminal_active_tab_${this.lastVaultPath}`
      : 'terminal_active_tab'
    localStorage.setItem(tabKey, view)

    this.uiManager.updateTabs(view)

    if (view === 'terminal') {
      const activeId = this.sessionManager.getActiveSessionId()
      if (activeId) {
        this.sessionManager.getSession(activeId)?.terminal.focus()
      }
    } else {
      if (this.hubConsole) {
        this.hubConsole.setVisible(true)
      }
      const input = this.container.querySelector('.hub-console__input') as HTMLElement
      input?.focus()
    }
  }

  private setupEventListeners(): void {
    this.uiManager.setupResizing(() => this.fitAll())

    const tabs = this.container.querySelectorAll('.terminal-tab')
    tabs.forEach((t) => {
      t.addEventListener('click', (e) => {
        const view = (e.currentTarget as HTMLElement).dataset.tab as 'terminal' | 'console'
        if (view) this.switchView(view)
      })
    })

    document.getElementById('new-terminal-btn')?.addEventListener('click', () => {
      this.createNewTerminal()
    })

    const shellMenuTrigger = document.getElementById('shell-menu-trigger')
    const shellMenu = document.getElementById('shell-dropdown-menu')

    shellMenuTrigger?.addEventListener('click', (e) => {
      e.stopPropagation()
      const isVisible = shellMenu?.style.display === 'block'
      if (shellMenu) shellMenu.style.display = isVisible ? 'none' : 'block'
      if (!isVisible) this.searchManager.toggle(false)
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

    document.getElementById('toggle-sidebar-btn')?.addEventListener('click', () => {
      this.toggleSidebar()
    })

    document.getElementById('close-terminal-btn')?.addEventListener('click', () => this.toggle())

    document.getElementById('toggle-search-btn')?.addEventListener('click', () => {
      const isNowVisible = this.searchManager.toggle()
      if (isNowVisible && shellMenu) shellMenu.style.display = 'none'
    })

    document
      .getElementById('search-close')
      ?.addEventListener('click', () => this.searchManager.toggle(false))

    const searchInput = document.getElementById('terminal-search-input') as HTMLInputElement
    searchInput?.addEventListener('input', () => {
      this.searchManager.doSearch(this.getActiveSession(), searchInput.value)
    })

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.searchManager.doSearch(
          this.getActiveSession(),
          searchInput.value,
          e.shiftKey ? 'prev' : 'next'
        )
      }
      if (e.key === 'Escape') {
        this.searchManager.toggle(false)
      }
    })

    document
      .getElementById('search-prev')
      ?.addEventListener('click', () =>
        this.searchManager.doSearch(this.getActiveSession(), searchInput.value, 'prev')
      )
    document
      .getElementById('search-next')
      ?.addEventListener('click', () =>
        this.searchManager.doSearch(this.getActiveSession(), searchInput.value, 'next')
      )

    document.getElementById('split-terminal-btn')?.addEventListener('click', () => {
      this.toggleSplitView()
    })

    document.getElementById('trash-terminal-btn')?.addEventListener('click', () => {
      const activeId = this.sessionManager.getActiveSessionId()
      if (activeId) this.closeTerminal(activeId)
    })

    window.addEventListener('resize', () => this.debounceFitAll())
    window.addEventListener('focus', () => {
      if (this.isVisible) this.fitAll()
    })

    window.addEventListener('beforeunload', () => {
      this.isQuitting = true
      this.sessionManager.getSessions().forEach((s) => {
        try {
          if (window.api?.invoke) window.api.invoke('terminal:kill', s.id)
        } catch (e) {}
      })
      this.sessionManager.clear()
    })

    window.addEventListener('vault-changed', () => {
      void this.handleVaultSwitch()
    })
  }

  private getActiveSession(): TerminalSession | undefined {
    const activeId = this.sessionManager.getActiveSessionId()
    return activeId ? this.sessionManager.getSession(activeId) : undefined
  }

  private async handleVaultSwitch(): Promise<void> {
    if (this.isRestoring) return

    const newPath = await this.getVaultPath()
    if (!newPath || this.lastVaultPath === newPath) return

    if (this.lastVaultPath) {
      this.saveSessions(this.lastVaultPath)
    }

    this.lastVaultPath = newPath
    await this.cleanupAllSessions()
    await this.restoreSessions()

    if (this.sessionManager.getSessions().size === 0) {
      await this.createNewTerminal()
    }
  }

  private async cleanupAllSessions(): Promise<void> {
    const ids = Array.from(this.sessionManager.getSessions().keys())
    for (const id of ids) {
      try {
        await window.api.invoke('terminal:kill', id)
      } catch (err) {}

      this.sessionManager.removeSession(id)
      document.getElementById(`terminal-${id}`)?.remove()
      document.getElementById(`session-${id}`)?.remove()
    }

    this.sessionManager.clear()
    const list = document.getElementById('terminal-sessions-list')
    if (list) list.innerHTML = ''
  }

  public async applySettings(settings: any): Promise<void> {
    if (!settings) return
    this.uiManager.applyTheme(settings)

    const theme = {
      background: settings.terminalBackground || TERMINAL_CONSTANTS.DEFAULT_BACKGROUND,
      foreground: settings.terminalForeground || TERMINAL_CONSTANTS.DEFAULT_FOREGROUND,
      cursor: settings.terminalCursor || TERMINAL_CONSTANTS.DEFAULT_CURSOR,
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

    this.sessionManager.getSessions().forEach((session) => {
      session.terminal.options.fontSize =
        settings.terminalFontSize || TERMINAL_CONSTANTS.DEFAULT_FONT_SIZE
      session.terminal.options.fontFamily =
        settings.terminalFontFamily || TERMINAL_CONSTANTS.DEFAULT_FONT_FAMILY
      session.terminal.options.theme = theme
      session.terminal.refresh(0, session.terminal.rows - 1)
      session.fitAddon.fit()
    })
  }

  async createNewTerminal(shell?: string, cwd?: string, id?: string): Promise<string> {
    const sessionId = id || `terminal-${Date.now()}`
    const settings = await window.api.invoke('settings:get')
    const shellType = shell || settings?.terminalDefaultShell || 'powershell'

    const terminal = this.sessionManager.createXtermInstance(settings)
    const addons = this.sessionManager.loadAddons(terminal)

    this.setupPathLinks(terminal, cwd)

    const terminalElement = document.createElement('div')
    terminalElement.className = 'terminal-instance'
    terminalElement.id = `terminal-${sessionId}`
    terminalElement.style.display = 'none'

    const terminalContent = document.getElementById('terminal-content')
    if (terminalContent) {
      terminalContent.appendChild(terminalElement)
      terminalElement.style.display = 'block'
      const xtermContainer = document.createElement('div')
      xtermContainer.className = 'xterm-container'
      terminalElement.appendChild(xtermContainer)
      terminal.open(xtermContainer)

      await document.fonts.ready
      await new Promise((r) => requestAnimationFrame(r))
      addons.fitAddon.fit()

      const savedBuffer = localStorage.getItem(`${STORAGE_KEYS.TERMINAL_BUFFER_PREFIX}${sessionId}`)
      if (savedBuffer && !['false', 'true', 'null'].includes(savedBuffer)) {
        terminal.write(savedBuffer)
        terminal.write(TERMINAL_CONSTANTS.RESTORE_MARKER)
      }

      if (this.sessionManager.getSessions().size > 0 && !this.isVisible) {
        terminalElement.style.display = 'none'
      }
    }

    try {
      const workingDir = cwd || (await this.getVaultPath())
      await window.api.invoke(
        'terminal:create',
        sessionId,
        workingDir,
        shellType,
        terminal.cols || 80,
        terminal.rows || 24
      )

      let initialBurst = true
      window.api.on(`terminal:data:${sessionId}`, (data: string) => {
        if (typeof data !== 'string') return
        terminal.write(data)
        if (initialBurst) {
          initialBurst = false
          setTimeout(() => {
            addons.fitAddon.fit()
            terminal.scrollToBottom()
            this.resizeTerminal(sessionId)
          }, 150)
        }
      })

      window.api.on(`terminal:exit:${sessionId}`, () => {
        const sess = this.sessionManager.getSession(sessionId)
        if (sess && !this.isQuitting) {
          sess.terminal.write(TERMINAL_CONSTANTS.EXIT_MESSAGE)
          document.getElementById(`session-${sessionId}`)?.classList.add('exited')
        } else {
          this.closeTerminal(sessionId)
        }
      })

      terminal.onData((data) => window.api.send('terminal:write', sessionId, data))

      terminal.attachCustomKeyEventHandler((event) => {
        if (event.ctrlKey && event.code === 'KeyC' && terminal.hasSelection()) {
          navigator.clipboard.writeText(terminal.getSelection())
          return false
        }
        if (event.ctrlKey && event.code === 'KeyV') {
          navigator.clipboard.readText().then((text) => {
            terminal.write(text)
            window.api.send('terminal:write', sessionId, text)
          })
          return false
        }
        const bubbleKeys = ['KeyJ', 'Backquote', 'KeyB', 'KeyP', 'Comma']
        if (event.ctrlKey && bubbleKeys.includes(event.code)) return false
        return true
      })

      terminalElement.addEventListener('contextmenu', async (e) => {
        e.preventDefault()
        const text = await navigator.clipboard.readText()
        if (text) {
          terminal.write(text)
          window.api.send('terminal:write', sessionId, text)
        }
      })

      window.api.send('terminal:listen', sessionId)

      const config = await window.api.invoke('config:get')
      const sessionConfig = config?.terminalSessions?.[sessionId] || {}

      const session: TerminalSession = {
        id: sessionId,
        terminal,
        fitAddon: addons.fitAddon,
        searchAddon: addons.searchAddon,
        serializeAddon: addons.serializeAddon,
        isActive: false,
        shellType,
        cwd: workingDir,
        customName: sessionConfig.name,
        color: sessionConfig.color
      }

      this.sessionManager.addSession(sessionId, session)
      this.addSessionToList(sessionId, shellType, sessionConfig.name, sessionConfig.color)
      await this.updateSidebarVisibility()

      if (!this.isRestoring) this.saveSessions()
      this.switchToTerminal(sessionId)

      return sessionId
    } catch (error) {
      console.error(`[RealTerminal] Failed to create terminal:`, error)
      this.sessionManager.removeSession(sessionId)
      terminalElement.remove()
      throw error
    }
  }

  private addSessionToList(
    sessionId: string,
    shellType: string,
    customName?: string,
    color?: string
  ): void {
    const sessionsList = document.getElementById('terminal-sessions-list')
    if (!sessionsList) return

    const sessionIndex = Array.from(this.sessionManager.getSessions().keys()).indexOf(sessionId) + 1
    const displayName = customName || this.shellService.getShellDisplayName(shellType, sessionIndex)
    const iconColor = color || TERMINAL_CONSTANTS.DEFAULT_SESSION_COLOR

    const sessionItem = document.createElement('div')
    sessionItem.className = 'terminal-session-item'
    sessionItem.id = `session-${sessionId}`
    sessionItem.style.setProperty('--session-color', iconColor)
    sessionItem.draggable = true

    sessionItem.innerHTML = `
      <span class="session-icon" style="color: ${iconColor}">${this.shellService.getShellIconSVG(shellType)}</span>
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
      )
        return
      this.switchToTerminal(sessionId)
    })

    sessionItem.querySelector('.session-label')?.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      this.renameSession(sessionId)
    })

    sessionItem.querySelector('.session-color-btn')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.showColorPicker(sessionId)
    })

    sessionItem.querySelector('.session-close')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.closeTerminal(sessionId)
    })

    sessionsList.appendChild(sessionItem)
  }

  private switchToTerminal(sessionId: string): void {
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return

    if (document.getElementById(`session-${sessionId}`)?.classList.contains('exited')) {
      this.restartSession(sessionId)
      return
    }

    if (!this.isSplitMode && this.sessionManager.getActiveSessionId() === sessionId) return

    localStorage.setItem(STORAGE_KEYS.TERMINAL_ACTIVE_SESSION, sessionId)

    if (this.isSplitMode) {
      this.handleSplitSwitch(sessionId)
      return
    }

    this.sessionManager.getSessions().forEach((s, id) => {
      s.isActive = false
      const el = document.getElementById(`terminal-${id}`)
      if (el) {
        el.style.display = 'none'
        el.classList.remove('split-active')
      }
      document.getElementById(`session-${id}`)?.classList.remove('active', 'active-secondary')
    })

    this.activateTerminalUI(sessionId, 'primary')
    this.sessionManager.setActiveSessionId(sessionId)
    this.sessionManager.setSecondaryActiveSessionId(null)
  }

  private activateTerminalUI(sessionId: string, mode: 'primary' | 'secondary'): void {
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return

    session.isActive = true
    const element = document.getElementById(`terminal-${sessionId}`)
    const sessionItem = document.getElementById(`session-${sessionId}`)

    if (element) {
      element.style.display = 'block'
      element.classList.remove('fade-in')
      void element.offsetWidth
      element.classList.add('fade-in')
      if (this.isSplitMode) element.classList.add('split-active')

      requestAnimationFrame(() => {
        session.fitAddon.fit()
        this.resizeTerminal(sessionId)
        requestAnimationFrame(() => session.terminal.focus())
      })
    }

    if (sessionItem) sessionItem.classList.add(mode === 'primary' ? 'active' : 'active-secondary')
  }

  private handleSplitSwitch(sessionId: string): void {
    if (this.sessionManager.getActiveSessionId() === sessionId) return

    this.sessionManager.setSecondaryActiveSessionId(this.sessionManager.getActiveSessionId())
    this.sessionManager.setActiveSessionId(sessionId)

    this.sessionManager.getSessions().forEach((s, id) => {
      const activeId = this.sessionManager.getActiveSessionId()
      const secondaryId = this.sessionManager.getSecondaryActiveSessionId()
      s.isActive = id === activeId || id === secondaryId
      const element = document.getElementById(`terminal-${id}`)
      if (element) {
        element.style.display = s.isActive ? 'block' : 'none'
        element.classList.toggle('split-active', this.isSplitMode && s.isActive)
      }
      const item = document.getElementById(`session-${id}`)
      if (item) {
        item.classList.remove('active', 'active-secondary')
        if (id === activeId) item.classList.add('active')
        if (id === secondaryId) item.classList.add('active-secondary')
      }
    })

    const activeId = this.sessionManager.getActiveSessionId()
    const secondaryId = this.sessionManager.getSecondaryActiveSessionId()
    if (activeId) this.activateTerminalUI(activeId, 'primary')
    if (secondaryId) this.activateTerminalUI(secondaryId, 'secondary')

    this.updateSplitLayout()
  }

  private toggleSplitView(): void {
    this.isSplitMode = !this.isSplitMode
    this.container
      .querySelector('.real-terminal-wrapper')
      ?.classList.toggle('split-mode', this.isSplitMode)

    if (this.isSplitMode) {
      const ids = Array.from(this.sessionManager.getSessions().keys())
      if (ids.length > 1 && !this.sessionManager.getSecondaryActiveSessionId()) {
        const activeId = this.sessionManager.getActiveSessionId()
        this.sessionManager.setSecondaryActiveSessionId(ids.find((id) => id !== activeId) || null)
      }
    } else {
      this.sessionManager.setSecondaryActiveSessionId(null)
    }

    const activeId = this.sessionManager.getActiveSessionId()
    if (activeId) this.switchToTerminal(activeId)
    this.updateSplitLayout()
  }

  private updateSplitLayout(): void {
    const content = document.getElementById('terminal-content')
    if (content) {
      content.classList.toggle(
        'split-layout',
        this.isSplitMode && !!this.sessionManager.getSecondaryActiveSessionId()
      )
    }
  }

  private async restartSession(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return
    try {
      document.getElementById(`session-${sessionId}`)?.classList.remove('exited')
      session.terminal.reset()
      session.terminal.write('\x1b[32m[Restarting Session...]\x1b[0m\r\n')
      await window.api.invoke(
        'terminal:restart',
        sessionId,
        session.cwd,
        session.shellType,
        session.terminal.cols || 80,
        session.terminal.rows || 24
      )
      this.switchToTerminal(sessionId)
    } catch (err) {}
  }

  private async closeTerminal(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return

    try {
      await window.api.invoke('terminal:kill', sessionId)
      this.sessionManager.removeSession(sessionId)
      document.getElementById(`terminal-${sessionId}`)?.remove()
      document.getElementById(`session-${sessionId}`)?.remove()

      if (this.sessionManager.getActiveSessionId() === sessionId) {
        const remaining = Array.from(this.sessionManager.getSessions().keys())
        if (remaining.length > 0) this.switchToTerminal(remaining[0])
        else this.hide()
      } else if (this.sessionManager.getSessions().size === 0) {
        this.hide()
      }

      await this.updateSidebarVisibility()
      if (!this.isQuitting) this.saveSessions()
    } catch (error) {}
  }

  public toggleSearch(force?: boolean): void {
    this.searchManager.toggle(force)
  }

  public hasFocus(): boolean {
    return this.container.contains(document.activeElement)
  }

  private resizeTerminal(sessionId: string): void {
    const session = this.sessionManager.getSession(sessionId)
    if (session) {
      window.api.send('terminal:resize', sessionId, session.terminal.cols, session.terminal.rows)
    }
  }

  toggle(): boolean {
    this.isVisible = !this.isVisible
    this.container.style.display = this.isVisible ? 'block' : 'none'

    this.getVaultPath().then((vaultPath) => {
      const key = vaultPath
        ? `terminal_panel_visible_${vaultPath}`
        : STORAGE_KEYS.TERMINAL_PANEL_VISIBLE
      localStorage.setItem(key, String(this.isVisible))
    })

    if (this.isVisible) {
      if (this.sessionManager.getSessions().size === 0) {
        this.createNewTerminal()
      } else {
        const activeId = this.sessionManager.getActiveSessionId()
        if (activeId) {
          const session = this.sessionManager.getSession(activeId)
          if (session) {
            setTimeout(() => {
              session.fitAddon.fit()
              this.resizeTerminal(activeId)
              session.terminal.focus()
            }, 10)
          }
        }
      }
    }
    return this.isVisible
  }

  show(): void {
    if (!this.isVisible) this.toggle()
  }
  hide(): void {
    if (this.isVisible) this.toggle()
  }
  isOpen(): boolean {
    return this.isVisible
  }

  destroy(): void {
    this.sessionManager.getSessions().forEach((_, id) => this.closeTerminal(id))
  }

  private async updateSidebarVisibility(): Promise<void> {
    const wrapper = this.container.querySelector('.real-terminal-wrapper')
    if (!wrapper) return
    const settings = await window.api.invoke('settings:get')
    if (typeof settings?.terminalSidebarVisible === 'boolean') {
      wrapper.classList.toggle('sidebar-hidden', !settings.terminalSidebarVisible)
    } else {
      wrapper.classList.toggle('sidebar-hidden', this.sessionManager.getSessions().size <= 1)
    }
  }

  private async toggleSidebar(): Promise<void> {
    const wrapper = this.container.querySelector('.real-terminal-wrapper')
    if (wrapper) {
      const isHidden = wrapper.classList.contains('sidebar-hidden')
      await window.api.invoke('settings:update', { terminalSidebarVisible: isHidden })
      await this.updateSidebarVisibility()
    }
  }

  public saveSessions(vaultPathOverride?: string): void {
    if (this.isRestoring || this.isQuitting) return
    const vaultPath = vaultPathOverride || state.vaultPath
    if (!vaultPath) return

    const sessionData = Array.from(this.sessionManager.getSessions().entries()).map(
      ([id, session]) => ({
        id,
        shellType: session.shellType,
        cwd: session.cwd
      })
    )
    localStorage.setItem(`terminal_sessions_${vaultPath}`, JSON.stringify(sessionData))
    const activeId = this.sessionManager.getActiveSessionId()
    if (activeId) localStorage.setItem(`terminal_active_${vaultPath}`, activeId)

    this.sessionManager.getSessions().forEach((session, id) => {
      try {
        localStorage.setItem(
          `${STORAGE_KEYS.TERMINAL_BUFFER_PREFIX}${id}`,
          session.serializeAddon.serialize()
        )
      } catch (err) {}
    })
  }

  private async restoreSessions(): Promise<void> {
    const vaultPath = await this.getVaultPath()
    if (!vaultPath) return
    const saved = localStorage.getItem(`terminal_sessions_${vaultPath}`)
    if (!saved) return

    this.isRestoring = true
    try {
      const sessionData = JSON.parse(saved)
      if (Array.isArray(sessionData)) {
        for (const data of sessionData) {
          const shell = (data.shellType || '').toLowerCase()
          if (shell.includes('docker') || shell.includes('desktop')) continue
          try {
            await this.createNewTerminal(data.shellType, data.cwd, data.id)
          } catch (err) {}
        }
        const activeId = localStorage.getItem(`terminal_active_${vaultPath}`)
        if (activeId && this.sessionManager.getSessions().has(activeId)) {
          this.switchToTerminal(activeId)
        } else if (this.sessionManager.getSessions().size > 0) {
          const firstId = this.sessionManager.getSessions().keys().next().value
          if (firstId) this.switchToTerminal(firstId)
        }
      }
    } catch (error) {
    } finally {
      this.isRestoring = false
      this.saveSessions()
    }
  }

  private renameSession(sessionId: string): void {
    const label = document.getElementById(`label-${sessionId}`)
    if (!label) return
    const currentName = label.textContent || ''
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'session-rename-input'
    input.value = currentName
    let isSaving = false
    const saveRename = async () => {
      if (isSaving) return
      isSaving = true
      const newName = input.value.trim() || currentName
      label.textContent = newName
      if (input.parentNode) input.replaceWith(label)
      const session = this.sessionManager.getSession(sessionId)
      if (session) session.customName = newName
      try {
        const config = await window.api.invoke('config:get')
        const terminalSessions = config.terminalSessions || {}
        terminalSessions[sessionId] = { ...terminalSessions[sessionId], name: newName }
        await window.api.invoke('config:update', { terminalSessions })
      } catch (err) {}
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        saveRename()
      }
      if (e.key === 'Escape') {
        isSaving = true
        if (input.parentNode) input.replaceWith(label)
      }
    })
    input.addEventListener('blur', () => saveRename())
    label.replaceWith(input)
    setTimeout(() => {
      input.focus()
      input.select()
    }, 50)
  }

  private async showColorPicker(sessionId: string): Promise<void> {
    const colors = ['#4ec9b0', '#cd3131', '#2472c8', '#e5e510', '#bc3fbc', '#11a8cd', '#ffffff']
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return
    const currentColor = session.color || TERMINAL_CONSTANTS.DEFAULT_SESSION_COLOR
    const nextColor = colors[(colors.indexOf(currentColor) + 1) % colors.length]
    const sessionItem = document.getElementById(`session-${sessionId}`)
    if (sessionItem) {
      sessionItem.style.setProperty('--session-color', nextColor)
      const icon = sessionItem.querySelector('.session-icon') as HTMLElement
      const dot = sessionItem.querySelector('.color-dot') as HTMLElement
      if (icon) icon.style.color = nextColor
      if (dot) dot.style.background = nextColor
    }
    session.color = nextColor
    const config = await window.api.invoke('config:get')
    const terminalSessions = config.terminalSessions || {}
    terminalSessions[sessionId] = { ...terminalSessions[sessionId], color: nextColor }
    await window.api.invoke('config:update', { terminalSessions })
  }

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
      const nextSibling = siblings.find(
        (s) => e.clientY <= s.getBoundingClientRect().top + s.getBoundingClientRect().height / 2
      )
      if (nextSibling) list.insertBefore(draggingItem, nextSibling)
      else list.appendChild(draggingItem)
    })
  }

  private async getVaultPath(): Promise<string | undefined> {
    try {
      return await window.api.invoke('vault:get-path')
    } catch (error) {
      return undefined
    }
  }

  private setupPathLinks(terminal: Terminal, cwd?: string): void {
    terminal.registerLinkProvider({
      provideLinks: (bufferLine: any, callback) => {
        const line =
          typeof bufferLine === 'object' && bufferLine.translateToString
            ? bufferLine.translateToString(true)
            : terminal.buffer.active.getLine(bufferLine as number)?.translateToString(true) || ''
        const pathRegex =
          /(((?:\/|\b[A-Za-z]:[\\/])[\w\-.\\/]+)|(\.\.?[\/][\w\-.\\/]+))(:\d+)?(:\d+)?/g
        const links: ILink[] = []
        let match: RegExpExecArray | null
        while ((match = pathRegex.exec(line)) !== null) {
          const matchedPath = match[1]
          const lineNum = match[4] ? parseInt(match[4].slice(1)) : 1
          const beforeMatch = line.slice(Math.max(0, match.index - 8), match.index).toLowerCase()
          if (
            beforeMatch.includes('http') ||
            beforeMatch.includes('://') ||
            beforeMatch.endsWith('/')
          )
            continue
          links.push({
            range: {
              start: { x: match.index + 1, y: 1 },
              end: { x: match.index + match[0].length, y: 1 }
            },
            text: match[0],
            activate: () => void this.handlePathClick(matchedPath, lineNum, cwd)
          })
        }
        callback(links)
      }
    })
  }

  private async handlePathClick(
    pathStr: string,
    _lineNum: number,
    sessionCwd?: string
  ): Promise<void> {
    try {
      const vaultPath = await this.getVaultPath()
      if (!vaultPath) return
      let fullPath = pathStr
      if (!(await window.api.path.isAbsolute(pathStr))) {
        fullPath = await window.api.path.join(sessionCwd || vaultPath, pathStr)
      }
      if (!(await window.api.path.exists(fullPath))) return
      const normalizedPath = fullPath.replace(/\\/g, '/')
      const normalizedVaultRoot = vaultPath.replace(/\\/g, '/')
      if (normalizedPath.startsWith(normalizedVaultRoot)) {
        const relativePath = normalizedPath
          .substring(normalizedVaultRoot.length)
          .replace(/^[\\/]/, '')
        const note = state.notes.find(
          (n: any) =>
            n.path === relativePath ||
            n.path === relativePath.replace(/\//g, '\\') ||
            n.path === relativePath.replace(/\\/g, '/')
        )
        if (note && this.onNoteSelect) this.onNoteSelect(note.id, note.path)
        else window.api.revealVault(fullPath)
      } else window.api.revealVault(fullPath)
    } catch (err) {}
  }
}
