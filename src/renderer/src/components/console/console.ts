import './console.css'

export interface Command {
  name: string
  description: string
  usage?: string
  action: (args: string[]) => void | Promise<void>
}

/**
 * HUB Console Component
 *
 * SECURITY MODEL:
 * ---------------
 * This console is SANDBOXED and SECURE by design:
 *
 * 1. **No Arbitrary Code Execution**: Unlike a real terminal, this console CANNOT execute
 *    arbitrary system commands, shell scripts, or JavaScript code. It only runs pre-registered
 *    commands defined in the application.
 *
 * 2. **Whitelist-Only Commands**: Only commands explicitly registered via `registerCommand()`
 *    can be executed. Users cannot inject or run malicious code.
 *
 * 3. **Controlled Actions**: Each command's action is defined by the application developer
 *    and runs within the Electron renderer process with limited permissions.
 *
 * 4. **No File System Access**: Commands cannot directly access the file system. All file
 *    operations go through the secure IPC bridge to the main process with validation.
 *
 * 5. **Input Sanitization**: Command arguments are parsed as simple strings - no eval(),
 *    no code injection, no shell expansion.
 *
 * WHAT THIS MEANS:
 * - Safe for users to type anything - worst case is "Unknown command" error
 * - Cannot be used to hack, exploit, or damage the system
 * - Cannot access files outside the vault directory
 * - Cannot run system commands like `rm -rf /` or `del C:\`
 * - All operations are scoped to app functionality only
 */
export class ConsoleComponent {
  private container: HTMLElement
  private consoleEl: HTMLElement
  private inputEl: HTMLInputElement
  private bodyEl: HTMLElement
  private height = 300
  private isDragging = false
  private startY = 0
  private startHeight = 0
  private isOpen = false
  private isMaximized = false
  private isBusy = false
  private history: string[] = []
  private historyIndex = -1
  private commands: Map<string, Command> = new Map()
  private vaultUnsubscribe?: () => void

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.consoleEl = document.createElement('div')
    this.consoleEl.className = 'hub-console'
    this.render()
    this.bodyEl = this.consoleEl.querySelector('.hub-console__body') as HTMLElement
    this.inputEl = this.consoleEl.querySelector('.hub-console__input') as HTMLInputElement

    if (this.container) {
      this.container.appendChild(this.consoleEl)
    } else {
      console.warn(`[Console] Container "${containerId}" not found. Appending to body.`)
      document.body.appendChild(this.consoleEl)
    }

    this.attachEvents()
    this.log('HUB Console initialized. Type "help" for a list of commands.', 'system')

    // Fetch and set username
    void this.initUsername()

    // Restore saved state
    const savedState = localStorage.getItem('hub-console-open')
    if (savedState === 'true') {
      this.setVisible(true)
    }

