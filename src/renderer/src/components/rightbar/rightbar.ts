import { aiService, type ChatMessage, type ChatMode, CHAT_MODES } from '../../services/aiService'
import { sessionStorageService, type ChatSession } from '../../services/sessionStorageService'
import { SessionSidebar } from './session-sidebar'
import { AIMenu, type AIMenuItem } from './ai-menu'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { Avatar } from './avatar'
import {
  createElement,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Check,
  Search,
  Download,
  Edit2,
  RotateCw,
  Upload,
  Trash2,
  Settings,
  Info,
  Archive
} from 'lucide'
import './rightbar.css'
import './ai-menu.css'

// Lazy load highlight.js - load it once when first code block is encountered
let hljsPromise: Promise<any> | null = null
const initHighlightJS = (): Promise<any> => {
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

const WELCOME_HTML = `
  <div class="rightbar__welcome">
    <div class="rightbar__welcome-icon">✨</div>
    <p class="rightbar__welcome-title">AI Chat</p>
    <p class="rightbar__welcome-text">Ask about your notes, get summaries, or brainstorm ideas. I have context from your current note.</p>
    <p class="rightbar__welcome-hint">Ctrl+I to toggle · Drag the left edge to resize</p>
  </div>
`

const TYPING_HTML = `
  <div class="rightbar__typing" aria-live="polite">
    ${Avatar.createHTML('assistant', 20)}
    <div class="rightbar__typing-dots">
    <span></span><span></span><span></span>
    </div>
  </div>
`

export class RightBar {
  private container: HTMLElement
  private chatContainer!: HTMLElement
  private chatInput!: HTMLElement
  private sendButton!: HTMLButtonElement
  private inputWrapper!: HTMLElement
  private resizeHandle!: HTMLElement
  private messages: ChatMessage[] = []
  private isResizing = false
  private startX = 0
  private startWidth = 0
  private isLoading = false
  private lastFailedMessage: string | null = null
  private md: MarkdownIt
  private autocompleteDropdown!: HTMLElement
  private autocompleteItems: HTMLElement[] = []
  private selectedAutocompleteIndex = -1
  private allNotes: Array<{ id: string; title: string; path?: string }> = []
  private noteReferences: Set<string> = new Set()
  private characterCounter!: HTMLElement
  private typingTimeout: number | null = null
  private currentSessionId: string | null = null
  private saveTimeout: number | null = null
  private isInitialized = false
  private messageFeedback: Map<number, 'thumbs-up' | 'thumbs-down' | null> = new Map() // Track feedback per message index
  private streamingMessageIndex: number | null = null // Track which message is currently streaming
  private streamingAbortController: AbortController | null = null // For canceling streaming
  private aiMenu!: AIMenu
  private modeDropdown!: HTMLElement
  private modeButton!: HTMLElement

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.md = new MarkdownIt({
      html: false, // Disable HTML for security - let DOMPurify handle it
      linkify: true,
      breaks: true, // Convert \n to <br> for chat
      typographer: true,
      highlight: (str: string, lang: string) => {
        // Normalize language name
        const normalizedLang = lang ? lang.toLowerCase().trim() : ''

        // Escape HTML for security (always do this)
        const escaped = this.md.utils.escapeHtml(str)

        // Try to highlight synchronously if hljs is already loaded
        // Note: We'll enhance code blocks after rendering with highlight.js
        if (normalizedLang) {
          return `<pre class="hljs"><code class="language-${this.md.utils.escapeHtml(normalizedLang)}" data-lang="${this.md.utils.escapeHtml(normalizedLang)}" data-code="${this.md.utils.escapeHtml(str.replace(/"/g, '&quot;'))}">${escaped}</code></pre>`
        }
        return `<pre class="hljs"><code>${escaped}</code></pre>`
      }
    })

    // Initialize highlight.js in background
    void initHighlightJS()
    void aiService.loadApiKey()
    void this.loadNotes()
    this.render()
    this.attachEvents()
    void this.initializeSession()
  }

  /**
   * Initialize session storage and load/create session
   */
  private async initializeSession(): Promise<void> {
    try {
      // Initialize IndexedDB
      await sessionStorageService.getAllSessions()
      this.isInitialized = true

      // Try to restore last active session
      const lastSessionId = localStorage.getItem('knowledgeHub_currentSessionId')
      if (lastSessionId && this.sessionSidebar) {
        try {
          const session = await sessionStorageService.getSession(lastSessionId)
          if (session) {
            // Restore the session
            this.messages = [...session.messages]
            this.currentSessionId = session.id
            this.sessionSidebar.setCurrentSession(session.id)
            this.renderMessages()
            this.updateMenuItems() // Update menu after restoring session
            return // Don't create a new session
          }
        } catch (error) {
          console.warn('[RightBar] Failed to restore last session:', error)
          localStorage.removeItem('knowledgeHub_currentSessionId')
        }
      }

      // Create a new session if we don't have messages (only after sidebar is initialized)
      if (this.messages.length === 0 && this.sessionSidebar) {
        await this.createNewSession()
      }
      this.updateMenuItems() // Update menu after initialization
    } catch (error) {
      console.error('[RightBar] Failed to initialize session storage:', error)
      this.isInitialized = false
    }
  }

  /**
   * Create a new session or reuse existing empty session
   */
  private async createNewSession(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeSession()
    }

    try {
      // Check if there's an existing empty session (no messages)
      const allSessions = await sessionStorageService.getAllSessions(false)
      const emptySession = allSessions.find((session) => session.messages.length === 0)

      if (emptySession) {
        // Reuse existing empty session
        this.currentSessionId = emptySession.id
        this.messages = []

        // Save to localStorage for persistence
        localStorage.setItem('knowledgeHub_currentSessionId', emptySession.id)

        // Update sidebar if it exists
        if (this.sessionSidebar) {
          this.sessionSidebar.setCurrentSession(emptySession.id)
          await this.sessionSidebar.refresh()
        }
        return
      }

      // No empty session found, create a new one
      // Generate smart title if we have messages
      const title = this.messages.length > 0 ? this.generateSmartTitle() : undefined
      const session = await sessionStorageService.createSession(this.messages, title)
      this.currentSessionId = session.id

      // Save to localStorage for persistence
      localStorage.setItem('knowledgeHub_currentSessionId', session.id)

      // Update sidebar if it exists
      if (this.sessionSidebar) {
        this.sessionSidebar.setCurrentSession(session.id)
        await this.sessionSidebar.refresh()
      }

      // Update menu items now that we have a session
      this.updateMenuItems()
    } catch (error) {
      console.error('[RightBar] Failed to create session:', error)
    }
  }

  /**
   * Start a new session (clear current and reuse empty or create new)
   */
  async startNewSession(): Promise<void> {
    // Clear current messages and feedback
    this.messages = []
    this.lastFailedMessage = null
    this.messageFeedback.clear()
    this.updateMenuItems()

    // Check if there's an existing empty session we can reuse
    try {
      const allSessions = await sessionStorageService.getAllSessions(false)
      const emptySession = allSessions.find((session) => session.messages.length === 0)

      if (emptySession) {
        // Reuse existing empty session
        this.currentSessionId = emptySession.id
        localStorage.setItem('knowledgeHub_currentSessionId', emptySession.id)

        if (this.sessionSidebar) {
          this.sessionSidebar.setCurrentSession(emptySession.id)
        }

        this.renderMessages()

        if (this.sessionSidebar) {
          await this.sessionSidebar.refresh()
        }
        return
      }
    } catch (error) {
      console.warn('[RightBar] Failed to check for empty sessions:', error)
    }

    // No empty session found, create a new one
    this.currentSessionId = null
    localStorage.removeItem('knowledgeHub_currentSessionId')

    if (this.sessionSidebar) {
      this.sessionSidebar.setCurrentSession(null)
    }

    await this.createNewSession()
    this.renderMessages()

    if (this.sessionSidebar) {
      await this.sessionSidebar.refresh()
    }
  }

  /**
   * Auto-save current session (debounced, non-blocking)
   */
  private async autoSaveSession(): Promise<void> {
    if (!this.isInitialized || !this.currentSessionId || this.messages.length === 0) {
      return
    }

    // Clear existing timeout
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout)
    }

    // Debounce saves (wait 1 second after last message change)
    // Use setTimeout to ensure this doesn't block the main thread
    this.saveTimeout = window.setTimeout(() => {
      // Use requestIdleCallback if available, otherwise setTimeout with 0 delay
      const saveOperation = async () => {
        try {
          await sessionStorageService.updateSessionMessages(this.currentSessionId!, this.messages)
          // Update session title if it's still the default
          const session = await sessionStorageService.getSession(this.currentSessionId!)
          if (session && session.title === 'New Session' && this.messages.length > 0) {
            const newTitle = this.generateSmartTitle()
            if (newTitle && newTitle !== 'New Session') {
              await sessionStorageService.updateSessionTitle(this.currentSessionId!, newTitle)
              await this.sessionSidebar.refresh()
            }
          }
        } catch (error) {
          console.error('[RightBar] Failed to auto-save session:', error)
        }
        this.saveTimeout = null
      }

      if ('requestIdleCallback' in window) {
        requestIdleCallback(saveOperation, { timeout: 2000 })
      } else {
        setTimeout(saveOperation, 0)
      }
    }, 1000)
  }

  /**
   * Generate smart title from current messages
   */
  private generateSmartTitle(): string {
    const firstUserMessage = this.messages.find((msg) => msg.role === 'user')
    if (!firstUserMessage) {
      return 'New Session'
    }

    let text = firstUserMessage.content.trim()

    // Remove markdown formatting
    text = text
      .replace(/^#+\s+/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .trim()

    // Remove common prefixes
    const prefixes = [
      /^(what|how|why|when|where|who|can|could|should|would|is|are|do|does|did)\s+/i,
      /^(explain|describe|tell|show|help|please)\s+/i,
      /^(i want|i need|i would like|i\'m looking for)\s+/i
    ]

    for (const prefix of prefixes) {
      text = text.replace(prefix, '')
    }
    text = text.trim()

    const firstLine = text.split('\n')[0]
    let title = firstLine.substring(0, 40).trim()

    if (title.length > 0) {
      title = title.charAt(0).toUpperCase() + title.slice(1)
    }

    if (title.length > 1 && /[.,!?;:]$/.test(title)) {
      title = title.slice(0, -1)
    }

    if (firstLine.length > 40) {
      title += '...'
    }

    return title || 'New Session'
  }

  /**
   * Load a session by ID
   */
  async loadSession(sessionId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeSession()
    }

    try {
      const session = await sessionStorageService.getSession(sessionId)
      if (session) {
        this.messages = [...session.messages]
        this.currentSessionId = session.id

        // Restore feedback from messages
        this.messageFeedback.clear()
        this.messages.forEach((msg, index) => {
          if (msg.feedback) {
            this.messageFeedback.set(index, msg.feedback)
          }
        })

        // Save current session ID to localStorage for persistence
        localStorage.setItem('knowledgeHub_currentSessionId', sessionId)

        if (this.sessionSidebar) {
          this.sessionSidebar.setCurrentSession(sessionId)
          // Don't hide sidebar - let user close it manually
        }

        this.renderMessages()
        this.updateMenuItems()
      }
    } catch (error) {
      console.error('[RightBar] Failed to load session:', error)
    }
  }

  /**
   * Get current session
   */
  async getCurrentSession(): Promise<ChatSession | null> {
    if (!this.currentSessionId) return null
    return await sessionStorageService.getSession(this.currentSessionId)
  }

  private async loadNotes(): Promise<void> {
    try {
      const notes = await window.api.listNotes()
      this.allNotes = notes.map((note) => ({
        id: note.id,
        title: note.title,
        path: note.path
      }))
    } catch (error) {
      console.error('[RightBar] Failed to load notes:', error)
      this.allNotes = []
    }
  }

  setEditorContext(
    getEditorContent: () => string | null,
    getActiveNoteInfo: () => { title: string; id: string } | null
  ): void {
    aiService.setEditorContext({ getEditorContent, getActiveNoteInfo })
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="rightbar">
        <div class="rightbar__resize-handle" id="rightbar-resize-handle"></div>
        <div class="rightbar__header">
          <h3 class="rightbar__title">AI Chat</h3>
          <div class="rightbar__header-actions">
            <button class="rightbar__header-ai-menu" id="rightbar-header-ai-menu" title="More options" aria-label="AI chat menu"></button>
            <button class="rightbar__header-sessions" id="rightbar-header-sessions" title="Sessions" aria-label="Toggle sessions">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 2h10M3 6h10M3 10h10M3 14h10"/>
              </svg>
            </button>
          <button class="rightbar__header-close" id="rightbar-header-close" title="Close (Ctrl+I)" aria-label="Close panel">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
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
                <span class="rightbar__chat-counter" id="rightbar-chat-counter">0</span>
              </div>
              <button class="rightbar__chat-send" id="rightbar-chat-send" type="button" title="Send (Enter)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/>
                </svg>
              </button>
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
      window.dispatchEvent(new CustomEvent('knowledge-hub:toggle-right-sidebar'))
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

      const sessionsBtn = this.container.querySelector(
        '#rightbar-header-sessions'
      ) as HTMLButtonElement
      sessionsBtn?.addEventListener('click', () => {
        if (this.sessionSidebar) {
          this.sessionSidebar.toggle()
        }
      })

      // Initialize AI Menu
      this.aiMenu = new AIMenu(this.container)
      this.aiMenu.render('rightbar-header-ai-menu')
      this.aiMenu.setOnItemClick((itemId) => {
        void this.handleMenuAction(itemId)
      })
      this.updateMenuItems()
    }
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

    this.chatInput.addEventListener('input', (e) => {
      this.updateCharacterCount()
      this.autoResizeTextarea()

      // Clear any existing timeout
      if (this.typingTimeout !== null) {
        clearTimeout(this.typingTimeout)
      }

      // Remove highlight immediately when typing to avoid interference
      this.removeTypingHighlight()

      // Handle mention input with a small delay to avoid interfering with typing
      this.typingTimeout = window.setTimeout(() => {
        this.handleNoteReferenceInput()
        this.updateNoteReferencesInContent()
      }, 100) // Short delay to let browser process input first
    })

    this.chatInput.addEventListener('paste', (e) => {
      e.preventDefault()
      const text = (e.clipboardData || (window as any).clipboardData).getData('text/plain')
      this.insertTextAtCursor(text)
    })

    this.chatInput.addEventListener('keydown', (e) => {
      if (this.autocompleteDropdown.style.display === 'block') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          this.selectedAutocompleteIndex = Math.min(
            this.selectedAutocompleteIndex + 1,
            this.autocompleteItems.length - 1
          )
          this.updateAutocompleteSelection()
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          this.selectedAutocompleteIndex = Math.max(this.selectedAutocompleteIndex - 1, -1)
          this.updateAutocompleteSelection()
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          this.selectAutocompleteItem()
          return
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

    this.chatContainer.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-action]')
      if (!target) return
      const action = (target as HTMLElement).dataset.action
      const btn = target as HTMLButtonElement

      if (action === 'copy') {
        const messageIndex = parseInt(btn.dataset.messageIndex || '0', 10)
        const message = this.messages[messageIndex]
        if (message) {
          // Get plain text from message content (remove markdown formatting)
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = this.formatContent(message.content, true)
          const plainText = tempDiv.textContent || tempDiv.innerText || ''

          navigator.clipboard
            .writeText(plainText)
            .then(() => {
              // Show success feedback with green checkmark using Lucide Check icon
              btn.classList.add('rightbar__message-action--copied')
              const originalHTML = btn.innerHTML
              btn.innerHTML = this.createLucideIcon(Check, 12, 2, '#22c55e')
              setTimeout(() => {
                btn.classList.remove('rightbar__message-action--copied')
                btn.innerHTML = originalHTML
              }, 2000)
            })
            .catch((err) => {
              console.error('Failed to copy:', err)
            })
        }
      } else if (action === 'thumbs-up' || action === 'thumbs-down') {
        const messageIndex = parseInt(btn.dataset.messageIndex || '0', 10)
        const message = this.messages[messageIndex]
        if (!message) return

        const currentFeedback = this.messageFeedback.get(messageIndex)
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
            this.messageFeedback.delete(messageIndex)
            thumbsUpBtn?.classList.remove('rightbar__message-action--active')
            newFeedback = null
          } else {
            // Set thumbs up, remove thumbs down
            this.messageFeedback.set(messageIndex, 'thumbs-up')
            thumbsUpBtn?.classList.add('rightbar__message-action--active')
            thumbsDownBtn?.classList.remove('rightbar__message-action--active')
            newFeedback = 'thumbs-up'
          }
        } else if (action === 'thumbs-down') {
          if (currentFeedback === 'thumbs-down') {
            // Toggle off
            this.messageFeedback.delete(messageIndex)
            thumbsDownBtn?.classList.remove('rightbar__message-action--active')
            newFeedback = null
          } else {
            // Set thumbs down, remove thumbs up
            this.messageFeedback.set(messageIndex, 'thumbs-down')
            thumbsDownBtn?.classList.add('rightbar__message-action--active')
            thumbsUpBtn?.classList.remove('rightbar__message-action--active')
            newFeedback = 'thumbs-down'
          }
        }

        // Update message feedback and persist
        message.feedback = newFeedback
        void this.autoSaveSession()
      } else if (action === 'retry') {
        const msg = (target as HTMLElement).closest('.rightbar__message')
        const content = msg?.querySelector('.rightbar__message-content')
        if (content) {
          const text = content.textContent || ''
          void navigator.clipboard.writeText(text).then(() => {
            const btn = target as HTMLButtonElement
            const prev = btn.textContent
            btn.textContent = 'Copied'
            btn.disabled = true
            setTimeout(() => {
              btn.textContent = prev
              btn.disabled = false
            }, 1500)
          })
        }
      } else if (action === 'retry' && this.lastFailedMessage) {
        const toSend = this.lastFailedMessage
        this.lastFailedMessage = null
        this.doSend(toSend)
      } else if (action === 'regenerate') {
        const messageIndex = parseInt(btn.dataset.messageIndex || '0', 10)
        void this.regenerateMessage(messageIndex)
      } else if (action === 'edit') {
        const messageIndex = parseInt(btn.dataset.messageIndex || '0', 10)
        this.editMessage(messageIndex)
      }
    })

    // Handle citation clicks
    this.chatContainer.querySelectorAll('.rightbar__message-citation').forEach((citationBtn) => {
      citationBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const noteId = (citationBtn as HTMLElement).dataset.noteId
        const notePath = (citationBtn as HTMLElement).dataset.notePath
        if (noteId) {
          window.dispatchEvent(
            new CustomEvent('knowledge-hub:open-note', {
              detail: { id: noteId, path: notePath || undefined }
            })
          )
        }
      })
    })
  }

  /**
   * Update menu items based on current state
   */
  private updateMenuItems(): void {
    const hasMessages = this.messages.length > 0
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
      case 'export':
        await this.exportSession()
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
      case 'settings':
        this.openAISettings()
        break
    }
  }

  /**
   * Export current session to Markdown or JSON
   */
  private async exportSession(): Promise<void> {
    if (this.messages.length === 0) {
      // Show notification or modal
      return
    }

    try {
      const session = this.currentSessionId
        ? await sessionStorageService.getSession(this.currentSessionId)
        : null

      const title = session?.title || 'Chat Session'
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

      // Create Markdown export
      let markdown = `# ${title}\n\n`
      markdown += `*Exported on ${new Date().toLocaleString()}*\n\n`
      markdown += '---\n\n'

      this.messages.forEach((msg, index) => {
        const role = msg.role === 'user' ? '**You**' : '**AI**'
        const time = new Date(msg.timestamp).toLocaleTimeString()
        markdown += `### ${role} (${time})\n\n`
        markdown += `${msg.content}\n\n`
        if (msg.feedback) {
          markdown += `*Feedback: ${msg.feedback === 'thumbs-up' ? '👍' : '👎'}*\n\n`
        }
        markdown += '---\n\n'
      })

      // Create downloadable file
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[RightBar] Failed to export session:', error)
    }
  }

  /**
   * Import session from file
   */
  private async importSession(): Promise<void> {
    try {
      // Create file input
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

          // Try to parse as markdown export
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

          // Add last message
          if (currentRole && currentContent.length > 0) {
            messages.push({
              role: currentRole,
              content: currentContent.join('\n').trim(),
              timestamp: Date.now()
            })
          }

          if (messages.length > 0) {
            // Create new session from imported messages
            const session = await sessionStorageService.createSession(messages, title)
            await this.loadSession(session.id)
            this.updateMenuItems()
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
    if (this.messages.length === 0) return

    // Use modal for confirmation
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
            this.messages = []
            this.messageFeedback.clear()
            this.renderMessages()
            await this.startNewSession()
            this.updateMenuItems()
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
              await sessionStorageService.archiveSession(this.currentSessionId!)
              await this.startNewSession()
              if (this.sessionSidebar) {
                await this.sessionSidebar.refresh()
              }
              this.updateMenuItems()
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
  private openAISettings(): void {
    // Dispatch event to open settings and focus on AI/Behavior section
    window.dispatchEvent(
      new CustomEvent('knowledge-hub:open-settings', {
        detail: { section: 'behavior' }
      })
    )
  }

  /**
   * Regenerate AI response from a specific message
   */
  private async regenerateMessage(messageIndex: number): Promise<void> {
    const message = this.messages[messageIndex]
    if (!message || message.role !== 'assistant') return

    // Find the user message that prompted this response
    let userMessageIndex = messageIndex - 1
    while (userMessageIndex >= 0 && this.messages[userMessageIndex].role !== 'user') {
      userMessageIndex--
    }

    if (userMessageIndex < 0) return

    const userMessage = this.messages[userMessageIndex].content

    // Remove the assistant message and all subsequent messages (but keep the user message)
    // We need to remove from messageIndex (the assistant message) onwards
    this.messages = this.messages.slice(0, messageIndex)

    // Re-render to update UI
    this.renderMessages()
    this.updateMenuItems()

    // Regenerate response - pass skipAddingUserMessage=true since user message already exists
    this.isLoading = true
    this.sendButton.disabled = true
    this.lastFailedMessage = null
    await this.doSend(userMessage, true) // Skip adding user message since it's already in the array
  }

  /**
   * Edit a user message and regenerate response
   */
  private editMessage(messageIndex: number): void {
    const message = this.messages[messageIndex]
    if (!message || message.role !== 'user') return

    // Set input to message content
    this.chatInput.textContent = message.content
    this.chatInput.innerHTML = this.escapeHtml(message.content)
    this.updateCharacterCount()
    this.autoResizeTextarea()

    // Remove this message and all subsequent messages
    this.messages.splice(messageIndex)

    // Re-render
    this.renderMessages()

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
        // Position dropdown above button using fixed positioning
        const rect = this.modeButton.getBoundingClientRect()
        this.modeDropdown.style.left = `${rect.left}px`
        this.modeDropdown.style.bottom = `${window.innerHeight - rect.top + 6}px`
      }

      this.modeDropdown.classList.toggle('is-open')
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

  private handleNoteReferenceInput(): void {
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

    // Find the last @ character before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex === -1) {
      this.hideAutocomplete()
      this.removeTypingHighlight()
      return
    }

    // Check if there's a space or newline after the @
    const afterAt = textBeforeCursor.substring(lastAtIndex + 1)
    if (afterAt.match(/[\s\n]/)) {
      this.hideAutocomplete()
      this.removeTypingHighlight()
      return
    }

    // Get the query (text after @)
    const query = afterAt.toLowerCase().trim()

    // Show autocomplete
    this.showAutocomplete(lastAtIndex, query, range)

    // Highlight the typing mention with proper cursor preservation
    if (query.length > 0) {
      // Use requestAnimationFrame to ensure highlighting happens after browser processes input
      requestAnimationFrame(() => {
        this.highlightTypingMention(lastAtIndex, query.length, range)
      })
    } else {
      this.removeTypingHighlight()
    }
  }

  private highlightTypingMention(atIndex: number, queryLength: number, range: Range): void {
    // Check if we already have a highlight for this same position
    const existingHighlight = (this.chatInput as any).__typingHighlight as HTMLElement | null
    if (existingHighlight && existingHighlight.parentNode) {
      const existingText = existingHighlight.textContent || ''
      // If the highlight text matches what we want to highlight, don't re-highlight
      if (
        existingText === `@${range.toString().substring(atIndex + 1, atIndex + 1 + queryLength)}`
      ) {
        // Just update cursor position
        this.restoreCursorAfterHighlight(existingHighlight)
        return
      }
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
    const absoluteCursorPos = cursorTextRange.toString().length

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

          // Restore cursor - always at the end of the query (where user is typing)
          this.restoreCursorAfterHighlight(highlightSpan)
        }
      } catch (e) {
        console.debug('[RightBar] Highlight error:', e)
      }
    }
  }

  private restoreCursorAfterHighlight(highlightSpan: HTMLElement): void {
    const selection = window.getSelection()
    if (!selection) return

    // Always place cursor right after the highlight (at the end of the query being typed)
    const newRange = document.createRange()
    newRange.setStartAfter(highlightSpan)
    newRange.setEndAfter(highlightSpan)

    // Use setTimeout to ensure this happens after DOM updates
    setTimeout(() => {
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(newRange)
      }
    }, 0)
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

  private showAutocomplete(atIndex: number, query: string, range: Range): void {
    const filteredNotes = this.allNotes
      .filter((note) => {
        const titleLower = note.title.toLowerCase()
        return titleLower.includes(query) || titleLower.startsWith(query)
      })
      .slice(0, 8) // Limit to 8 results

    if (filteredNotes.length === 0) {
      this.hideAutocomplete()
      return
    }

    this.autocompleteItems = []
    this.selectedAutocompleteIndex = -1

    // Store context for selection
    ;(this.autocompleteDropdown as any).__context = { atIndex, range, query }

    const html = filteredNotes
      .map((note, index) => {
        const displayTitle = note.title
        const displayPath = note.path ? `/${note.path}` : ''
        return `
        <div class="rightbar__autocomplete-item" data-index="${index}" data-note-id="${note.id}" data-note-title="${this.escapeHtml(note.title)}">
          <span class="rightbar__autocomplete-item-title">${this.escapeHtml(displayTitle)}</span>
          ${displayPath ? `<span class="rightbar__autocomplete-item-path">${this.escapeHtml(displayPath)}</span>` : ''}
        </div>
      `
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
    const noteTitle = item.dataset.noteTitle || ''
    const noteId = item.dataset.noteId || ''

    if (!noteTitle) return

    const context = (this.autocompleteDropdown as any).__context
    if (!context) return

    const { atIndex, query } = context

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

      // Find start (@ position)
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

      // Create mention span
      const mentionSpan = document.createElement('span')
      mentionSpan.className = 'rightbar__mention'
      mentionSpan.dataset.noteId = noteId
      mentionSpan.dataset.noteTitle = noteTitle
      mentionSpan.contentEditable = 'false'
      mentionSpan.textContent = `@${noteTitle}`

      // Remove any existing typing highlight
      this.removeTypingHighlight()

      // Store cursor position before manipulation
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const cursorBefore = selection.getRangeAt(0).cloneRange()
      cursorBefore.selectNodeContents(this.chatInput)
      cursorBefore.setEnd(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset)
      const cursorTextPos = cursorBefore.toString().length

      replaceRange.insertNode(mentionSpan)

      // Position caret right after the mention
      const newRange = document.createRange()
      newRange.setStartAfter(mentionSpan)
      newRange.setEndAfter(mentionSpan)

      if (selection) {
        selection.removeAllRanges()
        selection.addRange(newRange)
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

    this.noteReferences = refs
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private sendMessage(): void {
    const text = this.getPlainText().trim()
    if (!text) return

    // Clear the contenteditable
    this.chatInput.innerHTML = ''
    this.chatInput.textContent = ''
    this.autoResizeTextarea()
    this.updateCharacterCount()
    this.updateNoteReferencesInContent()
    this.doSend(text)
  }

  private async doSend(message: string, skipAddingUserMessage: boolean = false): Promise<void> {
    // Create or reuse empty session if this is the first message
    if (!this.currentSessionId && this.isInitialized) {
      await this.createNewSession()
    }

    // Only add user message if not regenerating (where message already exists)
    if (!skipAddingUserMessage) {
      this.addMessage('user', message)
    }
    this.sendButton.disabled = true
    this.lastFailedMessage = null
    this.isLoading = true
    this.renderMessages()

    const apiKey = aiService.getApiKey()
    if (!apiKey) {
      this.isLoading = false
      this.sendButton.disabled = false
      this.addMessage(
        'assistant',
        '🔑 **API Key Required**\n\nAdd your DeepSeek API key in **Settings → Behavior → DeepSeek API Key**.\n\nGet your key at [platform.deepseek.com](https://platform.deepseek.com)'
      )
      this.chatInput.focus()
      return
    }

    // Use queueMicrotask to ensure AI response doesn't block main thread
    // This allows Monaco editor and other UI to remain responsive during AI processing
    queueMicrotask(async () => {
      try {
        // Yield to allow UI to update before heavy processing
        await new Promise((resolve) => setTimeout(resolve, 0))
        const { context: contextMessage, citations } = await aiService.buildContextMessage(message)

        // Create placeholder message for streaming
        // If regenerating, insert after the last user message (which is already in the array)
        // If new message, insert at the end (after the user message we just added)
        let insertIndex = this.messages.length
        if (skipAddingUserMessage) {
          // When regenerating, the last message should be the user message we're regenerating from
          // Insert the assistant response right after it
          insertIndex = this.messages.length
        }

        // Insert placeholder assistant message
        this.messages.splice(insertIndex, 0, {
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          messageId: `msg_${Date.now()}_${Math.random()}`,
          citations: citations.length > 0 ? citations : undefined
        })
        this.streamingMessageIndex = insertIndex
        this.renderMessages()

        // Start streaming - use all messages up to (but not including) the placeholder
        const messagesForAPI = this.messages.slice(0, insertIndex)
        let lastRenderTime = 0
        const RENDER_THROTTLE_MS = 100 // Only render every 100ms max

        const fullResponse = await aiService.callDeepSeekAPIStream(
          messagesForAPI,
          { context: contextMessage, citations },
          (chunk: string) => {
            // Update message content as chunks arrive
            if (this.streamingMessageIndex !== null && this.messages[this.streamingMessageIndex]) {
              this.messages[this.streamingMessageIndex].content += chunk

              // Throttle UI updates for performance - don't render every chunk
              const now = Date.now()
              if (now - lastRenderTime >= RENDER_THROTTLE_MS) {
                lastRenderTime = now
                // Use requestIdleCallback for non-blocking updates, fallback to setTimeout
                const scheduleUpdate =
                  window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1))
                scheduleUpdate(() => {
                  this.renderMessages()
                  this.chatContainer.scrollTo({
                    top: this.chatContainer.scrollHeight,
                    behavior: 'auto'
                  })
                })
              }
            }
          }
        )

        // Final update with complete message
        if (this.streamingMessageIndex !== null && this.messages[this.streamingMessageIndex]) {
          this.messages[this.streamingMessageIndex].content = fullResponse
        }

        this.streamingMessageIndex = null

        // Use requestAnimationFrame for smooth UI updates
        requestAnimationFrame(() => {
          this.isLoading = false
          this.renderMessages()
          this.sendButton.disabled = false
          this.chatInput.focus()
          // Auto-save after streaming completes
          void this.autoSaveSession()
        })
      } catch (err: unknown) {
        // Remove placeholder message on error
        if (this.streamingMessageIndex !== null) {
          this.messages.splice(this.streamingMessageIndex, 1)
          this.streamingMessageIndex = null
        }

        requestAnimationFrame(() => {
          this.isLoading = false
          this.lastFailedMessage = message
          const errorMsg = err instanceof Error ? err.message : 'Failed to get response'
          this.addMessage(
            'assistant',
            `❌ **Error**\n\n${errorMsg}\n\nPlease check your API key and internet connection.`
          )
          this.sendButton.disabled = false
          this.chatInput.focus()
        })
        console.error('[RightBar] API Error:', err)
      }
    }, 0)
  }

  private addMessage(role: 'user' | 'assistant', content: string, messageId?: string): void {
    this.messages.push({
      role,
      content,
      timestamp: Date.now(),
      messageId: messageId || `msg_${Date.now()}_${Math.random()}`
    })
    this.renderMessages()
    this.updateMenuItems()

    // Auto-save session after adding message (unless streaming)
    if (this.streamingMessageIndex === null) {
      void this.autoSaveSession()
    }
  }

  private formatContent(text: string, isAssistant: boolean): string {
    if (!isAssistant) {
      // User messages: simple line breaks
      return this.escapeHtml(text).replace(/\n/g, '<br>')
    }
    // Assistant messages: full markdown rendering
    if (!this.md) {
      // Fallback if md not initialized (shouldn't happen, but safety check)
      this.md = new MarkdownIt({
        html: false,
        linkify: true,
        breaks: true,
        typographer: true,
        highlight: (str: string, lang: string) => {
          const normalizedLang = lang ? lang.toLowerCase().trim() : ''
          const escaped = this.md.utils.escapeHtml(str)
          return normalizedLang
            ? `<pre class="hljs"><code class="language-${this.md.utils.escapeHtml(normalizedLang)}" data-lang="${this.md.utils.escapeHtml(normalizedLang)}" data-code="${this.md.utils.escapeHtml(str.replace(/"/g, '&quot;'))}">${escaped}</code></pre>`
            : `<pre class="hljs"><code>${escaped}</code></pre>`
        }
      })
    }
    const rawHtml = this.md.render(text)
    // Sanitize HTML to prevent XSS attacks (allow data attributes for code highlighting)
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['class', 'target', 'rel', 'data-lang', 'data-code'],
      ADD_TAGS: ['pre', 'code'],
      KEEP_CONTENT: true,
      ALLOW_DATA_ATTR: true
    })
    return cleanHtml
  }

  private escapeHtml(raw: string): string {
    const div = document.createElement('div')
    div.textContent = raw
    return div.innerHTML
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
    if (this.messages.length === 0 && !this.isLoading) {
      this.chatContainer.innerHTML = WELCOME_HTML
      this.chatContainer.scrollTop = 0
      return
    }

    let html = this.messages
      .map((msg) => {
        const isError = msg.role === 'assistant' && msg.content.startsWith('❌')
        const content = this.formatContent(msg.content, msg.role === 'assistant')
        const avatar = Avatar.createHTML(msg.role as 'user' | 'assistant', 20)
        const msgIndex = this.messages.indexOf(msg)
        const feedback = msg.feedback || this.messageFeedback.get(msgIndex) || null
        const citations =
          msg.citations && msg.citations.length > 0
            ? `<div class="rightbar__message-citations">
               <span class="rightbar__message-citations-label">Referenced notes:</span>
               ${msg.citations
                 .map(
                   (citation) =>
                     `<button class="rightbar__message-citation" data-note-id="${citation.id}" data-note-path="${citation.path || ''}" title="Open: ${citation.title}">
                   ${this.escapeHtml(citation.title)}
                 </button>`
                 )
                 .join('')}
             </div>`
            : ''
        const actions =
          msg.role === 'assistant'
            ? `<div class="rightbar__message-actions">
             <button type="button" class="rightbar__message-action rightbar__message-action--copy" data-action="copy" data-message-index="${msgIndex}" title="Copy">
               ${this.createLucideIcon(Copy, 12, 1.5)}
             </button>
             <button type="button" class="rightbar__message-action rightbar__message-action--regenerate" data-action="regenerate" data-message-index="${msgIndex}" title="Regenerate">
               ${this.createLucideIcon(RotateCw, 12, 1.5)}
             </button>
             <button type="button" class="rightbar__message-action rightbar__message-action--thumbs-up ${feedback === 'thumbs-up' ? 'rightbar__message-action--active' : ''}" data-action="thumbs-up" data-message-index="${msgIndex}" title="Helpful">
               ${this.createLucideIcon(ThumbsUp, 12, 1.5)}
             </button>
             <button type="button" class="rightbar__message-action rightbar__message-action--thumbs-down ${feedback === 'thumbs-down' ? 'rightbar__message-action--active' : ''}" data-action="thumbs-down" data-message-index="${msgIndex}" title="Not helpful">
               ${this.createLucideIcon(ThumbsDown, 12, 1.5)}
             </button>
             ${isError && this.lastFailedMessage ? '<button type="button" class="rightbar__message-action rightbar__message-action--retry" data-action="retry" title="Retry">Retry</button>' : ''}
           </div>`
            : `<div class="rightbar__message-actions">
             <button type="button" class="rightbar__message-action rightbar__message-action--edit" data-action="edit" data-message-index="${msgIndex}" title="Edit message">
               ${this.createLucideIcon(Edit2, 12, 1.5)}
             </button>
           </div>`
        return `
        <div class="rightbar__message rightbar__message--${msg.role}">
          ${avatar}
          <div class="rightbar__message-body">
          <div class="rightbar__message-content">${content}</div>
            ${citations}
          ${actions}
          </div>
        </div>
      `
      })
      .join('')

    if (this.isLoading) html += TYPING_HTML

    this.chatContainer.innerHTML = html
    this.chatContainer.scrollTo({ top: this.chatContainer.scrollHeight, behavior: 'smooth' })

    // Enhance code blocks with syntax highlighting after render
    void this.highlightCodeBlocks()
  }

  /**
   * Enhance code blocks with syntax highlighting and copy buttons
   */
  private async highlightCodeBlocks(): Promise<void> {
    const codeBlocks = this.chatContainer.querySelectorAll(
      'pre code[data-lang], pre code:not([data-lang])'
    )
    if (codeBlocks.length === 0) return

    try {
      const hljs = await initHighlightJS()

      codeBlocks.forEach((codeEl) => {
        const codeElement = codeEl as HTMLElement
        const preElement = codeElement.closest('pre') as HTMLElement
        if (!preElement) return

        // Skip if copy button already exists
        if (preElement.querySelector('.rightbar__code-copy')) return

        const lang = codeElement.getAttribute('data-lang')
        const code = codeElement.getAttribute('data-code') || codeElement.textContent || ''

        // Apply syntax highlighting if language is supported
        if (lang && hljs && hljs.getLanguage(lang)) {
          try {
            const highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true })
            codeElement.innerHTML = highlighted.value
            codeElement.classList.add('hljs')
          } catch (err) {
            console.warn(`[RightBar] Highlighting failed for ${lang}:`, err)
          }
        }

        // Add copy button to the pre element
        const copyButton = document.createElement('button')
        copyButton.className = 'rightbar__code-copy'
        copyButton.title = 'Copy code'
        copyButton.setAttribute('aria-label', 'Copy code')
        copyButton.innerHTML = this.createLucideIcon(Copy, 14, 1.5)

        // Store original code for copying
        copyButton.dataset.code = code

        copyButton.addEventListener('click', async (e) => {
          e.stopPropagation()
          const codeToCopy = copyButton.dataset.code || codeElement.textContent || ''

          try {
            await navigator.clipboard.writeText(codeToCopy)

            // Visual feedback
            const originalHTML = copyButton.innerHTML
            copyButton.innerHTML = this.createLucideIcon(Check, 14, 1.5)
            copyButton.classList.add('rightbar__code-copy--copied')
            copyButton.title = 'Copied!'

            setTimeout(() => {
              copyButton.innerHTML = originalHTML
              copyButton.classList.remove('rightbar__code-copy--copied')
              copyButton.title = 'Copy code'
            }, 2000)
          } catch (err) {
            console.error('[RightBar] Failed to copy code:', err)
            // Fallback: select text
            const range = document.createRange()
            range.selectNodeContents(codeElement)
            const selection = window.getSelection()
            if (selection) {
              selection.removeAllRanges()
              selection.addRange(range)
            }
          }
        })

        // Make pre element relative for absolute positioning of copy button
        preElement.style.position = 'relative'
        preElement.appendChild(copyButton)
      })
    } catch (err) {
      console.warn('[RightBar] Failed to highlight code blocks:', err)
    }
  }

  async refreshApiKey(): Promise<void> {
    await aiService.loadApiKey()
    await this.loadNotes()
    const wasEmpty = this.messages.length === 0
    this.render()
    this.attachEvents()
    if (wasEmpty && !aiService.getApiKey()) {
      this.addMessage(
        'assistant',
        '👋 **Welcome!** Add your DeepSeek API key in **Settings → Behavior → DeepSeek API Key**. Get it at [platform.deepseek.com](https://platform.deepseek.com)'
      )
    }
  }
}
