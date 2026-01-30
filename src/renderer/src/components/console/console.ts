import './console.css'
import { codicons } from '../../utils/codicons'
import type { ChatMessage } from '../../services/aiService'
import { agentService } from '../../services/agent/agent-service'
import { state } from '../../core/state'

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
interface AutocompleteContext {
  atIndex: number
  range: Range
  query: string
}

export class ConsoleComponent {
  private container: HTMLElement
  private consoleEl: HTMLElement
  private inputEl: HTMLElement
  private bodyEl: HTMLElement
  private height = 300
  private isDragging = false
  private startY = 0
  private startHeight = 0
  private isOpen = false
  private isMaximized = false
  private isBusy = false
  private currentMode: 'terminal' | 'ai' = 'terminal'
  private history: string[] = []
  private historyIndex = -1
  private tabMatches: string[] = []
  private tabIndex = -1
  private commands: Map<string, Command> = new Map()
  private vaultUnsubscribe?: () => void
  private aiAbortController: AbortController | null = null
  private chatHistory: ChatMessage[] = []
  private autocompleteDropdown!: HTMLElement
  private autocompleteItems: HTMLElement[] = []
  private selectedAutocompleteIndex = -1
  private typingTimeout: number | null = null

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.consoleEl = document.createElement('div')
    this.consoleEl.className = 'hub-console'
    this.render()
    this.bodyEl = this.consoleEl.querySelector('.hub-console__body') as HTMLElement
    this.inputEl = this.consoleEl.querySelector('.hub-console__input') as HTMLElement
    this.autocompleteDropdown = this.consoleEl.querySelector(
      '.hub-console__autocomplete'
    ) as HTMLElement

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

