import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { createElement, Copy } from 'lucide'

/**
 * MessageFormatter - Handles markdown rendering, HTML sanitization, and code block formatting
 */
export class MessageFormatter {
  private md: MarkdownIt

  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      breaks: true,
      typographer: true,
      highlight: (str: string, lang: string) => {
        const normalizedLang = lang ? lang.toLowerCase().trim() : ''
        const escaped = this.md.utils.escapeHtml(str)
        const copyIcon = this.createCopyIcon()
        const copyBtn = `<button class="rightbar__code-copy" data-action="copy-code" title="Copy code" aria-label="Copy code">${copyIcon}</button>`

        return normalizedLang
          ? `<pre class="hljs"><code class="language-${this.md.utils.escapeHtml(normalizedLang)}" data-lang="${this.md.utils.escapeHtml(normalizedLang)}" data-code="${this.md.utils.escapeHtml(str)}">${escaped}</code>${copyBtn}</pre>`
          : `<pre class="hljs"><code>${escaped}</code>${copyBtn}</pre>`
      }
    })
  }

  private createCopyIcon(): string {
    const svgElement = createElement(Copy, { size: 14, 'stroke-width': 2 })
    return svgElement?.outerHTML || ''
  }

  /**
   * Format content for display
   */
  format(text: string, isAssistant: boolean): string {
    if (!isAssistant) {
      return this.escapeHtml(text).replace(/\n/g, '<br>')
    }

    // Replace [RUN: ...] tags with clean UI pills instead of stripping them
    // This allows the user to see that an action is happening without the ugly raw code.
    const cleanText = text.replace(/\[RUN:\s*([\s\S]*?)(?:\]|$)/g, (match, cmdBody) => {
      const parts = cmdBody.trim().split(/\s+/)
      const cmdName = parts[0] || 'command'
      const isClosed = match.endsWith(']')
      const status = isClosed ? 'Executing' : 'Preparing'

      return `<div class="rightbar__command-pill" data-command="${cmdName}">
        <span class="rightbar__command-icon">⚡</span>
        <span class="rightbar__command-text">${status}: ${cmdName}</span>
      </div>`
    })

    const rawHtml = this.md.render(cleanText)

    // Sanitize HTML - ensure we allow our custom elements and attributes
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: [
        'class',
        'target',
        'rel',
        'data-lang',
        'data-code',
        'data-action',
        'aria-label',
        'title'
      ],
      ADD_TAGS: ['pre', 'code', 'button', 'svg', 'path', 'rect', 'div', 'span'],
      KEEP_CONTENT: true,
      ALLOW_DATA_ATTR: true
    })

    return cleanHtml
  }

  /**
   * Simple HTML escaping helper
   */
  escapeHtml(raw: string): string {
    const div = document.createElement('div')
    div.textContent = raw
    return div.innerHTML
  }
}

export const messageFormatter = new MessageFormatter()
