import { state } from '../../core/state'
import './console.css'

export interface Command {
  name: string
  description: string
  usage?: string
  action: (args: string[]) => void | Promise<void>
}

export class ConsoleComponent {
  private container: HTMLElement
  private consoleEl: HTMLElement
  private inputEl: HTMLInputElement
  private bodyEl: HTMLElement
  private isOpen = false
  private isMaximized = false
  private history: string[] = []
  private historyIndex = -1
  private commands: Map<string, Command> = new Map()

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.consoleEl = document.createElement('div')
    this.consoleEl.className = 'hub-console'
    this.render()
    this.bodyEl = this.consoleEl.querySelector('.hub-console__body') as HTMLElement
    this.inputEl = this.consoleEl.querySelector('.hub-console__input') as HTMLInputElement
    this.container.appendChild(this.consoleEl)
    this.attachEvents()
    this.log('HUB Console initialized. Type "help" for a list of commands.', 'system')

    // Restore saved state
    const savedState = localStorage.getItem('hub-console-open')
    if (savedState === 'true') {
      this.setVisible(true)
    }
  }

  private render(): void {
    this.consoleEl.innerHTML = `
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
    this.commands.set(command.name.toLowerCase(), command)
  }

  public toggle(): void {
    this.setVisible(!this.isOpen)
  }

  public setVisible(visible: boolean): void {
    this.isOpen = visible
    this.consoleEl.classList.toggle('is-open', this.isOpen)
    localStorage.setItem('hub-console-open', String(this.isOpen))
    if (this.isOpen) {
      setTimeout(() => this.inputEl.focus(), 50)
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
          this.execute(value)
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
      try {
        await cmd.action(args)
      } catch (err) {
        this.log(`Error: ${(err as Error).message}`, 'error')
      }
    } else {
      this.log(`Unknown command: ${commandName}. Type "help" for assistance.`, 'error')
    }
  }
}