    const savedHeight = localStorage.getItem('hub-console-height')
    if (savedHeight) {
      this.height = parseInt(savedHeight, 10)
      this.updateHeight()
    }
  }

  private async initUsername(): Promise<void> {
    try {
      const username = await window.api.getUsername()
      const vault = await window.api.getVault()

      // Sanitize names to prevent display issues
      const sanitizedUsername = (username || 'user').trim() || 'user'
      const vaultName = (vault?.name || 'hub').trim() || 'hub'

      const promptEl = this.consoleEl.querySelector('.hub-console__prompt')
      if (promptEl) {
        promptEl.textContent = `${sanitizedUsername}@${vaultName} λ`
      }

      // Listen for vault changes and update prompt dynamically
      this.vaultUnsubscribe = window.api.onVaultChanged(async () => {
        try {
          const newVault = await window.api.getVault()
          const newVaultName = (newVault?.name || 'hub').trim() || 'hub'
          if (promptEl) {
            promptEl.textContent = `${sanitizedUsername}@${newVaultName} λ`
          }
        } catch (err) {
          console.error('[Console] Failed to update vault name:', err)
        }
      })
    } catch (err) {
      console.error('[Console] Failed to initialize username/vault:', err)
      // Keep default prompt if initialization fails
    }
  }

  private render(): void {
    this.consoleEl.innerHTML = `
      <div class="hub-console__resizer"></div>
      <div class="hub-console__header">
        <div class="hub-console__title">
          <span class="hub-console__title-icon">▶</span>
          <span>HUB Console</span>
        </div>
        <div class="hub-console__actions">
          <button class="hub-console__action-btn hub-console__chevron-btn" title="Toggle Console (Ctrl+J)">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
            </svg>
          </button>
          <button class="hub-console__action-btn hub-console__maximize-btn" title="Maximize Panel">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="10" height="10" rx="1"/>
            </svg>
          </button>
          <button class="hub-console__close-btn" title="Close (Esc)">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="12" y1="4" x2="4" y2="12"/>
              <line x1="4" y1="4" x2="12" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="hub-console__body"></div>
      <div class="hub-console__footer">
        <span class="hub-console__prompt">λ</span>
        <input type="text" class="hub-console__input" placeholder="Type a command..." spellcheck="false" autocomplete="off">
      </div>
    `
  }

  public registerCommand(command: Command): void {
    if (!command || !command.name || typeof command.action !== 'function') {
      console.error('[Console] Invalid command registration:', command)
      return
    }
    this.commands.set(command.name.toLowerCase().trim(), command)
  }

  public get isVisible(): boolean {
    return this.isOpen
  }

  public toggle(): void {
    this.setVisible(!this.isOpen)
  }

  public setVisible(visible: boolean): void {
    this.isOpen = visible
    this.consoleEl.classList.toggle('is-open', this.isOpen)

    try {
      localStorage.setItem('hub-console-open', String(this.isOpen))
    } catch (err) {
      console.warn('[Console] Failed to save state to localStorage:', err)
    }

    if (this.isOpen) {
      setTimeout(() => {
        if (this.inputEl) {
          this.inputEl.focus()
        }
      }, 50)
    }
  }

  public destroy(): void {
    // Clean up vault change listener
    if (this.vaultUnsubscribe) {
      this.vaultUnsubscribe()
      this.vaultUnsubscribe = undefined
    }
  }

  public log(message: string, type: 'command' | 'error' | 'system' | 'output' = 'output'): void {
    const line = document.createElement('div')
    line.className = `hub-console__line hub-console__line--${type}`
    line.textContent = message
    this.bodyEl.appendChild(line)
    this.bodyEl.scrollTop = this.bodyEl.scrollHeight
  }

  private attachEvents(): void {
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const value = this.inputEl.value.trim()
        if (value) {
          if (this.isBusy) {
            this.log('Command already running. Please wait...', 'system')
            return
          }
          void this.execute(value)
          this.inputEl.value = ''
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++
          this.inputEl.value = this.history[this.history.length - 1 - this.historyIndex]
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (this.historyIndex > 0) {
          this.historyIndex--
          this.inputEl.value = this.history[this.history.length - 1 - this.historyIndex]
        } else {
          this.historyIndex = -1
          this.inputEl.value = ''
        }
      }
    })

    // Focus input on click anywhere in console
    this.consoleEl.addEventListener('click', () => {
      this.inputEl.focus()
    })

    // Handle chevron button click (toggle)
    const chevronBtn = this.consoleEl.querySelector('.hub-console__chevron-btn')
    chevronBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.toggle()
    })

    // Handle maximize button click
    const maximizeBtn = this.consoleEl.querySelector('.hub-console__maximize-btn')
    maximizeBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.toggleMaximize()
    })

    // Handle close button click
    const closeBtn = this.consoleEl.querySelector('.hub-console__close-btn')
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation() // Prevent triggering the focus listener above
      this.toggle()
    })

    // Handle Resizing
    const resizer = this.consoleEl.querySelector('.hub-console__resizer') as HTMLElement
    resizer?.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.isDragging = true
      this.startY = e.clientY
      this.startHeight = this.height
      this.consoleEl.classList.add('is-resizing')
      document.body.style.cursor = 'ns-resize'

      const onMouseMove = (moveEvent: MouseEvent): void => {
        if (!this.isDragging) return
        const delta = this.startY - moveEvent.clientY
        this.height = Math.max(150, Math.min(window.innerHeight - 100, this.startHeight + delta))
        this.updateHeight()
      }

      const onMouseUp = (): void => {
        this.isDragging = false
        this.consoleEl.classList.remove('is-resizing')
        document.body.style.cursor = ''
        localStorage.setItem('hub-console-height', String(this.height))
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    })
  }

  private updateHeight(): void {
    this.consoleEl.style.setProperty('--console-height', `${this.height}px`)
  }

  private toggleMaximize(): void {
    this.isMaximized = !this.isMaximized
    this.consoleEl.classList.toggle('is-maximized', this.isMaximized)

    // Update maximize button icon
    const maximizeBtn = this.consoleEl.querySelector('.hub-console__maximize-btn')
    if (maximizeBtn) {
      maximizeBtn.innerHTML = this.isMaximized
        ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
             <rect x="3" y="5" width="10" height="8" rx="1"/>
             <path d="M5 5V3a1 1 0 011-1h7a1 1 0 011 1v7a1 1 0 01-1 1h-2"/>
           </svg>`
        : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
             <rect x="3" y="3" width="10" height="10" rx="1"/>
           </svg>`
      maximizeBtn.setAttribute('title', this.isMaximized ? 'Restore Panel' : 'Maximize Panel')
    }
  }

  private async execute(rawLine: string): Promise<void> {
    this.history.push(rawLine)
    this.historyIndex = -1
    this.log(rawLine, 'command')

    const parts = rawLine.split(/\s+/)
    const commandName = parts[0].toLowerCase()
    const args = parts.slice(1)

    const cmd = this.commands.get(commandName)
    if (cmd) {
      this.isBusy = true
      this.inputEl.disabled = true
      this.inputEl.placeholder = 'Command running...'

      try {
        await cmd.action(args)
      } catch (err) {
        this.log(`Error: ${(err as Error).message}`, 'error')
      } finally {
        this.isBusy = false
        this.inputEl.disabled = false
        this.inputEl.placeholder = 'Type a command...'
        this.inputEl.focus()
      }
    } else {
      this.log(`Unknown command: ${commandName}. Type "help" for assistance.`, 'error')
    }
  }
}
