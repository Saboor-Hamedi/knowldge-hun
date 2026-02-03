import { state } from '../../core/state'
import { aiService, type ChatMessage, type ChatMode, CHAT_MODES } from '../../services/aiService'
import { sessionStorageService, type ChatSession } from '../../services/sessionStorageService'
import { SessionSidebar } from './session-sidebar'
import { AIMenu, type AIMenuItem } from './ai-menu'
import { AISettingsModal } from '../settings/ai-settings-modal'
import {
  createElement,
  Trash2,
  Info,
  Plus,
  Download,
  PanelRight,
  PanelLeft,
  Upload,
  Archive,
  Settings,
  Check,
  Copy // Added Copy icon
} from 'lucide'
import { copyConversationToClipboard } from './clipboardUtils'
import './rightbar.css'
import './ai-menu.css'

import { messageFormatter } from './MessageFormatter'
import { SessionManager, SessionManagerUI } from './SessionManager'
import { ChatRenderer, RendererState } from './ChatRenderer'
import { ConversationController, ConversationControllerUI } from './ConversationController'

// Lazy load highlight.js - load it once when first code block is encountered
let hljsPromise: Promise<unknown> | null = null

const initHighlightJS = (): Promise<unknown> => {
  if (!hljsPromise) {
    hljsPromise = (async () => {
      try {
        const hljsModule = await import('highlight.js')
        const hljs = hljsModule.default
        // Register common languages
        const javascript = await import('highlight.js/lib/languages/javascript')
        const typescript = await import('highlight.js/lib/languages/typescript')
        const json = await import('highlight.js/lib/languages/json')
        const css = await import('highlight.js/lib/languages/css')
        const xml = await import('highlight.js/lib/languages/xml')
        const python = await import('highlight.js/lib/languages/python')
        const bash = await import('highlight.js/lib/languages/bash')
        const yaml = await import('highlight.js/lib/languages/yaml')

        hljs.registerLanguage('javascript', javascript.default)
        hljs.registerLanguage('js', javascript.default)
        hljs.registerLanguage('typescript', typescript.default)
        hljs.registerLanguage('ts', typescript.default)
        hljs.registerLanguage('json', json.default)
        hljs.registerLanguage('css', css.default)
        hljs.registerLanguage('html', xml.default)
        hljs.registerLanguage('xml', xml.default)
        hljs.registerLanguage('python', python.default)
        hljs.registerLanguage('py', python.default)
        hljs.registerLanguage('bash', bash.default)
        hljs.registerLanguage('sh', bash.default)
        hljs.registerLanguage('yaml', yaml.default)
        hljs.registerLanguage('yml', yaml.default)

        // Configure highlighting to ignore unescaped HTML warnings
        // Safe as we sanitize with DOMPurify
        hljs.configure({ ignoreUnescapedHTML: true })

        // Load CSS
        await import('highlight.js/styles/github-dark.css')
        return hljs
      } catch (err) {
        console.warn('[RightBar] Failed to load highlight.js:', err)
        return null
      }
    })()
  }
  return hljsPromise
}

export class RightBar {
  private container: HTMLElement
  private chatContainer!: HTMLElement
  private chatInput!: HTMLElement
  private sendButton!: HTMLButtonElement
  private inputWrapper!: HTMLElement
  private characterCounter!: HTMLElement
  private slashCommands = [
    { command: '/clear', description: 'Clear current conversation', icon: Trash2 },
    { command: '/new', description: 'Start a new chat session', icon: Plus },
    { command: '/help', description: 'Show available commands', icon: Info },
    { command: '/export', description: 'Export conversation', icon: Download }
  ]
  private isResizing = false
  private startX = 0
  private startWidth = 0
  private autocompleteDropdown!: HTMLElement
  private autocompleteItems: HTMLElement[] = []
  private selectedAutocompleteIndex = -1

  private typingTimeout: number | null = null
  private currentSessionId: string | null = null
  private wasAtBottom = true
  private aiMenu!: AIMenu
  private sessionSidebar!: SessionSidebar
  private aiSettingsModal: AISettingsModal
  private sessionManager!: SessionManager
  private chatRenderer!: ChatRenderer
  private conversationController!: ConversationController

  constructor(containerId: string, aiSettingsModal: AISettingsModal) {
    this.aiSettingsModal = aiSettingsModal
    this.container = document.getElementById(containerId) as HTMLElement

    // Initialize highlight.js in background
    void initHighlightJS()
    void aiService.loadApiKey()

    const conversationUI: ConversationControllerUI = {
      onStateChange: () => this.renderMessages(),
      onMessageAdded: () => {
        this.updateMenuItems()
      },
      onNewSessionRequired: async () => {
        if (!this.currentSessionId) {
          await this.startNewSession()
        }
      },
      onAutoSaveRequired: async () => {
        await this.autoSaveSession()
      },
      onMenuItemsUpdateRequired: () => this.updateMenuItems()
    }

    this.conversationController = new ConversationController(conversationUI)

    this.render()
    this.chatRenderer = new ChatRenderer(this.chatContainer)

    const ui: SessionManagerUI = {
      onSessionLoaded: (session) => {
        this.currentSessionId = session.id
        this.conversationController.setMessages(session.messages)
        const feedback = new Map<number, 'thumbs-up' | 'thumbs-down'>()
        session.messages.forEach((msg, idx) => {
          if (msg.feedback) feedback.set(idx, msg.feedback as 'thumbs-up' | 'thumbs-down')
        })
        this.conversationController.setFeedback(feedback)
      },
      onSessionCreated: (session) => {
        if (this.currentSessionId !== session.id) {
          this.currentSessionId = session.id
          this.conversationController.setMessages(session.messages)
          this.conversationController.clearFeedback()
        }
      },
      onNewSessionStarted: () => {
        this.conversationController.setMessages([])
        this.conversationController.clearFeedback()
      },
      onMenuItemsUpdated: () => this.updateMenuItems(),
      onSessionArchived: () => {
        void this.startNewSession()
      }
    }
    this.sessionManager = new SessionManager(this.sessionSidebar, ui)
    this.attachEvents()
    void this.sessionManager.initialize()
  }

  /**
   * Get current session
   */
  async getCurrentSession(): Promise<ChatSession | null> {
    return await this.sessionManager.getSessionMetadata()
  }

  /**
   * Start a new session
   */
  async startNewSession(): Promise<void> {
    await this.sessionManager.createNewSession([])
  }

  /**
   * Auto-save current session
   */
  private async autoSaveSession(): Promise<void> {
    const messages = this.conversationController.getState().messages
    await this.sessionManager.autoSave(messages)
  }

  /**
   * Load a session by ID
   */
  async loadSession(sessionId: string): Promise<void> {
    await this.sessionManager.loadSession(sessionId)
  }

  setEditorContext(
    getEditorContent: () => string | null,
    getActiveNoteInfo: () => { title: string; id: string } | null
  ): void {
    aiService.setEditorContext({ getEditorContent, getActiveNoteInfo })
  }

