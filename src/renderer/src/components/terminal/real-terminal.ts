import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import './real-terminal.css'

interface TerminalSession {
  id: string
  terminal: Terminal
  fitAddon: FitAddon
  isActive: boolean
}

export class RealTerminalComponent {
  private container: HTMLElement
  private terminalContainer: HTMLElement
  private sessions: Map<string, TerminalSession> = new Map()
  private activeSessionId: string | null = null
  private isVisible: boolean = false

  constructor(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`Terminal container with id "${containerId}" not found`)
    }
    this.container = container
    this.terminalContainer = document.createElement('div')
    this.terminalContainer.className = 'real-terminal-container'
    this.container.appendChild(this.terminalContainer)

    this.render()
    this.setupEventListeners()
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="real-terminal-wrapper">
        <div class="real-terminal-header">
          <div class="real-terminal-title">
            <span>TERMINAL</span>
          </div>
          <div class="real-terminal-actions">
            <select class="shell-selector" id="shell-selector" title="Select Shell">
              <option value="powershell">PowerShell</option>
              <option value="cmd">Command Prompt</option>
              <option value="bash">Git Bash</option>
              <option value="wsl">WSL</option>
            </select>
            <button class="real-terminal-btn" id="new-terminal-btn" title="New Terminal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button class="real-terminal-btn" id="split-terminal-btn" title="Split Terminal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
            </button>
            <button class="real-terminal-btn" id="trash-terminal-btn" title="Kill Terminal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
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
        <div class="real-terminal-body">
          <div class="real-terminal-sidebar">
            <div class="terminal-sessions-list" id="terminal-sessions-list"></div>
          </div>
          <div class="real-terminal-content" id="terminal-content"></div>
        </div>
      </div>
    `
  }

  private setupEventListeners(): void {
    const newTerminalBtn = document.getElementById('new-terminal-btn')
    const closeTerminalBtn = document.getElementById('close-terminal-btn')
    const splitTerminalBtn = document.getElementById('split-terminal-btn')
    const trashTerminalBtn = document.getElementById('trash-terminal-btn')
    const shellSelector = document.getElementById('shell-selector') as HTMLSelectElement

    newTerminalBtn?.addEventListener('click', () => {
      const shell = shellSelector?.value || 'powershell'
      this.createNewTerminal(undefined, shell)
    })

    closeTerminalBtn?.addEventListener('click', () => this.toggle())

    splitTerminalBtn?.addEventListener('click', () => {
      // TODO: Implement split terminal
      console.log('[RealTerminal] Split terminal not yet implemented')
    })

    trashTerminalBtn?.addEventListener('click', () => {
      if (this.activeSessionId) {
        this.closeTerminal(this.activeSessionId)
      }
    })

    // Handle window resize
    window.addEventListener('resize', () => {
      this.sessions.forEach((session) => {
        if (session.isActive) {
          session.fitAddon.fit()
          this.resizeTerminal(session.id)
        }
      })
    })
  }

  /**
   * Create a new terminal session
   */
  async createNewTerminal(cwd?: string, shell?: string): Promise<string> {
    const sessionId = `terminal-${Date.now()}`
    const shellType = shell || 'powershell'

    // Create xterm instance
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selection: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      },
      allowProposedApi: true
    })

    // Add addons
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    // Create terminal element
    const terminalElement = document.createElement('div')
    terminalElement.className = 'terminal-instance'
    terminalElement.id = `terminal-${sessionId}`
    terminalElement.style.display = 'none'

    const terminalContent = document.getElementById('terminal-content')
    if (terminalContent) {
      terminalContent.appendChild(terminalElement)
    }

    // Open terminal
    terminal.open(terminalElement)
    fitAddon.fit()

    // Store session
    this.sessions.set(sessionId, {
      id: sessionId,
      terminal,
      fitAddon,
      isActive: false
    })

    // Create terminal in main process
    try {
      await window.api.invoke('terminal:create', sessionId, cwd, shellType)

      // Setup data listener
      window.api.on(`terminal:data:${sessionId}`, (data: string) => {
        terminal.write(data)
      })

      // Setup exit listener
      window.api.on(`terminal:exit:${sessionId}`, (exitCode: number) => {
        console.log(`Terminal ${sessionId} exited with code ${exitCode}`)
        this.closeTerminal(sessionId)
      })

      // Setup input handler
      terminal.onData((data) => {
        window.api.send('terminal:write', sessionId, data)
      })

      // Listen for terminal data
      window.api.send('terminal:listen', sessionId)

      // Add to session list
      this.addSessionToList(sessionId, shellType)

      // Activate this terminal
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
  private addSessionToList(sessionId: string, shellType: string): void {
    const sessionsList = document.getElementById('terminal-sessions-list')
    if (!sessionsList) return

    const shellIcons = {
      powershell: '❯',
      cmd: '>_',
      bash: '$',
      wsl: '🐧'
    }

    const sessionItem = document.createElement('div')
    sessionItem.className = 'terminal-session-item'
    sessionItem.id = `session-${sessionId}`
    sessionItem.innerHTML = `
      <span class="session-icon">${shellIcons[shellType] || '❯'}</span>
      <span class="session-label">${shellType}: ${this.sessions.size}</span>
      <button class="session-close" data-session-id="${sessionId}" title="Kill Terminal">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `

    sessionItem.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.session-close')) {
        this.switchToTerminal(sessionId)
      }
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

    // Hide all terminals and deactivate sessions
    this.sessions.forEach((s, id) => {
      s.isActive = false
      const element = document.getElementById(`terminal-${id}`)
      if (element) element.style.display = 'none'

      const sessionItem = document.getElementById(`session-${id}`)
      if (sessionItem) sessionItem.classList.remove('active')
    })

    // Show this terminal and activate session
    session.isActive = true
    const element = document.getElementById(`terminal-${sessionId}`)
    if (element) {
      element.style.display = 'block'
      session.fitAddon.fit()
      this.resizeTerminal(sessionId)
      session.terminal.focus()
    }

    const sessionItem = document.getElementById(`session-${sessionId}`)
    if (sessionItem) sessionItem.classList.add('active')

    this.activeSessionId = sessionId
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
        }
      }

      console.log(`[RealTerminal] Closed session ${sessionId}`)
    } catch (error) {
      console.error(`[RealTerminal] Error closing terminal:`, error)
    }
  }

  /**
   * Resize terminal in main process
   */
  private resizeTerminal(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const { cols, rows } = session.terminal
    window.api.send('terminal:resize', sessionId, cols, rows)
  }

  /**
   * Toggle terminal visibility
   */
  toggle(): void {
    console.log('[RealTerminal] Toggle called, current visibility:', this.isVisible)
    this.isVisible = !this.isVisible
    this.container.style.display = this.isVisible ? 'block' : 'none'
    console.log(
      '[RealTerminal] New visibility:',
      this.isVisible,
      'display:',
      this.container.style.display
    )

    if (this.isVisible) {
      // Create first terminal if none exist
      if (this.sessions.size === 0) {
        console.log('[RealTerminal] Creating first terminal session')
        this.createNewTerminal()
      } else if (this.activeSessionId) {
        // Focus active terminal
        const session = this.sessions.get(this.activeSessionId)
        if (session) {
          session.terminal.focus()
          session.fitAddon.fit()
          this.resizeTerminal(this.activeSessionId)
        }
      }
    }
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
    this.sessions.forEach((session, id) => {
      this.closeTerminal(id)
    })
  }
}
