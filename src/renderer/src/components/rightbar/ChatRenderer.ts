import { Avatar } from './avatar'
import { messageFormatter } from './MessageFormatter'
import { WELCOME_HTML, TYPING_HTML, EXECUTING_HTML } from './rightbar.constants'
import { createElement, Edit2, Copy, RefreshCw, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide'
import { ChatMessage } from '../../services/aiService'
import { ChatIndicator } from '../common/ChatIndicator'

export interface RendererState {
  messages: ChatMessage[]
  isLoading: boolean
  isExecutingCommand: boolean
  streamingMessageIndex: number | null
  messageFeedback: Map<number, 'thumbs-up' | 'thumbs-down'>
  lastFailedMessage: string | null
}

/**
 * ChatRenderer - Handles DOM manipulation and message rendering for RightBar
 */
export class ChatRenderer {
  private messageElements = new Map<string, HTMLElement>()
  private typingIndicator: HTMLElement | null = null
  private lastRenderedHtml: string = ''
  private lastHighlightTime: number = 0

  constructor(private chatContainer: HTMLElement) {}

  /**
   * Clear all caches
   */
  public clear(): void {
    this.messageElements.clear()
    this.lastRenderedHtml = ''
    this.lastHighlightTime = 0
    this.typingIndicator = null
    this.chatContainer.innerHTML = ''
  }

  /**
   * Render all messages to the container using an incremental approach
   */
  render(state: RendererState, wasAtBottom: boolean): void {
    if (state.messages.length === 0 && !state.isLoading) {
      if (this.lastRenderedHtml !== WELCOME_HTML) {
        this.chatContainer.innerHTML = WELCOME_HTML
        this.lastRenderedHtml = WELCOME_HTML
        this.messageElements.clear()
        this.typingIndicator = null
      }
      this.chatContainer.scrollTop = 0
      return
    }

    // Clear welcome message if we have content
    if (this.lastRenderedHtml === WELCOME_HTML) {
      this.chatContainer.innerHTML = ''
      this.lastRenderedHtml = ''
    }

    // 1. Ensure all messages have been represented as DOM elements
    state.messages.forEach((msg, idx) => {
      const isStreaming = idx === state.streamingMessageIndex && state.isLoading
      const feedback = msg.feedback || state.messageFeedback.get(idx) || null

      // Cache key includes content length and feedback to detect changes
      // Added version suffix to force re-render when layout logic changes
      const cacheKey = `${msg.messageId}_${msg.content.length}_${feedback}_${isStreaming}_v11`

      const messageId = msg.messageId || ''
      let element = this.messageElements.get(messageId)

      if (!element) {
        // Create new message element
        element = document.createElement('div')
        element.id = `msg-${messageId}`
        this.chatContainer.appendChild(element)
        this.messageElements.set(messageId, element)
      }

      const isErrorMsg =
        msg.content.includes('🔴') || msg.content.includes('❌') || msg.content.includes('failed')
      const errorClass = isErrorMsg ? 'rightbar__message--error' : ''

      // Always update className to ensure direction fixes apply to cached elements
      const roleClass = `rightbar__message--${msg.role}`
      element.className = `rightbar__message ${roleClass} ${errorClass}`

      // 2. Only update innerHTML if content actually changed
      if (element.getAttribute('data-cache') !== cacheKey) {
        if (msg.role === 'system') {
          const avatar = Avatar.createHTML('assistant', 20)
          element.innerHTML = `
            ${avatar}
            <div class="rightbar__message-body">
              <div class="rightbar__message-content">${this.renderSystemContent(msg)}</div>
            </div>
          `
        } else {
          // Hide empty placeholder messages if we're showing the global typing indicator instead
          if (msg.role === 'assistant' && !msg.content && isStreaming) {
            element.style.display = 'none'
          } else {
            element.style.display = 'block'
            let formattedContent = messageFormatter.format(msg.content, msg.role === 'assistant')

            // Add subtle indicator if this is the active streaming message
            // We use a span that stays inside the flow
            if (isStreaming) {
              const dots = ChatIndicator.createInline()

              // If content ends with a closing tag (like </p>), try to inject dots inside it for better wrapping
              if (formattedContent.trim().endsWith('</p>')) {
                formattedContent = formattedContent.trim().replace(/<\/p>$/, `${dots}</p>`)
              } else {
                formattedContent += dots
              }
            }

            const avatar = Avatar.createHTML(msg.role as 'user' | 'assistant', 20)
            const actions = this.renderActions(
              msg,
              idx,
              feedback,
              false, // Simplifying for lightness
              state.lastFailedMessage
            )

            element.innerHTML = `
              ${avatar}
              <div class="rightbar__message-body">
                <div class="rightbar__message-content">${formattedContent}</div>
                ${actions}
              </div>
            `
          }
        }
        element.setAttribute('data-cache', cacheKey)
      }
    })

    // 3. Handle global typing indicators (non-inline ones)
    this.updateGlobalIndicators(state)

    // 4. Scroll if needed
    if (wasAtBottom) {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight
    }

    // 5. Cleanup removed messages
    this.pruneRemovedMessages(state.messages)
  }

  private updateGlobalIndicators(state: RendererState): void {
    const currentMsg =
      state.streamingMessageIndex !== null ? state.messages[state.streamingMessageIndex] : null
    const isActuallyStreaming = !!(currentMsg && currentMsg.content.trim().length > 0)

    // Show global indicator if loading but no content yet, or if executing a command
    const shouldShowGlobal = state.isLoading && (!isActuallyStreaming || state.isExecutingCommand)

    if (shouldShowGlobal) {
      if (!this.typingIndicator) {
        this.typingIndicator = document.createElement('div')
        this.typingIndicator.id = 'msg-typing-indicator'
        this.typingIndicator.style.display = 'block' // Allow it to follow standard block layout
        this.chatContainer.appendChild(this.typingIndicator)
      }
      const indicatorHtml = state.isExecutingCommand ? EXECUTING_HTML : TYPING_HTML
      if (this.typingIndicator.innerHTML !== indicatorHtml) {
        this.typingIndicator.innerHTML = indicatorHtml
      }
    } else if (this.typingIndicator) {
      this.typingIndicator.remove()
      this.typingIndicator = null
    }
  }

  private pruneRemovedMessages(currentMessages: ChatMessage[]): void {
    const messageIds = new Set(currentMessages.map((m) => m.messageId))
    for (const [id, element] of this.messageElements.entries()) {
      if (!messageIds.has(id)) {
        element.remove()
        this.messageElements.delete(id)
      }
    }
  }

  private renderSystemContent(msg: ChatMessage): string {
    const lines = msg.content.split('\n')
    let title = lines[0]
    title = title.replace(/^>\s*\[(.+?)\]$/, '$1')

    let icon = '⚙️'
    if (title.toLowerCase().includes('success')) icon = '✅'
    if (title.toLowerCase().includes('error')) icon = '❌'
    if (title.toLowerCase().includes('read')) icon = '📖'
    if (title.toLowerCase().includes('write') || title.toLowerCase().includes('append')) icon = '📝'
    if (title.toLowerCase().includes('list')) icon = '📂'

    if (title.includes(':')) {
      const parts = title.split(':')
      const cmdParts = parts[1]?.trim().split(' ')
      const cmdName = cmdParts[0]
      const cmdTarget = cmdParts.slice(1).join(' ').substring(0, 15)
      const targetSuffix = cmdTarget ? ` ${cmdTarget}...` : ''
      title = `${parts[0]}: ${cmdName}${targetSuffix}`
    }

    // For CLI-like experience, we want to show the full output immediately,
    // styled like a terminal block, not hidden behind a click.
    // For CLI-like experience, we default to OPEN, but allow collapsing
    // via the standard <details> element behavior.
    return `
      <div class="rightbar__system-message" title="Click header to toggle output">
        <details class="rightbar__system-details" open>
          <summary class="rightbar__system-summary" style="list-style: none;">
            <span class="rightbar__system-icon">${icon}</span>
            <span class="rightbar__system-title" style="font-family: monospace;">${this.escapeHtml(title)}</span>
          </summary>
          <div class="rightbar__system-content">
            <div class="rightbar__system-code-wrapper">
              <pre><code>${this.escapeHtml(msg.content)}</code></pre>
            </div>
          </div>
        </details>
      </div>
    `
  }

  private renderActions(
    msg: ChatMessage,
    idx: number,
    feedback: string | null,
    isAgenticStep: boolean,
    lastFailedMessage: string | null
  ): string {
    if (msg.role === 'assistant') {
      const isError = msg.content.startsWith('❌')
      return `
        <div class="rightbar__message-actions" ${isAgenticStep ? 'style="display: none;"' : ''}>
          <button type="button" class="rightbar__message-action rightbar__message-action--copy" data-action="copy" data-message-index="${idx}" title="Copy">
            ${this.createLucideIcon(Copy, 14)}
          </button>
          <button type="button" class="rightbar__message-action rightbar__message-action--regenerate" data-action="regenerate" data-message-index="${idx}" title="Regenerate">
            ${this.createLucideIcon(RefreshCw, 12)}
          </button>
          <button type="button" class="rightbar__message-action rightbar__message-action--thumbs-up ${feedback === 'thumbs-up' ? 'rightbar__message-action--active' : ''}" data-action="thumbs-up" data-message-index="${idx}" title="Helpful">
            ${this.createLucideIcon(ThumbsUp, 12)}
          </button>
          <button type="button" class="rightbar__message-action rightbar__message-action--thumbs-down ${feedback === 'thumbs-down' ? 'rightbar__message-action--active' : ''}" data-action="thumbs-down" data-message-index="${idx}" title="Not helpful">
            ${this.createLucideIcon(ThumbsDown, 12)}
          </button>
          ${isError && lastFailedMessage ? `<button type="button" class="rightbar__message-action rightbar__message-action--retry" data-action="retry" title="Retry">${this.createLucideIcon(AlertCircle, 12)} Retry</button>` : ''}
        </div>`
    } else {
      return `
        <div class="rightbar__message-actions">
          <button type="button" class="rightbar__message-action rightbar__message-action--edit" data-action="edit" data-message-index="${idx}" title="Edit message">
            ${this.createLucideIcon(Edit2, 12, 1.5)}
          </button>
        </div>`
    }
  }

  private escapeHtml(raw: string): string {
    const div = document.createElement('div')
    div.textContent = raw
    return div.innerHTML
  }

  private createLucideIcon(
    IconComponent: Parameters<typeof createElement>[0],
    size: number = 12,
    strokeWidth: number = 1.5
  ): string {
    const svgElement = createElement(IconComponent, { size, 'stroke-width': strokeWidth })
    return svgElement?.outerHTML || ''
  }

  async highlightAll(
    initHighlightJS: () => Promise<unknown>,
    force: boolean = false
  ): Promise<void> {
    const now = Date.now()
    if (!force && now - this.lastHighlightTime < 1000) {
      // Basic safeguard: don't highlight more than once per second even if called externally
      return
    }
    this.lastHighlightTime = now

    const codeBlocks = this.chatContainer.querySelectorAll(
      'pre code[data-lang], pre code:not([data-lang])'
    )
    if (codeBlocks.length === 0) return

    try {
      const hljs = await initHighlightJS()
      codeBlocks.forEach((codeEl) => {
        const codeElement = codeEl as HTMLElement
        if (codeElement.classList.contains('hljs')) return

        const lang = codeElement.getAttribute('data-lang')
        const code = codeElement.getAttribute('data-code') || codeElement.textContent || ''

        if (lang && hljs) {
          const h = hljs as {
            getLanguage: (l: string) => unknown
            highlight: (
              c: string,
              options: { language: string; ignoreIllegals: boolean }
            ) => {
              value: string
            }
          }
          if (h.getLanguage(lang)) {
            try {
              const highlighted = h.highlight(code, {
                language: lang,
                ignoreIllegals: true
              })
              codeElement.innerHTML = highlighted.value
              codeElement.classList.add('hljs')
            } catch (err) {
              console.warn(`[ChatRenderer] Highlighting failed for ${lang}:`, err)
            }
          }
        }
      })
    } catch (err) {
      console.warn('[ChatRenderer] highlightAll error:', err)
    }
  }
}