    const savedMode = localStorage.getItem('hub-console-mode')
    if (savedMode === 'ai' || savedMode === 'terminal') {
      this.setMode(savedMode)
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
        if (this.currentMode === 'ai') {
          promptEl.textContent = 'AGENT >'
          promptEl.classList.add('hub-console__prompt--ai')
        } else {
          promptEl.textContent = `${sanitizedUsername}@${vaultName} λ`
          promptEl.classList.remove('hub-console__prompt--ai')
        }
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
            ${codicons.chevronDownLucide}
          </button>
          <button class="hub-console__action-btn hub-console__maximize-btn" title="Maximize Panel">
            <span class="hub-console__maximize-icon">${codicons.maximize}</span>
          </button>
          <button class="hub-console__close-btn" title="Close (Esc)">
            <span class="hub-console__close-icon">${codicons.closeX}</span>
          </button>
        </div>
      </div>
      <div class="hub-console__body"></div>
      <div class="hub-console__footer">
        <div class="hub-console__autocomplete" id="hub-console-autocomplete"></div>
        <div class="hub-console__mode-switcher">
          <button class="hub-console__mode-btn ${this.currentMode === 'terminal' ? 'is-active' : ''}" data-mode="terminal" title="Terminal Mode">
            ${codicons.terminal}
          </button>
          <button class="hub-console__mode-btn ${this.currentMode === 'ai' ? 'is-active' : ''}" data-mode="ai" title="AI Agent">
            ${codicons.agent}
          </button>
          <select class="hub-console__capability-select" title="AI Capability" style="display: ${this.currentMode === 'ai' ? 'block' : 'none'};">
            <option value="balanced">Balanced</option>
            <option value="thinking">Thinking</option>
            <option value="code">Code</option>
            <option value="precise">Precise</option>
            <option value="creative">Creative</option>
          </select>
        </div>
        <div class="hub-console__prompt-wrapper">
          <span class="hub-console__prompt">λ</span>
          <div class="hub-console__input" contenteditable="true" spellcheck="false" data-placeholder="Type a command or @note..."></div>
        </div>
        <div class="hub-console__actions">
          <button class="hub-console__stop-btn" title="Stop generating">
            <div class="stop-core"></div>
            <div class="spinner-ring"></div>
          </button>
        </div>
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

  public setMode(mode: 'terminal' | 'ai'): void {
    this.currentMode = mode
    localStorage.setItem('hub-console-mode', mode)

    const switcher = this.consoleEl.querySelector('.hub-console__mode-switcher')
    if (switcher) {
      switcher.querySelectorAll('.hub-console__mode-btn').forEach((btn) => {
        btn.classList.toggle('is-active', (btn as HTMLElement).dataset.mode === mode)
      })

      const capabilitySelect = switcher.querySelector(
        '.hub-console__capability-select'
      ) as HTMLElement
      if (capabilitySelect) {
        capabilitySelect.style.display = mode === 'ai' ? 'block' : 'none'
      }
    }

    const prompt = this.consoleEl.querySelector('.hub-console__prompt')
    if (prompt) {
      // Re-init prompt text logic
      void this.initUsername()
    }

    const placeholder = mode === 'ai' ? 'Ask AI anything... @note to mention' : 'Type a command...'
    this.inputEl.dataset.placeholder = placeholder
    this.inputEl.focus()
  }

  public setVisible(visible: boolean): void {
    const wasOpen = this.isOpen
    this.isOpen = visible
    this.consoleEl.classList.toggle('is-open', this.isOpen)

    // If closing via UI, abort active AI
    if (wasOpen && !visible && this.isBusy && this.aiAbortController) {
      this.aiAbortController.abort()
      this.isBusy = false
      const stopBtn = this.consoleEl.querySelector('.hub-console__stop-btn') as HTMLElement
      if (stopBtn) stopBtn.style.display = 'none'
    }

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

  public clearHistory(): void {
    this.chatHistory = []
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

  private getPlainText(): string {
    // Clone but handle mentions specially
    const clone = this.inputEl.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.hub-console__mention').forEach((mention) => {
      const text = mention.textContent || ''
      mention.replaceWith(document.createTextNode(text))
    })
    return clone.textContent || ''
  }

  private setInputValue(text: string): void {
    this.inputEl.textContent = text
    // Move cursor to end
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(this.inputEl)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  private attachEvents(): void {
    this.inputEl.addEventListener('keydown', (e) => {
      // Autocomplete keyboard nav
      if (this.autocompleteDropdown.style.display === 'block') {
        const count = this.autocompleteItems.length
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          this.selectedAutocompleteIndex = (this.selectedAutocompleteIndex + 1) % count
          this.updateAutocompleteSelection()
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          this.selectedAutocompleteIndex = (this.selectedAutocompleteIndex - 1 + count) % count
          this.updateAutocompleteSelection()
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          if (this.selectedAutocompleteIndex >= 0) {
            e.preventDefault()
            this.selectAutocompleteItem()
            return
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          this.hideAutocomplete()
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        const value = this.getPlainText().trim()
        if (value) {
          if (this.isBusy) {
            if (this.currentMode === 'ai') {
              this.log('AI is still thinking... (Press Ctrl+C to stop)', 'system')
            } else {
              this.log('Command already running. Please wait...', 'system')
            }
            return
          }

          if (this.currentMode === 'ai') {
            void this.handleAIRequest(value)
          } else {
            void this.execute(value)
          }
          this.inputEl.innerHTML = ''
        }
      } else if (e.key === 'ArrowUp') {
        const selection = window.getSelection()
        // Only trigger history if at the start of input
        if (selection && selection.anchorOffset === 0) {
          e.preventDefault()
          if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++
            this.setInputValue(this.history[this.history.length - 1 - this.historyIndex])
          }
        }
      } else if (e.key === 'ArrowDown') {
        const selection = window.getSelection()
        // Only trigger history if at the end of input
        if (selection && selection.anchorOffset === (this.inputEl.textContent?.length || 0)) {
          e.preventDefault()
          if (this.historyIndex > 0) {
            this.historyIndex--
            this.setInputValue(this.history[this.history.length - 1 - this.historyIndex])
          } else if (this.historyIndex === 0) {
            this.historyIndex = -1
            this.inputEl.innerHTML = ''
          }
        }
      } else if (e.key === 'Tab') {
        e.preventDefault()
        this.handleTabCompletion()
      } else if (!['Control', 'Alt', 'Meta', 'Shift'].includes(e.key)) {
        // Reset tab completion if any standard key is pressed
        this.tabMatches = []
        this.tabIndex = -1
      }
    })

    this.inputEl.addEventListener('input', () => {
      // Clear any existing timeout
      if (this.typingTimeout !== null) {
        clearTimeout(this.typingTimeout)
      }

      this.typingTimeout = window.setTimeout(() => {
        this.handleInputTrigger()
      }, 50)
    })

    // Focus input on click anywhere in console (but skip interactive elements)
    this.consoleEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.closest('select') || target.closest('button') || target.closest('input')) {
        return
      }
      this.inputEl.focus()
    })