  private render(): void {
    const sessionIcon = createElement(PanelRight, {
      size: 16,
      'stroke-width': 2
    }).outerHTML

    this.container.innerHTML = `
      <div class="rightbar">
        <div class="rightbar__resize-handle" id="rightbar-resize-handle"></div>
        <div class="rightbar__header">
          <button class="rightbar__header-sessions" id="rightbar-header-sessions" title="Sessions" aria-label="Toggle sessions">
            ${sessionIcon}
          </button>
          <h3 class="rightbar__title"></h3>
          <div class="rightbar__header-actions">
            <div id="rightbar-model-badge" class="rightbar__model-badge"></div>
            <button class="rightbar__header-ai-menu" id="rightbar-header-ai-menu" title="More options" aria-label="AI chat menu"></button>
          </div>
        </div>
        <div class="rightbar__chat-container" id="rightbar-chat-container">
          <div class="rightbar__chat-messages" id="rightbar-chat-messages"></div>
        </div>
        <div class="rightbar__chat-input-wrapper" id="rightbar-chat-input-wrapper">
          <div class="rightbar__chat-input-container" id="rightbar-chat-input-container">
            <div class="rightbar__chat-input-area">
              <div
              class="rightbar__chat-input"
              id="rightbar-chat-input"
                contenteditable="true"
                data-placeholder="Ask anything... @note to reference"
                role="textbox"
                aria-multiline="true"
              ></div>
              <div class="rightbar__chat-autocomplete" id="rightbar-chat-autocomplete"></div>
              <div class="rightbar__mode-dropdown" id="rightbar-mode-dropdown">
                ${CHAT_MODES.map(
                  (mode) => `
                  <button class="rightbar__mode-option ${mode.id === 'balanced' ? 'is-active' : ''}" data-mode="${mode.id}">
                    <span class="rightbar__mode-option-icon">${mode.icon}</span>
                    <div class="rightbar__mode-option-info">
                      <span class="rightbar__mode-option-label">${mode.label}</span>
                      <span class="rightbar__mode-option-desc">${mode.description}</span>
                    </div>
                  </button>
                `
                ).join('')}
              </div>
            </div>
            <div class="rightbar__chat-footer">
              <div class="rightbar__chat-footer-left">
                  <div class="rightbar__mode-selector">
                    <button class="rightbar__mode-button" id="rightbar-mode-button" type="button" title="Select AI mode">
                      <span class="rightbar__mode-icon">⚖️</span>
                      <span class="rightbar__mode-label">Balanced</span>
                      <svg class="rightbar__mode-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </button>
                  </div>
                <span class="rightbar__chat-counter" id="rightbar-chat-counter">0</span>
              </div>
              <div class="rightbar__chat-actions">
                <button class="rightbar__chat-send" id="rightbar-chat-send" type="button" title="Send (Enter)">
                  <svg class="rightbar__send-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/>
                  </svg>
                </button>
                <button class="rightbar__chat-stop" id="rightbar-chat-stop" type="button" title="Stop generating" style="display: none;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
    const rightbarElement = this.container.querySelector('.rightbar') as HTMLElement

    this.chatContainer = this.container.querySelector('#rightbar-chat-messages') as HTMLElement
    this.chatInput = this.container.querySelector('#rightbar-chat-input') as HTMLElement
    this.sendButton = this.container.querySelector('#rightbar-chat-send') as HTMLButtonElement
    this.inputWrapper = this.container.querySelector('#rightbar-chat-input-wrapper') as HTMLElement
    this.resizeHandle = this.container.querySelector('#rightbar-resize-handle') as HTMLElement
    this.autocompleteDropdown = this.container.querySelector(
      '#rightbar-chat-autocomplete'
    ) as HTMLElement
    this.characterCounter = this.container.querySelector('#rightbar-chat-counter') as HTMLElement
    this.modeButton = this.container.querySelector('#rightbar-mode-button') as HTMLElement
    this.modeDropdown = this.container.querySelector('#rightbar-mode-dropdown') as HTMLElement

    const closeBtn = this.container.querySelector('#rightbar-header-close') as HTMLButtonElement
    closeBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('toggle-right-sidebar'))
    })

    // Initialize character counter
    if (this.characterCounter) {
      this.characterCounter.textContent = '0'
    }

    // Initialize mode selector
    this.initModeSelector()

    // Initialize session sidebar - append to the rightbar element
    if (rightbarElement) {
      this.sessionSidebar = new SessionSidebar(rightbarElement)
      this.sessionSidebar.setOnSessionSelect((sessionId) => {
        void this.loadSession(sessionId)
      })
      this.sessionSidebar.setOnNewSession(() => {
        void this.startNewSession()
      })
      this.sessionSidebar.setOnSessionDelete((sessionId) => {
        console.log(`[RightBar] Session deleted: ${sessionId}, current: ${this.currentSessionId}`)
        if (this.currentSessionId === sessionId) {
          // If we deleted the active session, clear everything and start fresh
          void this.startNewSession()
        }
      })

      const sessionsBtn = this.container.querySelector(
        '#rightbar-header-sessions'
      ) as HTMLButtonElement

      let isSidebarOpen = false
      sessionsBtn?.addEventListener('click', () => {
        if (this.sessionSidebar) {
          this.sessionSidebar.toggle()
          isSidebarOpen = !isSidebarOpen

          const newIcon = createElement(isSidebarOpen ? PanelLeft : PanelRight, {
            size: 16,
            'stroke-width': 2
          })

          sessionsBtn.innerHTML = ''
          sessionsBtn.appendChild(newIcon)
        }
      })

      // Initialize AI Menu
      this.aiMenu = new AIMenu(this.container)
      this.aiMenu.render('rightbar-header-ai-menu')
      this.aiMenu.setOnItemClick((itemId) => {
        void this.handleMenuAction(itemId)
      })
      this.updateMenuItems()

      // Add stop button listener
      const stopBtn = this.container.querySelector('#rightbar-chat-stop') as HTMLButtonElement
      stopBtn?.addEventListener('click', () => this.stopGeneration())
    }

    // Initial model badge
    this.updateModelBadge()

    // Listen for model changes
    window.addEventListener('knowledge-hub:settings-updated', () => {
      this.updateModelBadge()
    })
  }

  private updateModelBadge(): void {
    const badge = this.container.querySelector('#rightbar-model-badge') as HTMLElement
    if (!badge) return

    const provider = state.settings?.aiProvider || 'deepseek'
    let model = state.settings?.aiModel

    // Robust fallback if no model is selected
    if (!model || model === 'default') {
      if (provider === 'ollama') model = 'llama3'
      else if (provider === 'deepseek') model = 'deepseek-chat'
      else if (provider === 'openai') model = 'gpt-4o'
      else if (provider === 'claude') model = 'claude-3-5-sonnet-20240620'
      else if (provider === 'grok') model = 'grok-beta'
      else model = 'default'
    }

    const providerName =
      {
        ollama: 'Local',
        deepseek: 'DeepSeek',
        openai: 'OpenAI',
        claude: 'Claude',
        grok: 'Grok'
      }[provider] || provider

    const checkIcon = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#22c55e" style="margin-left: 4px;">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    `

    badge.innerHTML = `${model}${checkIcon}`
    badge.title = `Current Provider: ${providerName}\nModel: ${model}`
  }

  private attachEvents(): void {
    this.sendButton.addEventListener('click', () => this.sendMessage())

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when rightbar is visible and not typing in input
      const isRightbarVisible =
        this.container.classList.contains('rightbar--visible') || this.container.offsetWidth > 0
      if (!isRightbarVisible) return

      const activeElement = document.activeElement
      const isInputFocused =
        activeElement === this.chatInput ||
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA'

      // Ctrl/Cmd + K: Focus search in session sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !isInputFocused) {
        e.preventDefault()
        if (this.sessionSidebar) {
          this.sessionSidebar.show()
          const searchInput = document.querySelector(
            '#rightbar-session-sidebar-search'
          ) as HTMLInputElement
          searchInput?.focus()
        }
      }

