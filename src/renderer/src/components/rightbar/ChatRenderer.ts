import { Avatar } from './avatar'
import { messageFormatter } from './MessageFormatter'
import { WELCOME_HTML, TYPING_HTML, EXECUTING_HTML } from './rightbar.constants'
import { createElement, Edit2, Copy, RefreshCw, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide'
import { ChatMessage } from '../../services/aiService'

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
  constructor(private chatContainer: HTMLElement) {}

  /**
   * Render all messages to the container
   */
  render(state: RendererState, wasAtBottom: boolean): void {
    if (state.messages.length === 0 && !state.isLoading) {
      this.chatContainer.innerHTML = WELCOME_HTML
      this.chatContainer.scrollTop = 0
      return
    }

    let html = state.messages
      .map((msg, idx) => {
        if (msg.role === 'system') {
          return this.renderSystemMessage(msg)
        }

        // Skip empty placeholder messages from AI
        if (msg.role === 'assistant' && !msg.content && idx === state.streamingMessageIndex) {
          return ''
        }

        const formattedContent = messageFormatter.format(msg.content, msg.role === 'assistant')

        const nextMsg = state.messages[idx + 1]
        const hasCommand = /\[RUN:\s*.+?\]/gs.test(msg.content)
        // Only hide if it's purely a command message or followed by a system message (meaning it's a thinking step)
        const isPureThinkingStep =
          msg.role === 'assistant' &&
          (hasCommand || (nextMsg && nextMsg.role === 'system')) &&
          formattedContent.trim().length < 50

        if (
          msg.role === 'assistant' &&
          !formattedContent.trim() &&
          (idx === state.streamingMessageIndex ||
            hasCommand ||
            (nextMsg && nextMsg.role === 'system'))
        ) {
          return ''
        }

        const avatar = Avatar.createHTML(msg.role as 'user' | 'assistant', 20)
        const feedback = msg.feedback || state.messageFeedback.get(idx) || null

        const actions = this.renderActions(
          msg,
          idx,
          feedback,
          isPureThinkingStep,
          state.lastFailedMessage
        )

        const isErrorMsg =
          msg.content.includes('🔴') || msg.content.includes('❌') || msg.content.includes('failed')
        const errorClass = isErrorMsg ? 'rightbar__message--error' : ''

        return `
        <div class="rightbar__message rightbar__message--${msg.role} ${errorClass}">
          ${avatar}
          <div class="rightbar__message-body">
            <div class="rightbar__message-content">${formattedContent}</div>
            <!-- \${citations} -->
            ${actions}
          </div>
        </div>
      `
      })
      .join('')

    if (state.isLoading) {
      const isActuallyStreamingContent =
        state.streamingMessageIndex !== null &&
        state.messages[state.streamingMessageIndex]?.content.trim().length > 0

      if (!isActuallyStreamingContent || state.isExecutingCommand) {
        html += state.isExecutingCommand ? EXECUTING_HTML : TYPING_HTML
      }
    }

    this.chatContainer.innerHTML = html

    if (wasAtBottom) {
      this.chatContainer.scrollTo({
        top: this.chatContainer.scrollHeight,
        behavior: state.isLoading ? 'auto' : 'smooth'
      })
    }
  }

  private renderSystemMessage(msg: ChatMessage): string {
    const lines = msg.content.split('\n')
    let title = lines[0]
    title = title.replace(/^>\s*\[(.+?)\]$/, '$1')

    if (title.includes(':')) {
      const parts = title.split(':')
      const cmdParts = parts[1]?.trim().split(' ')
      const cmdName = cmdParts[0]
      const cmdTarget = cmdParts.slice(1).join(' ').substring(0, 15)
      const targetSuffix = cmdTarget ? ` ${cmdTarget}...` : ''
      title = `${parts[0]}: ${cmdName}${targetSuffix}`
    }

    const preview = lines.slice(1).join('\n').trim().substring(0, 40).replace(/\n/g, ' ')
    const finalPreview = preview ? `- ${preview}...` : ''

    return `
      <div class="rightbar__system-message rightbar__message rightbar__message--system" title="Click to view details">
        <details class="rightbar__system-details">
          <summary class="rightbar__system-summary">
            <span class="rightbar__system-icon">⚙️</span>
            <span class="rightbar__system-title">${this.escapeHtml(title)}</span>
            <span class="rightbar__system-preview">${this.escapeHtml(finalPreview)}</span>
          </summary>
          <div class="rightbar__system-content">
            <pre><code>${this.escapeHtml(msg.content)}</code></pre>
            <div class="rightbar__message-actions rightbar__system-actions">
              <button type="button" class="rightbar__message-action rightbar__message-action--copy" data-action="copy" data-message-content="${this.escapeHtml(msg.content)}" title="Copy result">
                ${this.createLucideIcon(Copy, 14)}
              </button>
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    IconComponent: any,
    size: number = 12,
    strokeWidth: number = 1.5
  ): string {
    const svgElement = createElement(IconComponent, { size, 'stroke-width': strokeWidth })
    return svgElement?.outerHTML || ''
  }

  async highlightAll(initHighlightJS: () => Promise<unknown>): Promise<void> {
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

        if (lang && hljs && (hljs as any).getLanguage(lang)) {
          try {
            const highlighted = (hljs as any).highlight(code, {
              language: lang,
              ignoreIllegals: true
            })
            codeElement.innerHTML = highlighted.value
            codeElement.classList.add('hljs')
          } catch (err) {
            console.warn(`[ChatRenderer] Highlighting failed for ${lang}:`, err)
          }
        }
      })
    } catch (err) {
      console.warn('[ChatRenderer] highlightAll error:', err)
    }
  }
}
