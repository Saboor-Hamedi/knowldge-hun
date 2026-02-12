import { TerminalShellService } from './terminal-shell.service'
import { TERMINAL_CONSTANTS, ShellConfig } from './terminal.types'

export class TerminalUiManager {
  private container: HTMLElement
  private shellService: TerminalShellService

  constructor(container: HTMLElement, shellService: TerminalShellService) {
    this.container = container
    this.shellService = shellService
  }

  renderHeader(availableShells: ShellConfig[]): string {
    const menuItems = availableShells
      .map(
        (shell) => `
        <div class="shell-menu-item" data-value="${shell.value}">
          <span class="shell-icon">${this.shellService.getShellIconSVG(shell.value)}</span>
          <span class="shell-label">${shell.label}</span>
        </div>
      `
      )
      .join('')

    return `
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
        </div>
      </div>
    `
  }

  setupResizing(onResize: (height: number) => void): void {
    const knob = this.container.querySelector('.real-terminal-knob') as HTMLElement
    if (!knob) return

    let isResizing = false
    let startY = 0
    let startHeight = 0

    knob.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()

      isResizing = true
      startY = e.clientY
      const host = document.getElementById('terminalHost')
      if (!host) return
      startHeight = host.offsetHeight

      document.body.style.cursor = 'ns-resize'
      this.container.classList.add('is-resizing')

      const onMouseMove = (moveEvent: MouseEvent): void => {
        if (!isResizing) return

        requestAnimationFrame(() => {
          const delta = startY - moveEvent.clientY
          const maxHeight = window.innerHeight - TERMINAL_CONSTANTS.MAX_HEIGHT_OFFSET

          const newHeight = Math.max(
            TERMINAL_CONSTANTS.MIN_HEIGHT,
            Math.min(maxHeight, startHeight + delta)
          )

          if (host) {
            host.style.height = `${newHeight}px`
          }
        })
      }

      const onMouseUp = (): void => {
        isResizing = false
        document.body.style.cursor = ''
        this.container.classList.remove('is-resizing')

        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)

        onResize(host.offsetHeight)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    })
  }

  applyTheme(settings: any): void {
    const frameColor = settings.terminalFrameColor || 'var(--panel)'
    const background = settings.terminalBackground || 'var(--panel-strong)'

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

    this.container.style.setProperty('--terminal-bg', background)

    const bodyEl = this.container.querySelector('.real-terminal-body') as HTMLElement
    if (bodyEl) {
      bodyEl.style.backgroundColor = background
    }
  }

  updateTabs(view: 'terminal' | 'console'): void {
    const tabs = this.container.querySelectorAll('.terminal-tab')
    tabs.forEach((t) => {
      const tab = t as HTMLElement
      if (tab.dataset.tab === view) tab.classList.add('active')
      else tab.classList.remove('active')
    })

    const termBody = this.container.querySelector('.real-terminal-body') as HTMLElement
    const consoleHost = this.container.querySelector('#real-terminal-console-host') as HTMLElement

    if (view === 'terminal') {
      if (termBody) termBody.style.display = 'flex'
      if (consoleHost) consoleHost.style.display = 'none'
    } else {
      if (termBody) termBody.style.display = 'none'
      if (consoleHost) consoleHost.style.display = 'flex'
    }
  }
}