      // Escape: Close session sidebar if open
      if (e.key === 'Escape' && !isInputFocused) {
        if (this.sessionSidebar) {
          this.sessionSidebar.hide()
        }
      }
    })

    this.chatInput.addEventListener('input', () => {
      this.updateCharacterCount()
      this.autoResizeTextarea()

      // Robust placeholder fix: if visually empty, truly clear innerHTML to trigger :empty
      const text = this.getPlainText()
      if (text.trim().length === 0 && !this.chatInput.querySelector('.rightbar__mention')) {
        if (this.chatInput.innerHTML !== '') {
          this.chatInput.innerHTML = ''
        }
      }

      // Clear any existing timeout
      if (this.typingTimeout !== null) {
        clearTimeout(this.typingTimeout)
      }

      // Remove highlight immediately when typing to avoid interference
      this.removeTypingHighlight()

      // Handle mention/command input with a small delay to avoid interfering with typing
      this.typingTimeout = window.setTimeout(() => {
        this.handleInputTrigger()
        this.updateNoteReferencesInContent()
      }, 100) // Short delay to let browser process input first
    })

    this.chatInput.addEventListener('paste', (e) => {
      e.preventDefault()
      const text = (e.clipboardData || (window as any).clipboardData).getData('text/plain')
      this.insertTextAtCursor(text)
    })

    this.chatInput.addEventListener('keydown', (e) => {
      // Handle mention deletion with Backspace
      if (e.key === 'Backspace') {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)

          // Try to find if we're deleting a mention
          let itemToDelete: HTMLElement | null = null

          if (selection.isCollapsed) {
            // Check if we are right at the edge of or inside a mention
            const container = range.startContainer
            const offset = range.startOffset

            // Helper to get element before caret
            let nodeBefore: Node | null = null
            if (container.nodeType === Node.TEXT_NODE) {
              if (offset === 0) {
                nodeBefore = container.previousSibling
              } else {
                // If it's just whitespace, check what's before it
                const textBefore = container.textContent?.substring(0, offset) || ''
                if (textBefore.trim().length === 0) {
                  nodeBefore = container.previousSibling
                }
              }
            } else if (container === this.chatInput) {
              nodeBefore = this.chatInput.childNodes[offset - 1]
            }

            // Skip any empty/whitespace text nodes before
            while (
              nodeBefore &&
              nodeBefore.nodeType === Node.TEXT_NODE &&
              !nodeBefore.textContent?.trim()
            ) {
              nodeBefore = nodeBefore.previousSibling
            }

            if (
              nodeBefore instanceof HTMLElement &&
              nodeBefore.classList.contains('rightbar__mention')
            ) {
              itemToDelete = nodeBefore
            }

            // Check if caret is actually INSIDE a mention text
            const mentionParent = container.parentElement?.closest('.rightbar__mention')
            if (mentionParent) {
              itemToDelete = mentionParent as HTMLElement
            }
          } else {
            // Case 3: Selection is a range that includes or is a mention
            const common = range.commonAncestorContainer
            const ancestor = common instanceof HTMLElement ? common : common.parentElement
            const mention = ancestor?.closest('.rightbar__mention') as HTMLElement
            if (mention) {
              itemToDelete = mention
            }
          }

          if (itemToDelete) {
            e.preventDefault()
            const parent = itemToDelete.parentNode
            if (parent) {
              // Get absolute text position before deletion
              const rangeClone = range.cloneRange()
              rangeClone.selectNodeContents(this.chatInput)
              rangeClone.setEnd(range.startContainer, range.startOffset)
              const cursorPos = rangeClone.toString().length

              // Calculate how much text is being removed
              const mentionLength = itemToDelete.textContent?.length || 0
              const newPos = Math.max(0, cursorPos - mentionLength)

              const textNode = document.createTextNode('')
              parent.replaceChild(textNode, itemToDelete)
              this.restoreCursorToOffset(newPos)
            } else {
              itemToDelete.remove()
            }
            this.updateCharacterCount()
            this.updateNoteReferencesInContent()
            this.autoResizeTextarea()
            return
          }
        }
      }

      if (this.autocompleteDropdown.style.display === 'block') {
        const itemsCount = this.autocompleteItems.length
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          this.selectedAutocompleteIndex = (this.selectedAutocompleteIndex + 1) % itemsCount
          this.updateAutocompleteSelection()
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          this.selectedAutocompleteIndex =
            (this.selectedAutocompleteIndex - 1 + itemsCount) % itemsCount
          this.updateAutocompleteSelection()
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          if (this.selectedAutocompleteIndex === -1 && itemsCount > 0) {
            this.selectedAutocompleteIndex = 0
          }
          if (this.selectedAutocompleteIndex !== -1) {
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
        this.sendMessage()
      }
    })

    // Hide autocomplete when clicking outside
    document.addEventListener('click', (e) => {
      const container = this.container.querySelector('#rightbar-chat-input-container')
      if (container && !container.contains(e.target as Node)) {
        this.hideAutocomplete()
      }
    })

    this.inputWrapper.addEventListener('click', (e) => {
      if (
        e.target === this.inputWrapper ||
        (e.target as HTMLElement).closest('.rightbar__chat-input-container')
      ) {
        this.chatInput.focus()
      }
    })

    if (this.resizeHandle) {
      this.resizeHandle.addEventListener('mousedown', (e) => this.handleResizeStart(e))
    }

    // Scroll listener to track if user is at bottom
    this.chatContainer.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.chatContainer
      // We are at bottom if we're within 50px of the actual bottom
      this.wasAtBottom = scrollHeight - scrollTop - clientHeight < 50
    })

    // Refresh notes when vault changes

    this.chatContainer.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-action]')
      if (!target) return
      const action = (target as HTMLElement).dataset.action
      const btn = target as HTMLButtonElement
      const state = this.conversationController.getState()

      if (action === 'copy') {
        const messageIndex = parseInt(btn.dataset.messageIndex || '0', 10)
        const message = state.messages[messageIndex]
        if (message) {
          // Get plain text from message content (remove markdown formatting)
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = this.formatContent(message.content, true)
          const plainText = tempDiv.textContent || tempDiv.innerText || ''

          navigator.clipboard
            .writeText(plainText)
            .then(() => {
              this.showCopyFeedback(btn)
            })
            .catch(() => {
              // Fallback
              const textarea = document.createElement('textarea')
              textarea.value = plainText
              textarea.style.position = 'fixed'
              textarea.style.left = '-9999px'
              textarea.style.top = '0'
              document.body.appendChild(textarea)
              textarea.focus()
              textarea.select()
              try {
                document.execCommand('copy')
                this.showCopyFeedback(btn)
              } catch (err) {
                console.error('Fallback copy failed', err)
              }
              document.body.removeChild(textarea)
            })
            .catch((err) => {
              console.error('Failed to copy:', err)
            })
        }
      } else if (action === 'thumbs-up' || action === 'thumbs-down') {
        const messageIndex = parseInt(btn.dataset.messageIndex || '0', 10)
        const message = state.messages[messageIndex]
        if (!message) return

        const currentFeedback = state.messageFeedback.get(messageIndex)
        const messageElement = btn.closest('.rightbar__message')

        // Get both buttons for this message
        const thumbsUpBtn = messageElement?.querySelector(
          '[data-action="thumbs-up"]'
        ) as HTMLButtonElement
        const thumbsDownBtn = messageElement?.querySelector(
          '[data-action="thumbs-down"]'
        ) as HTMLButtonElement

        let newFeedback: 'thumbs-up' | 'thumbs-down' | null = null

        if (action === 'thumbs-up') {
          if (currentFeedback === 'thumbs-up') {
            // Toggle off
            const newFeedbackMap = new Map(state.messageFeedback)
            newFeedbackMap.delete(messageIndex)
            this.conversationController.setFeedback(newFeedbackMap)
            thumbsUpBtn?.classList.remove('rightbar__message-action--active')
            newFeedback = null
          } else {
            // Set thumbs up, remove thumbs down
            const newFeedbackMap = new Map(state.messageFeedback)
            newFeedbackMap.set(messageIndex, 'thumbs-up')
            this.conversationController.setFeedback(newFeedbackMap)
            thumbsUpBtn?.classList.add('rightbar__message-action--active')
            thumbsDownBtn?.classList.remove('rightbar__message-action--active')
            newFeedback = 'thumbs-up'
          }
        } else if (action === 'thumbs-down') {
          if (currentFeedback === 'thumbs-down') {
            // Toggle off
            const newFeedbackMap = new Map(state.messageFeedback)
            newFeedbackMap.delete(messageIndex)
            this.conversationController.setFeedback(newFeedbackMap)
            thumbsDownBtn?.classList.remove('rightbar__message-action--active')
            newFeedback = null
          } else {
            // Set thumbs down, remove thumbs up
            const newFeedbackMap = new Map(state.messageFeedback)
            newFeedbackMap.set(messageIndex, 'thumbs-down')
            this.conversationController.setFeedback(newFeedbackMap)
            thumbsDownBtn?.classList.add('rightbar__message-action--active')
            thumbsUpBtn?.classList.remove('rightbar__message-action--active')
            newFeedback = 'thumbs-down'
          }
        }

        // Update message feedback and persist
        message.feedback = newFeedback
        void this.autoSaveSession()
      } else if (action === 'retry' && state.lastFailedMessage) {
        const toSend = state.lastFailedMessage
        void this.conversationController.sendMessage(toSend)
      } else if (action === 'regenerate') {
        const messageIndex = parseInt(btn.dataset.messageIndex || '0', 10)
        void this.conversationController.regenerateMessage(messageIndex)
      } else if (action === 'edit') {
        const messageIndex = parseInt(btn.dataset.messageIndex || '0', 10)
        this.editMessage(messageIndex)
      } else if (action === 'citations-toggle') {
        // Find the following buttons and toggle their visibility
        const container = btn.closest('.rightbar__message-citations')
        if (container) {
          const chips = container.querySelectorAll('.rightbar__message-citation')
          const firstChip = chips[0] as HTMLElement | undefined
          const isHidden = firstChip?.style.display === 'none'
          chips.forEach((chip) => {
            ;(chip as HTMLElement).style.display = isHidden ? 'inline-flex' : 'none'
          })
          btn.classList.toggle('is-collapsed', !isHidden)
        }
      } else if (action === 'copy-code') {
        const pre = btn.closest('pre')
        const codeEl = pre?.querySelector('code')
        if (codeEl) {
          const codeToCopy = codeEl.dataset.code || codeEl.textContent || ''
          navigator.clipboard
            .writeText(codeToCopy)
            .then(() => this.showCopyFeedback(btn))
            .catch(() => {
              const textarea = document.createElement('textarea')
              textarea.value = codeToCopy
              textarea.style.position = 'fixed'
              textarea.style.left = '-9999px'
              textarea.style.top = '0'
              document.body.appendChild(textarea)
              textarea.focus()
              textarea.select()
              try {
                document.execCommand('copy')
                this.showCopyFeedback(btn)
              } catch (err) {
                console.error('Fallback copy failed', err)
              }
              document.body.removeChild(textarea)
            })
        }
      } else if (btn.classList.contains('rightbar__message-citation')) {
        // Individual citation chip click (this works via delegation now)
        const noteId = btn.dataset.noteId
        const notePath = btn.dataset.notePath
        if (noteId) {
          window.dispatchEvent(
            new CustomEvent('knowledge-hub:open-note', {
              detail: { id: noteId, path: notePath || undefined }
            })
          )
        }
      }
    })
  }

  /**
   * Update menu items based on current state
   */
  private updateMenuItems(): void {
    const messages = this.conversationController.getState().messages
    const hasMessages = messages.length > 0
    const hasSession = this.currentSessionId !== null

    const items: AIMenuItem[] = [
      {
        id: 'export',
        label: 'Export Session',
        icon: Download,
        onClick: () => {},
        disabled: !hasMessages,
        shortcut: 'Ctrl+E'
      },
      {
        id: 'copy-conversation',
        label: 'Copy Conversation',
        icon: Copy,
        onClick: () => {},
        disabled: !hasMessages
      },
      {
        id: 'import',
        label: 'Import Session',
        icon: Upload,
        onClick: () => {},
        shortcut: 'Ctrl+I'
      },
      { separator: true },
      {
        id: 'clear',
        label: 'Clear Conversation',
        icon: Trash2,
        onClick: () => {},
        disabled: !hasMessages
      },
      {
        id: 'info',
        label: 'Session Info',
        icon: Info,
        onClick: () => {},
        disabled: !hasSession
      },
      {
        id: 'archive',
        label: 'Archive Session',
        icon: Archive,
        onClick: () => {},
        disabled: !hasSession
      },
      { separator: true },
      {
        id: 'settings',
        label: 'AI Settings',
        icon: Settings,
        onClick: () => {}
      }
    ]

    this.aiMenu.setItems(items)
  }

  /**
   * Handle menu action
   */
  private async handleMenuAction(itemId: string): Promise<void> {
    switch (itemId) {
      case 'settings':
        this.aiSettingsModal.open()
        break
      case 'export':
        await this.exportSession()
        break
      case 'copy-conversation':
        await copyConversationToClipboard(this.conversationController.getState().messages)
        break
      case 'import':
        await this.importSession()
        break
      case 'clear':
        await this.clearConversation()
        break
      case 'info':
        await this.showSessionInfo()
        break
      case 'archive':
        await this.archiveSession()
        break
    }
  }

  /**
   * Export current session to Markdown or JSON
   */
  private async exportSession(): Promise<void> {
    const session = await this.getCurrentSession()
    const messages = this.conversationController.getState().messages
    await this.sessionManager.exportToMarkdown(messages, session?.title)
  }

  /**
   * Import session from file
   */
  private async importSession(): Promise<void> {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.json'
      input.style.display = 'none'
      document.body.appendChild(input)

      input.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) {
          document.body.removeChild(input)
          return
        }

        try {
          const text = await file.text()
          const lines = text.split('\n')
          let title = file.name.replace(/\.(md|json)$/i, '')
          const messages: ChatMessage[] = []
          let currentRole: 'user' | 'assistant' | null = null
          let currentContent: string[] = []

          for (const line of lines) {
            if (line.startsWith('# ')) {
              title = line.slice(2).trim()
            } else if (line.startsWith('### **You**')) {
              if (currentRole && currentContent.length > 0) {
                messages.push({
                  role: currentRole,
                  content: currentContent.join('\n').trim(),
                  timestamp: Date.now()
                })
              }
              currentRole = 'user'
              currentContent = []
            } else if (line.startsWith('### **AI**')) {
              if (currentRole && currentContent.length > 0) {
                messages.push({
                  role: currentRole,
                  content: currentContent.join('\n').trim(),
                  timestamp: Date.now()
                })
              }
              currentRole = 'assistant'
              currentContent = []
            } else if (currentRole && !line.startsWith('---') && !line.startsWith('*Exported')) {
              currentContent.push(line)
            }
          }

          if (currentRole && currentContent.length > 0) {
            messages.push({
              role: currentRole,
              content: currentContent.join('\n').trim(),
              timestamp: Date.now()
            })
          }

          if (messages.length > 0) {
            await this.sessionManager.createNewSession(messages, title)
          }
        } catch (error) {
          console.error('[RightBar] Failed to import session:', error)
        }
        document.body.removeChild(input)
      })
      input.click()
    } catch (error) {
      console.error('[RightBar] Failed to import session:', error)
    }
  }

  /**
   * Clear current conversation
   */
  private async clearConversation(): Promise<void> {
    if (this.conversationController.getState().messages.length === 0) return

    const { modalManager } = await import('../modal/modal')
    modalManager.open({
      title: 'Clear Conversation',
      content: 'Are you sure you want to clear this conversation? This action cannot be undone.',
      size: 'sm',
      buttons: [
        {
          label: 'Clear',
          variant: 'danger',
          onClick: async (m) => {
            m.close()
            await this.startNewSession()
          }
        },
        { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() }
      ]
    })
  }

  /**
   * Show session information
   */
  private async showSessionInfo(): Promise<void> {
    if (!this.currentSessionId) return

    try {
      const session = await sessionStorageService.getSession(this.currentSessionId)
      if (!session) return

      const createdDate = new Date(session.metadata.created_at).toLocaleString()
      const updatedDate = new Date(session.metadata.updated_at).toLocaleString()
      const messageCount = session.messages.length
      const userMessages = session.messages.filter((m) => m.role === 'user').length
      const assistantMessages = session.messages.filter((m) => m.role === 'assistant').length

      const { modalManager } = await import('../modal/modal')

      // Build custom content element to avoid HTML escaping
      const infoContent = document.createElement('div')
      infoContent.style.fontSize = '12px'
      infoContent.style.lineHeight = '1.6'

      const items = [
        { label: 'Title', value: session.title },
        { label: 'Created', value: createdDate },
        { label: 'Last Updated', value: updatedDate },
        { label: 'Total Messages', value: String(messageCount) },
        { label: 'User Messages', value: String(userMessages) },
        { label: 'AI Messages', value: String(assistantMessages) }
      ]

      if (session.metadata.note_references && session.metadata.note_references.length > 0) {
        items.push({
          label: 'Referenced Notes',
          value: String(session.metadata.note_references.length)
        })
      }

      items.forEach((item) => {
        const p = document.createElement('p')
        p.style.margin = '8px 0'
        const strong = document.createElement('strong')
        strong.textContent = `${item.label}: `
        p.appendChild(strong)
        p.appendChild(document.createTextNode(item.value))
        infoContent.appendChild(p)
      })

      modalManager.open({
        title: 'Session Information',
        customContent: infoContent,
        size: 'sm',
        buttons: [{ label: 'Close', variant: 'primary', onClick: (m) => m.close() }]
      })
    } catch (error) {
      console.error('[RightBar] Failed to show session info:', error)
    }
  }

  /**
   * Archive current session
   */
  private async archiveSession(): Promise<void> {
    if (!this.currentSessionId) return

    try {
      const { modalManager } = await import('../modal/modal')
      modalManager.open({
        title: 'Archive Session',
        content:
          'Are you sure you want to archive this session? You can restore it later from the sessions list.',
        size: 'sm',
        buttons: [
          {
            label: 'Archive',
            variant: 'primary',
            onClick: async (m) => {
              m.close()
              await this.sessionManager.archiveCurrent()
            }
          },
          { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() }
        ]
      })
    } catch (error) {
      console.error('[RightBar] Failed to archive session:', error)
    }
  }

  /**
   * Open AI settings
   */
  // private openAISettings(): void {
  //   this.aiSettingsModal.open()
  // }

  /**
   * Regenerate AI response from a specific message
   */

  /**
   * Edit a user message and regenerate response
   */
  /**
   * Edit a user message and regenerate response
   */
  private editMessage(messageIndex: number): void {
    const state = this.conversationController.getState()
    const message = state.messages[messageIndex]
    if (!message || message.role !== 'user') return

    // Set input to message content
    this.chatInput.textContent = message.content
    this.chatInput.innerHTML = this.escapeHtml(message.content)
    this.updateCharacterCount()
    this.autoResizeTextarea()

    // Regenerate from that point
    void this.conversationController.regenerateMessage(messageIndex + 1) // +1 because regenerateMessage expects the index of the ASSISTANT message to regenerate, but here we are editing the USER message.

    // Wait, the new logic for editMessage should probably be:
    // 1. Get the content
    // 2. Clear from that message onwards (inclusive)
    // 3. Put content in input box
    // 4. Focus input

    // Actually, `regenerateMessage` in ConversationController removes the assistant message and subsequent.
    // If we are editing a USER message, we want to remove the user message and subsequent, and put text in input.

    // Let's implement that logic here using setMessages
    const newMessages = state.messages.slice(0, messageIndex)
    this.conversationController.setMessages(newMessages)

    // Focus input
    this.chatInput.focus()

    // Scroll to input
    this.chatInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  private handleResizeStart(e: MouseEvent): void {
    e.preventDefault()
    this.isResizing = true
    this.startX = e.clientX
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    if (shell) {
      const currentWidth = parseInt(
        getComputedStyle(shell).getPropertyValue('--right-panel-width') || '270',
        10
      )
      this.startWidth = currentWidth
    }
    document.addEventListener('mousemove', this.handleResizeMove)
    document.addEventListener('mouseup', this.handleResizeEnd)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  private handleResizeMove = (e: MouseEvent): void => {
    if (!this.isResizing) return
    const deltaX = this.startX - e.clientX
    const newWidth = Math.max(200, Math.min(800, this.startWidth + deltaX))
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    if (shell) shell.style.setProperty('--right-panel-width', `${newWidth}px`)
  }

  private handleResizeEnd = (): void => {
    if (!this.isResizing) return
    this.isResizing = false
    document.removeEventListener('mousemove', this.handleResizeMove)
    document.removeEventListener('mouseup', this.handleResizeEnd)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    if (shell) {
      const w = parseInt(
        getComputedStyle(shell).getPropertyValue('--right-panel-width') || '270',
        10
      )
      if (w > 0) void window.api.updateSettings({ rightPanelWidth: w })
    }
  }

  private autoResizeTextarea(): void {
    this.chatInput.style.height = 'auto'
    this.chatInput.style.height = `${Math.min(this.chatInput.scrollHeight, 200)}px`
  }

  private stopGeneration(): void {
    this.conversationController.stopGeneration()
  }

  private updateGenerationUI(loading: boolean): void {
    const sendBtn = this.container.querySelector('#rightbar-chat-send') as HTMLElement
    const stopBtn = this.container.querySelector('#rightbar-chat-stop') as HTMLElement

    if (loading) {
      if (sendBtn) sendBtn.style.display = 'none'
      if (stopBtn) stopBtn.style.display = 'flex'
    } else {
      if (sendBtn) sendBtn.style.display = 'flex'
      if (stopBtn) stopBtn.style.display = 'none'
    }
  }

  private initModeSelector(): void {
    if (!this.modeButton || !this.modeDropdown) return

    // Load persisted mode and update UI
    const savedMode = aiService.getMode()
    this.updateModeUI(savedMode)

    // Toggle dropdown with fixed positioning
    this.modeButton.addEventListener('click', (e) => {
      e.stopPropagation()
      const isOpen = this.modeDropdown.classList.contains('is-open')

      if (!isOpen) {
        // Dropdown positioning is handled by CSS (absolute positioning)
        // No manual calculation needed
        this.modeDropdown.classList.add('is-open')
      } else {
        this.modeDropdown.classList.remove('is-open')
      }
    })

    // Handle mode selection
    this.modeDropdown.querySelectorAll('.rightbar__mode-option').forEach((option) => {
      option.addEventListener('click', (e) => {
        e.stopPropagation()
        const mode = (option as HTMLElement).dataset.mode as ChatMode
        this.setMode(mode)
        this.modeDropdown.classList.remove('is-open')
      })
    })

    // Close dropdown on outside click
    document.addEventListener('click', () => {
      this.modeDropdown?.classList.remove('is-open')
    })

    // Prevent dropdown from closing when clicking inside
    this.modeDropdown.addEventListener('click', (e) => {
      e.stopPropagation()
    })
  }

  private updateModeUI(mode: ChatMode): void {
    const modeConfig = CHAT_MODES.find((m) => m.id === mode)
    if (modeConfig && this.modeButton) {
      const iconEl = this.modeButton.querySelector('.rightbar__mode-icon')
      const labelEl = this.modeButton.querySelector('.rightbar__mode-label')
      if (iconEl) iconEl.textContent = modeConfig.icon
      if (labelEl) labelEl.textContent = modeConfig.label
    }

    // Update active state in dropdown
    this.modeDropdown?.querySelectorAll('.rightbar__mode-option').forEach((option) => {
      option.classList.toggle('is-active', (option as HTMLElement).dataset.mode === mode)
    })
  }

  private setMode(mode: ChatMode): void {
    aiService.setMode(mode)
    this.updateModeUI(mode)
  }

  private updateCharacterCount(): void {
    if (!this.characterCounter) {
      this.characterCounter = this.container.querySelector('#rightbar-chat-counter') as HTMLElement
    }

    if (this.characterCounter) {
      const text = this.getPlainText()
      const count = text.length
      this.characterCounter.textContent = count.toString()
    }
  }

  private getPlainText(): string {
    // Get text content, removing HTML tags but preserving text
    const clone = this.chatInput.cloneNode(true) as HTMLElement
    // Remove mention spans but keep their text
    clone.querySelectorAll('.rightbar__mention').forEach((span) => {
      const text = span.textContent || ''
      span.replaceWith(document.createTextNode(text))
    })
    return clone.textContent || ''
  }

  private insertTextAtCursor(text: string): void {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    range.deleteContents()
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.setEndAfter(textNode)
    selection.removeAllRanges()
    selection.addRange(range)

    this.updateCharacterCount()
    this.autoResizeTextarea()
  }

  private handleInputTrigger(): void {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      this.hideAutocomplete()
      this.removeTypingHighlight()
      return
    }

    const range = selection.getRangeAt(0)

    // Clone range and get text before cursor
    const rangeClone = range.cloneRange()
    rangeClone.selectNodeContents(this.chatInput)
    rangeClone.setEnd(range.endContainer, range.endOffset)
    const textBeforeCursor = rangeClone.toString()

    // Find the last trigger character (@ or /) before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/')

    // Determine which trigger is valid and closer to cursor
    let triggerChar = ''
    let triggerIndex = -1

    if (lastAtIndex > lastSlashIndex) {
      triggerChar = '@'
      triggerIndex = lastAtIndex
    } else if (lastSlashIndex > lastAtIndex) {
      triggerChar = '/'
      triggerIndex = lastSlashIndex
    }

    if (triggerIndex === -1) {
      this.hideAutocomplete()
      this.removeTypingHighlight()
      return
    }

    // Check if there's a character before the trigger (must be space or start of line)
    if (triggerIndex > 0) {
      const charBefore = textBeforeCursor[triggerIndex - 1]
      if (!/[\s\n]/.test(charBefore)) {
        this.hideAutocomplete()
        this.removeTypingHighlight()
        return
      }
    }

    // Check if there's a space or newline after the trigger (unless it's start of line)
    // Also ensure / is at the start of a line or only whitespace before it
    if (triggerChar === '/') {
      const beforeTrigger = textBeforeCursor.substring(0, triggerIndex)
      if (beforeTrigger.trim().length > 0) {
        // Slash command must be at start of line
        this.hideAutocomplete()
        this.removeTypingHighlight()
        return
      }
    }

    // Check if there's a space or newline after the trigger
    const afterTrigger = textBeforeCursor.substring(triggerIndex + 1)
    if (afterTrigger.match(/[\s\n]/)) {
      this.hideAutocomplete()
      this.removeTypingHighlight()
      return
    }

    // Get the query (text after trigger)
    const query = afterTrigger.toLowerCase().trim()

    // Show autocomplete
    this.showAutocomplete(triggerIndex, query, range, triggerChar)

    // Highlight the typing mention with proper cursor preservation
    if (query.length > 0) {
      // Calculate cursor offset from the start of the mention
      const cursorOffset = textBeforeCursor.length - triggerIndex

      // Use requestAnimationFrame to ensure highlighting happens after browser processes input
      requestAnimationFrame(() => {
        this.highlightTypingMention(triggerIndex, query.length, cursorOffset)
      })
    } else {
      this.removeTypingHighlight()
    }
  }

  private highlightTypingMention(atIndex: number, queryLength: number, cursorOffset: number): void {
    // Check if we already have a highlight for this same position
    const existingHighlight = (this.chatInput as any).__typingHighlight as HTMLElement | null
    if (existingHighlight && existingHighlight.parentNode) {
      // If the highlight span already exists at the right place, we'll just ensure
      // the cursor is restored correctly below.
    }

    // Remove existing typing highlight first
    this.removeTypingHighlight()

    // Only highlight if there's actually text to highlight
    if (queryLength === 0) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    // Get current cursor position BEFORE any DOM manipulation
    const currentRange = selection.getRangeAt(0)
    const cursorTextRange = currentRange.cloneRange()
    cursorTextRange.selectNodeContents(this.chatInput)
    cursorTextRange.setEnd(currentRange.endContainer, currentRange.endOffset)

    // Find the text node containing @ and the query
    const walker = document.createTreeWalker(this.chatInput, NodeFilter.SHOW_TEXT)
    let textPos = 0
    let targetNode: Text | null = null
    let atOffset = 0
    let queryEndOffset = 0

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const nodeText = node.textContent || ''
      const nodeLength = nodeText.length

      // Check if @ is in this node
      if (textPos <= atIndex && atIndex < textPos + nodeLength) {
        targetNode = node
        atOffset = atIndex - textPos
        queryEndOffset = atOffset + 1 + queryLength
        break
      }

      textPos += nodeLength
    }

    if (targetNode && queryEndOffset <= (targetNode.textContent || '').length) {
      try {
        const text = targetNode.textContent || ''
        const beforeText = text.substring(0, atOffset)
        const highlightText = text.substring(atOffset, queryEndOffset)
        const afterText = text.substring(queryEndOffset)

        if (highlightText.length === 0) return

        // Create new structure
        const beforeNode = beforeText ? document.createTextNode(beforeText) : null
        const highlightSpan = document.createElement('span')
        highlightSpan.className = 'rightbar__mention-typing'
        highlightSpan.textContent = highlightText
        const afterNode = afterText ? document.createTextNode(afterText) : null

        // Replace the text node
        const parent = targetNode.parentNode
        if (parent) {
          // Insert new nodes
          if (beforeNode) parent.insertBefore(beforeNode, targetNode)
          parent.insertBefore(highlightSpan, targetNode)
          if (afterNode) parent.insertBefore(afterNode, targetNode)
          parent.removeChild(targetNode)
          ;(this.chatInput as any).__typingHighlight = highlightSpan

          // Restore cursor at the exact relative position the user was at
          this.restoreCursorToOffset(atIndex + cursorOffset)
        }
      } catch {
        // Highlight error
      }
    }
  }

  private restoreCursorToOffset(offset: number): void {
    const selection = window.getSelection()
    if (!selection) return

    const walker = document.createTreeWalker(this.chatInput, NodeFilter.SHOW_TEXT)
    let currentPos = 0
    let targetNode: Text | null = null
    let targetOffset = 0

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const nodeLength = (node.textContent || '').length

      if (currentPos <= offset && offset <= currentPos + nodeLength) {
        targetNode = node
        targetOffset = offset - currentPos
        break
      }

      currentPos += nodeLength
    }

    if (targetNode) {
      const newRange = document.createRange()
      newRange.setStart(targetNode, targetOffset)
      newRange.setEnd(targetNode, targetOffset)
      selection.removeAllRanges()
      selection.addRange(newRange)
    }
  }

  private removeTypingHighlight(): void {
    const highlight = (this.chatInput as any).__typingHighlight
    if (highlight && highlight.parentNode) {
      // Store cursor position before removing
      const selection = window.getSelection()
      let cursorPos = 0
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const rangeClone = range.cloneRange()
        rangeClone.selectNodeContents(this.chatInput)
        rangeClone.setEnd(range.endContainer, range.endOffset)
        cursorPos = rangeClone.toString().length
      }

      const parent = highlight.parentNode
      const text = highlight.textContent || ''
      const textNode = document.createTextNode(text)
      parent.replaceChild(textNode, highlight)

      // Restore cursor position
      if (selection) {
        const walker = document.createTreeWalker(this.chatInput, NodeFilter.SHOW_TEXT)
        let currentPos = 0
        let targetNode: Text | null = null
        let targetOffset = 0

        while (walker.nextNode()) {
          const node = walker.currentNode as Text
          const nodeLength = (node.textContent || '').length

          if (currentPos <= cursorPos && cursorPos <= currentPos + nodeLength) {
            targetNode = node
            targetOffset = cursorPos - currentPos
            break
          }

          currentPos += nodeLength
        }

        if (targetNode) {
          const newRange = document.createRange()
          newRange.setStart(targetNode, targetOffset)
          newRange.setEnd(targetNode, targetOffset)
          selection.removeAllRanges()
          selection.addRange(newRange)
        }
      }

      ;(this.chatInput as any).__typingHighlight = null
    }
  }

  private showAutocomplete(
    atIndex: number,
    query: string,
    range: Range,
    triggerChar: string = '@'
  ): void {
    let items: any[] = []

    if (triggerChar === '@') {
      items = state.notes
        .filter((note) => {
          const titleLower = (note.title || note.id).toLowerCase()
          return titleLower.includes(query) || titleLower.startsWith(query)
        })
        .slice(0, 8)
    } else if (triggerChar === '/') {
      items = this.slashCommands.filter((cmd) => {
        const cmdName = cmd.command.toLowerCase().substring(1) // remove /
        return cmdName.startsWith(query) || cmdName.includes(query)
      })
    }

    if (items.length === 0) {
      this.hideAutocomplete()
      return
    }

    this.autocompleteItems = []
    this.selectedAutocompleteIndex = -1

    // Store context for selection
    ;(this.autocompleteDropdown as any).__context = { atIndex, range, query, triggerChar }

    const html = items
      .map((item, index) => {
        if (triggerChar === '@') {
          // Note item
          const note = item
          const displayTitle = note.title
          const displayPath = note.path ? `/${note.path}` : ''
          return `
        <div class="rightbar__autocomplete-item ${index === 0 ? 'is-selected' : ''}" data-index="${index}" data-note-id="${note.id}" data-note-title="${displayTitle}" data-type="note">
          <div class="rightbar__autocomplete-item-title">${this.escapeHtml(displayTitle)}</div>
          ${displayPath ? `<div class="rightbar__autocomplete-item-path">${this.escapeHtml(displayPath)}</div>` : ''}
        </div>
      `
        } else {
          // Command item
          const cmd = item
          const iconHtml = this.createLucideIcon(cmd.icon, 13, 1.5)
          return `
        <div class="rightbar__autocomplete-item ${index === 0 ? 'is-selected' : ''}" data-index="${index}" data-command="${cmd.command}" data-type="command">
          <div class="rightbar__autocomplete-item-row" style="display: flex; align-items: center; gap: 8px;">
            <div class="rightbar__autocomplete-item-icon" style="display: flex;">${iconHtml}</div>
            <div class="rightbar__autocomplete-item-title">${this.escapeHtml(cmd.command)}</div>
          </div>
          <div class="rightbar__autocomplete-item-path">${this.escapeHtml(cmd.description)}</div>
        </div>
      `
        }
      })
      .join('')

    this.autocompleteDropdown.innerHTML = html
    this.autocompleteDropdown.style.display = 'block'

    // Get all items for keyboard navigation
    this.autocompleteItems = Array.from(
      this.autocompleteDropdown.querySelectorAll('.rightbar__autocomplete-item')
    ) as HTMLElement[]

    // Add click handlers
    this.autocompleteItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectedAutocompleteIndex = index
        this.selectAutocompleteItem()
      })
    })
  }

  private updateAutocompleteSelection(): void {
    this.autocompleteItems.forEach((item, index) => {
      if (index === this.selectedAutocompleteIndex) {
        item.classList.add('is-selected')
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      } else {
        item.classList.remove('is-selected')
      }
    })
  }

  private selectAutocompleteItem(): void {
    if (
      this.selectedAutocompleteIndex < 0 ||
      this.selectedAutocompleteIndex >= this.autocompleteItems.length
    ) {
      return
    }

    const item = this.autocompleteItems[this.selectedAutocompleteIndex]
    const type = item.dataset.type || 'note'

    const context = (this.autocompleteDropdown as any).__context
    if (!context) return

    let contentToInsert = ''
    let isMention = false

    if (type === 'note') {
      const noteTitle = item.dataset.noteTitle || ''
      if (!noteTitle) return
      contentToInsert = noteTitle
      isMention = true
    } else if (type === 'command') {
      const command = item.dataset.command || ''
      if (!command) return
      contentToInsert = command // Use full command like /clear
      isMention = false
    }

    const { atIndex } = context

    // Get current selection to find where the query actually ends
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const currentRange = selection.getRangeAt(0)

    // Get all text before cursor to find where the query ends
    const textRange = currentRange.cloneRange()
    textRange.selectNodeContents(this.chatInput)
    textRange.setEnd(currentRange.endContainer, currentRange.endOffset)
    const textBeforeCursor = textRange.toString()

    // Find where the query ends (either at space, newline, or end of text)
    const afterAt = textBeforeCursor.substring(atIndex + 1)
    const spaceIndex = afterAt.search(/[\s\n]/)
    const queryEndIndex = spaceIndex === -1 ? afterAt.length : spaceIndex
    const actualQueryEnd = atIndex + 1 + queryEndIndex

    // Create new range to replace from @ to end of query
    const replaceRange = document.createRange()

    // Find the @ position and query end position in DOM
    const walker = document.createTreeWalker(this.chatInput, NodeFilter.SHOW_TEXT)
    let currentPos = 0
    let startNode: Node | null = null
    let startOffset = 0
    let endNode: Node | null = null
    let endOffset = 0

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const nodeText = node.textContent || ''
      const nodeLength = nodeText.length

      // Find start (trigger position)
      if (!startNode && currentPos <= atIndex && atIndex < currentPos + nodeLength) {
        startNode = node
        startOffset = atIndex - currentPos
      }

      // Find end (end of query)
      if (!endNode && currentPos <= actualQueryEnd && actualQueryEnd <= currentPos + nodeLength) {
        endNode = node
        endOffset = actualQueryEnd - currentPos
        break
      }

      currentPos += nodeLength
    }

    if (startNode && endNode) {
      replaceRange.setStart(startNode, startOffset)
      replaceRange.setEnd(endNode, endOffset)
      replaceRange.deleteContents()

      // Remove any existing typing highlight
      this.removeTypingHighlight()

      if (isMention) {
        // Create mention span
        const mentionSpan = document.createElement('span')
        mentionSpan.className = 'rightbar__mention'
        // mentionSpan.dataset.noteId = noteId // We don't have noteId here for commands, but for notes
        // Wait, noteId variable was removed?
        // Ah, I need to get noteId for mentions again.
        if (type === 'note') {
          const id = item.dataset.noteId || ''
          mentionSpan.dataset.noteId = id
          mentionSpan.dataset.noteTitle = contentToInsert
        }

        mentionSpan.contentEditable = 'false'
        mentionSpan.textContent = `@${contentToInsert}`

        replaceRange.insertNode(mentionSpan)

        // Add a space after the mention
        const space = document.createTextNode(' ')
        mentionSpan.after(space)

        // Position caret
        const newRange = document.createRange()
        newRange.setStartAfter(space)
        newRange.setEndAfter(space)
        if (selection) {
          selection.removeAllRanges()
          selection.addRange(newRange)
        }
      } else {
        // Command insertion (plain text)
        // contentToInsert contains the full command e.g. "/clear"
        const textNode = document.createTextNode(contentToInsert) // Command text
        replaceRange.insertNode(textNode)

        // Add space?
        // Usually yes so user can type args if any
        // All current commands don't take args but good practice?
        // Actually /new, /clear, /export don't take args.
        // /help doesn't.
        // Let's just put cursor after.

        const newRange = document.createRange()
        newRange.setStartAfter(textNode)
        newRange.setEndAfter(textNode)
        if (selection) {
          selection.removeAllRanges()
          selection.addRange(newRange)
        }
      }
    }

    this.hideAutocomplete()
    this.autoResizeTextarea()
    this.updateCharacterCount()
    this.updateNoteReferencesInContent()
    this.chatInput.focus()
  }

  private hideAutocomplete(): void {
    this.autocompleteDropdown.style.display = 'none'
    this.selectedAutocompleteIndex = -1
  }

  private updateNoteReferencesInContent(): void {
    // Find all mention spans and ensure they're styled correctly
    const mentions = this.chatInput.querySelectorAll('.rightbar__mention')
    const refs = new Set<string>()

    mentions.forEach((mention) => {
      const noteId = (mention as HTMLElement).dataset.noteId
      if (noteId) refs.add(noteId)
    })

    // refs collected but not used further
  }

  private sendMessage(): void {
    const text = this.getPlainText().trim()
    if (!text) return

    // Handle slash commands
    if (text.startsWith('/')) {
      const command = text.split(' ')[0].toLowerCase()
      switch (command) {
        case '/clear':
          this.chatInput.innerHTML = ''
          this.autoResizeTextarea()
          this.updateCharacterCount()
          void this.clearConversation()
          return
        case '/new':
          this.chatInput.innerHTML = ''
          this.autoResizeTextarea()
          this.updateCharacterCount()
          void this.startNewSession()
          return
        case '/help':
          void this.conversationController.addMessage(
            'assistant',
            `**Available Commands:**\n\n` +
              this.slashCommands.map((c) => `- \`${c.command}\`: ${c.description}`).join('\n')
          )
          this.chatInput.innerHTML = ''
          this.autoResizeTextarea()
          this.updateCharacterCount()
          return
        case '/export':
          this.chatInput.innerHTML = ''
          this.autoResizeTextarea()
          this.updateCharacterCount()
          void this.exportSession()
          return
      }
    }

    // Clear the contenteditable
    this.chatInput.innerHTML = ''
    this.chatInput.textContent = ''
    this.autoResizeTextarea()
    this.updateCharacterCount()
    this.updateNoteReferencesInContent()
    void this.conversationController.sendMessage(text)
  }

  private formatContent(text: string, isAssistant: boolean): string {
    return messageFormatter.format(text, isAssistant)
  }

  private escapeHtml(raw: string): string {
    return messageFormatter.escapeHtml(raw)
  }

  private showCopyFeedback(button: HTMLElement): void {
    const originalHTML = button.innerHTML
    const isSmall = button.classList.contains('rightbar__message-action')
    const size = isSmall ? 12 : 14
    const stroke = isSmall ? 2 : 1.5
    const color = isSmall ? '#22c55e' : undefined

    button.innerHTML = this.createLucideIcon(Check, size, stroke, color)
    button.classList.add(
      isSmall ? 'rightbar__message-action--copied' : 'rightbar__code-copy--copied'
    )
    const originalTitle = button.title
    button.title = 'Copied!'

    setTimeout(() => {
      button.innerHTML = originalHTML
      button.classList.remove(
        isSmall ? 'rightbar__message-action--copied' : 'rightbar__code-copy--copied'
      )
      button.title = originalTitle
    }, 2000)
  }

  private createLucideIcon(
    IconComponent: any,
    size: number = 12,
    strokeWidth: number = 1.5,
    color?: string
  ): string {
    // Use Lucide's createElement to create SVG element
    const svgElement = createElement(IconComponent, {
      size: size,
      'stroke-width': strokeWidth,
      stroke: color || 'currentColor',
      color: color || 'currentColor'
    })
    // Convert SVGElement to string
    if (svgElement && svgElement.outerHTML) {
      return svgElement.outerHTML
    }
    return ''
  }

  private renderMessages(): void {
    const convState = this.conversationController.getState()
    const state: RendererState = {
      messages: convState.messages,
      isLoading: convState.isLoading,
      isExecutingCommand: convState.isExecutingCommand,
      streamingMessageIndex: convState.streamingMessageIndex,
      messageFeedback: convState.messageFeedback,
      lastFailedMessage: convState.lastFailedMessage
    }
    this.chatRenderer.render(state, this.wasAtBottom)
    this.updateGenerationUI(convState.isLoading || convState.isExecutingCommand)
  }

  /**
   * Enhance code blocks with syntax highlighting and copy buttons
   */

  async refreshApiKey(): Promise<void> {
    await aiService.loadApiKey()

    const wasEmpty = this.conversationController.getState().messages.length === 0
    this.render()
    this.attachEvents()
    if (wasEmpty && !aiService.getApiKey()) {
      void this.conversationController.addMessage(
        'assistant',
        '👋 **Welcome!** Add your DeepSeek API key in **Settings → Behavior → DeepSeek API Key**. Get it at [platform.deepseek.com](https://platform.deepseek.com)'
      )
    }
  }
}