    // Mode switcher buttons
    const modeBtns = this.consoleEl.querySelectorAll('.hub-console__mode-btn')
    modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.mode as 'terminal' | 'ai'
        this.setMode(mode)
      })
    })

    const capabilitySelect = this.consoleEl.querySelector(
      '.hub-console__capability-select'
    ) as HTMLSelectElement

    // Crucial: Stop click/mousedown from bubbling up to consoleEl and stealing focus
    const stopBubbling = (el: HTMLElement | null): void => {
      el?.addEventListener('mousedown', (e) => e.stopPropagation())
      el?.addEventListener('click', (e) => e.stopPropagation())
    }

    stopBubbling(capabilitySelect as HTMLElement)

    modeBtns.forEach((btn) => stopBubbling(btn as HTMLElement))

    capabilitySelect?.addEventListener('change', () => {
      import('../../services/aiService').then(({ aiService, CHAT_MODES }) => {
        const mode = capabilitySelect.value as import('../../services/aiService').ChatMode
        if (CHAT_MODES.some((m) => m.id === mode)) {
          aiService.setMode(mode)
          this.log(`AI Capability switched to: ${mode}`, 'system')
        }
      })
    })

    // Handle stop button
    const stopBtn = this.consoleEl.querySelector('.hub-console__stop-btn') as HTMLElement
    stopBtn?.addEventListener('click', () => {
      if (this.aiAbortController) {
        this.aiAbortController.abort()
        this.isBusy = false
        if (stopBtn) stopBtn.style.display = 'none'

        // Clean up thinking indicator immediately
        const thinking = this.bodyEl.querySelector('.hub-console__line--thinking')
        if (thinking) thinking.remove()
      }
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

    // AI Selection Bridge
    window.addEventListener('hub-ai-explain', (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string; prompt: string }>
      const { text, prompt } = customEvent.detail
      if (!this.isVisible) this.setVisible(true)
      this.setMode('ai')
      this.handleAIRequest(
        `[Explain Selection]\n\nContext Content:\n"${text}"\n\nQuestion: ${prompt || 'Explain this context in detail.'}`
      )
    })
  }

  private updateHeight(): void {
    this.consoleEl.style.setProperty('--console-height', `${this.height}px`)
    window.dispatchEvent(new Event('resize'))
  }

  public clear(): void {
    const body = this.consoleEl.querySelector('.hub-console__body')
    if (body) body.innerHTML = ''
    this.chatHistory = []
    this.history = []
    this.historyIndex = -1
    this.log('Console cleared.', 'system')
  }

  private handleTabCompletion(): void {
    if (this.currentMode !== 'terminal') return

    const value = this.getPlainText().trim().toLowerCase()

    if (this.tabMatches.length === 0) {
      if (!value) return

      // Find all commands starting with current input
      const allNames = Array.from(this.commands.keys())
      this.tabMatches = allNames.filter((name) => name.startsWith(value))

      if (this.tabMatches.length === 0) return
      this.tabIndex = 0
    } else {
      // Cycle through matches
      this.tabIndex = (this.tabIndex + 1) % this.tabMatches.length
    }

    this.setInputValue(this.tabMatches[this.tabIndex])
  }

  private toggleMaximize(): void {
    this.isMaximized = !this.isMaximized
    this.consoleEl.classList.toggle('is-maximized', this.isMaximized)

    // Update maximize button icon
    const icon = this.consoleEl.querySelector('.hub-console__maximize-icon')
    if (icon) {
      icon.innerHTML = this.isMaximized ? codicons.minimize : codicons.maximize
      const maximizeBtn = this.consoleEl.querySelector('.hub-console__maximize-btn')
      maximizeBtn?.setAttribute('title', this.isMaximized ? 'Restore Panel' : 'Maximize Panel')
    }
  }

  public async execute(rawLine: string, addToHistory = true, logCommand = true): Promise<void> {
    if (addToHistory) {
      this.history.push(rawLine)
      this.historyIndex = -1
    }
    if (logCommand) {
      this.log(rawLine, 'command')
    }

    const subCommands = rawLine.split('&&').map((s) => s.trim())

    this.isBusy = true
    this.inputEl.setAttribute('contenteditable', 'false')
    this.inputEl.dataset.placeholder = 'Executing...'

    try {
      for (const sub of subCommands) {
        if (!sub) continue

        // Improved parsing for quoted strings (to support space in titles/content)
        const parts: string[] = []
        let currentPart = ''
        let inQuotes = false
        for (let i = 0; i < sub.length; i++) {
          const char = sub[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ' ' && !inQuotes) {
            if (currentPart) {
              parts.push(currentPart)
              currentPart = ''
            }
          } else {
            currentPart += char
          }
        }
        if (currentPart) parts.push(currentPart)

        const commandName = parts[0].toLowerCase()
        const args = parts.slice(1)

        const cmd = this.commands.get(commandName)
        if (cmd) {
          await cmd.action(args)
        } else {
          this.log(`Unknown command: ${commandName}`, 'error')
          break // Stop chain on error
        }
      }
    } catch (err) {
      this.log(`Command failed: ${(err as Error).message}`, 'error')
    } finally {
      this.isBusy = false
      this.inputEl.setAttribute('contenteditable', 'true')
      this.inputEl.dataset.placeholder =
        this.currentMode === 'ai' ? 'Ask AI anything... @note to mention' : 'Type a command...'
      this.inputEl.focus()
    }
  }

  private async handleAIRequest(input: string): Promise<void> {
    const { aiService } = await import('../../services/aiService')

    this.isBusy = true
    this.log(input, 'command')

    const outputLine = document.createElement('div')
    outputLine.className = 'hub-console__line hub-console__line--ai'
    this.bodyEl.appendChild(outputLine)

    // Show stop button
    const stopBtn = this.consoleEl.querySelector('.hub-console__stop-btn') as HTMLElement
    if (stopBtn) stopBtn.style.display = 'flex'

    // Thinking indicator
    const thinkingEl = document.createElement('span')
    thinkingEl.className = 'hub-console__line--thinking'
    thinkingEl.innerHTML = `<span></span><span></span><span></span>`
    outputLine.appendChild(thinkingEl)

    this.bodyEl.scrollTop = this.bodyEl.scrollHeight

    this.aiAbortController = new AbortController()
    let fullText = ''
    const currentController = this.aiAbortController

    try {
      const response = await aiService.buildContextMessage(input)
      const context = response.context

      await aiService.callDeepSeekAPIStream(
        this.chatHistory,
        context,
        (chunk) => {
          if (currentController?.signal.aborted) return

          // Clear dots on first chunk
          if (fullText === '' && thinkingEl.parentNode) {
            thinkingEl.remove()
          }
          fullText += chunk

          // We display the text without [RUN: ...] tags but keep other formatting
          // Also hide partial tags during streaming
          const visibleText = fullText.replace(/\[RUN:[\s\S]*?(\]|(?=$))/g, '')
          outputLine.textContent = visibleText

          this.bodyEl.scrollTop = this.bodyEl.scrollHeight
        },
        this.aiAbortController.signal
      )

      // Ensure thinking dots are gone
      if (thinkingEl.parentNode) thinkingEl.remove()

      if (fullText.trim() && !this.aiAbortController?.signal.aborted) {
        const actionArea = document.createElement('div')
        actionArea.className = 'hub-console__ai-actions'

        // 2. Identify and handle [RUN: ...] commands
        const runMatches = Array.from(fullText.matchAll(/\[RUN:\s*([\s\S]+?)\]/g))
        const commandsToRun: string[] = []

        runMatches.forEach((match) => {
          const cmdString = match[1].trim()

          // AUTO-EXECUTION: Commands that AI can run automatically to be agentic
          const isSafeAutoCmd =
            cmdString.startsWith('mkdir') ||
            cmdString.startsWith('touch') ||
            cmdString.startsWith('write') ||
            cmdString.startsWith('append') ||
            cmdString.startsWith('move') ||
            cmdString.startsWith('rename') ||
            cmdString.startsWith('delete') ||
            cmdString.startsWith('rm') ||
            cmdString.startsWith('read')

          // If it's an agentic command proposed by AI, we auto-execute it
          if (isSafeAutoCmd) {
            commandsToRun.push(cmdString)
          } else {
            // Otherwise show as a button
            const runBtn = document.createElement('button')
            runBtn.className = 'hub-console__ai-action-btn hub-console__ai-action-btn--run'
            runBtn.title = `Execute: ${cmdString}`
            runBtn.innerHTML = `${codicons.terminal || '▶'} Run: ${cmdString}`
            runBtn.addEventListener('click', () => {
              void this.execute(cmdString)
              runBtn.remove()
            })
            actionArea.appendChild(runBtn)
          }
        })

        // Execute auto-run commands
        if (commandsToRun.length > 0) {
          // Log a minimal system message instead of the full command
          this.log(`Agent executing ${commandsToRun.length} action(s)...`, 'system')

          const containsRead = commandsToRun.some((c) => c.startsWith('read'))

          // Wait for auto-commands so isBusy stays true during execution
          // Pass logCommand = false to avoid printing technical command details to the user
          await this.execute(commandsToRun.join(' && '), false, false)

          // If the agent requested a read, we should automatically continue the conversation
          // so it can act on the information it just retrieved.
          if (containsRead && !this.aiAbortController?.signal.aborted) {
            this.log('Agent processing retrieved information...', 'system')
            // Delay slightly to ensure UI is updated
            setTimeout(() => {
              void this.handleAIRequest(
                "(Hidden Context: I have retrieved the note content as you requested above. Please proceed with the user's original task using this information.)"
              )
            }, 500)
            return // Prevent duplicate history updates etc below for this turn
          }
        }

        // 3. NEW: Insert at Cursor button (Replaces standard insert)
        const insertBtn = document.createElement('button')
        insertBtn.className = 'hub-console__ai-action-btn'
        insertBtn.title = 'Insert this response at the current cursor position'
        insertBtn.innerHTML = `${codicons.insert || '🖋️'} Insert at Cursor`
        insertBtn.addEventListener('click', () => {
          window.dispatchEvent(
            new CustomEvent('knowledge-hub:insert-at-cursor', {
              detail: { content: fullText.replace(/\[RUN:\s*(.+?)\]/g, '').trim() }
            })
          )
          this.log(`Inserted into active note.`, 'system')
          actionArea.remove()
        })
        actionArea.appendChild(insertBtn)

        const archiveBtn = document.createElement('button')
        archiveBtn.className = 'hub-console__ai-action-btn'
        archiveBtn.title = 'Create a new note with this response'
        archiveBtn.innerHTML = `${codicons.file || '📄'} Archive to New Note`
        archiveBtn.addEventListener('click', async () => {
          const noteId = await agentService.archiveResponse(fullText, input)
          this.log(`Archived to new note.`, 'system')
          // Open the note via custom event
          const note = state.notes.find((n) => n.id === noteId)
          if (note) {
            window.dispatchEvent(
              new CustomEvent('knowledge-hub:open-note', {
                detail: { id: note.id, path: note.path }
              })
            )
          }
          actionArea.remove()
        })
        actionArea.appendChild(archiveBtn)

        if (actionArea.children.length > 0) {
          this.bodyEl.appendChild(actionArea)
        }

        // Final text update to ensure clean look
        const finalText = fullText.replace(/\[RUN:[\s\S]*?\]/g, '').trim()
        outputLine.textContent = finalText

        // Update History
        this.chatHistory.push({ role: 'user', content: input, timestamp: Date.now() })
        this.chatHistory.push({ role: 'assistant', content: fullText, timestamp: Date.now() })

        if (this.chatHistory.length > 20) this.chatHistory = this.chatHistory.slice(-20)
        this.bodyEl.scrollTop = this.bodyEl.scrollHeight
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.log('AI request cancelled.', 'system')
      } else {
        this.log(`AI Error: ${(err as Error).message}`, 'error')
      }
    } finally {
      if (thinkingEl.parentNode) thinkingEl.remove()
      this.isBusy = false
      this.aiAbortController = null
      if (stopBtn) stopBtn.style.display = 'none'
      this.inputEl.focus()
    }
  }

  private handleInputTrigger(): void {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      this.hideAutocomplete()
      return
    }

    const range = selection.getRangeAt(0)
    const rangeClone = range.cloneRange()
    rangeClone.selectNodeContents(this.inputEl)
    rangeClone.setEnd(range.endContainer, range.endOffset)
    const textBeforeCursor = rangeClone.toString()

    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    if (lastAtIndex === -1) {
      this.hideAutocomplete()
      return
    }

    // Check if @ is preceded by space or is at start
    if (lastAtIndex > 0) {
      const charBefore = textBeforeCursor[lastAtIndex - 1]
      if (!/[\s\n]/.test(charBefore)) {
        this.hideAutocomplete()
        return
      }
    }

    const afterAt = textBeforeCursor.substring(lastAtIndex + 1)
    if (afterAt.match(/[\s\n]/)) {
      this.hideAutocomplete()
      return
    }

    const query = afterAt.toLowerCase().trim()
    this.showAutocomplete(lastAtIndex, query, range)
  }

  private showAutocomplete(atIndex: number, query: string, range: Range): void {
    const items = state.notes
      .filter((note) => {
        if (note.type !== 'note') return false
        const title = (note.title || note.id).toLowerCase()
        return title.includes(query) || (note.path && note.path.toLowerCase().includes(query))
      })
      .slice(0, 10) // Show more suggestions

    if (items.length === 0) {
      this.hideAutocomplete()
      return
    }

    this.autocompleteItems = []
    this.selectedAutocompleteIndex = 0
    ;(this.autocompleteDropdown as HTMLElement & { __context?: AutocompleteContext }).__context = {
      atIndex,
      range,
      query
    }

    const html = items
      .map(
        (note, index) => `
      <div class="hub-console__autocomplete-item ${index === 0 ? 'is-selected' : ''}" data-index="${index}" data-note-title="${note.title}">
        <div class="hub-console__autocomplete-item-title">${this.escapeHtml(note.title)}</div>
        <div class="hub-console__autocomplete-item-path">${this.escapeHtml(note.path || '')}</div>
      </div>
    `
      )
      .join('')

    this.autocompleteDropdown.innerHTML = html
    this.autocompleteDropdown.style.display = 'block'
    this.autocompleteItems = Array.from(
      this.autocompleteDropdown.querySelectorAll('.hub-console__autocomplete-item')
    ) as HTMLElement[]

    this.autocompleteItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectedAutocompleteIndex = index
        this.selectAutocompleteItem()
      })
    })
  }

  private hideAutocomplete(): void {
    this.autocompleteDropdown.style.display = 'none'
    this.selectedAutocompleteIndex = -1
  }

  private updateAutocompleteSelection(): void {
    this.autocompleteItems.forEach((item, index) => {
      item.classList.toggle('is-selected', index === this.selectedAutocompleteIndex)
      if (index === this.selectedAutocompleteIndex) {
        item.scrollIntoView({ block: 'nearest' })
      }
    })
  }

  private selectAutocompleteItem(): void {
    const item = this.autocompleteItems[this.selectedAutocompleteIndex]
    if (!item) return

    const context = (this.autocompleteDropdown as HTMLElement & { __context?: AutocompleteContext })
      .__context
    if (!context) return

    const noteTitle = item.dataset.noteTitle || ''
    const { atIndex } = context

    // Replace @query with mention span
    const selection = window.getSelection()
    if (!selection) return

    // Find the text node containing the @
    const walker = document.createTreeWalker(this.inputEl, NodeFilter.SHOW_TEXT)
    let currentPos = 0
    let targetNode: Text | null = null
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const len = node.textContent?.length || 0
      if (currentPos <= atIndex && atIndex < currentPos + len) {
        targetNode = node
        break
      }
      currentPos += len
    }

    if (targetNode) {
      const offsetInNode = atIndex - currentPos
      const text = targetNode.textContent || ''
      const beforeStr = text.substring(0, offsetInNode)
      const afterStr = text.substring(offsetInNode + 1 + context.query.length)

      const mentionSpan = document.createElement('span')
      mentionSpan.className = 'hub-console__mention'
      mentionSpan.textContent = `@${noteTitle}`
      mentionSpan.contentEditable = 'false'

      const parent = targetNode.parentNode
      if (parent) {
        // Insert a space after the mention for easy continued typing
        const afterNode = document.createTextNode(' ' + afterStr)
        const beforeNode = document.createTextNode(beforeStr)

        parent.insertBefore(beforeNode, targetNode)
        parent.insertBefore(mentionSpan, targetNode)
        parent.insertBefore(afterNode, targetNode)
        parent.removeChild(targetNode)

        // Move cursor after the space
        const newRange = document.createRange()
        newRange.setStart(afterNode, 1)
        newRange.setEnd(afterNode, 1)
        selection.removeAllRanges()
        selection.addRange(newRange)
      }
    }

    this.hideAutocomplete()
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }
}
