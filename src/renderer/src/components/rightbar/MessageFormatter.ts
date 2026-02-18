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

  private renderCache = new Map<string, string>()

  /**
   * Format content for display
   */
  format(text: string, isAssistant: boolean): string {
    if (!isAssistant) {
      return this.escapeHtml(text).replace(/\n/g, '<br>')
    }

    // Check cache first for assistant messages
    if (this.renderCache.has(text)) {
      return this.renderCache.get(text)!
    }

    // 0. Handle [FILE: path] tags (Iterative Headers)
    let processedText = text.replace(/\[FILE:\s*(.+?)\s*\]/g, (_match, path) => {
      return `<div class="rightbar__file-header">
        <span class="rightbar__file-path">${this.escapeHtml(path)}</span>
      </div>`
    })

    // 1. Handle <thought> tags (minimal technical log)
    processedText = processedText.replace(
      /<thought>\s*([\s\S]*?)(?:<\/thought>|$)/g,
      (_match, content) => {
        return `
        <details class="rightbar__thought-details">
          <summary class="rightbar__thought-summary">
            <span class="rightbar__thought-icon">🧠</span>
            <span class="rightbar__thought-label">LOGIC</span>
          </summary>
          <div class="rightbar__thought-content">${this.escapeHtml(content.trim())}</div>
        </details>
      `
      }
    )

    // 2. Handle [RUN: read ...] specifically as a subtle "Analyzed" chip
    processedText = processedText.replace(
      /\[RUN:\s*read\s*"?(.+?)"?\s*(#L\d+-\d+)?\s*\]/g,
      (_match, path, lines) => {
        const lineRange = lines || ''
        return `<div class="rightbar__analyzed-chip" title="Click to view full output">
        <span class="rightbar__analyzed-icon">🔍</span>
        <span class="rightbar__analyzed-text">Analyzed <code>${path}${lineRange}</code></span>
      </div>`
      }
    )

    // 3. Replace remaining [RUN: ...] tags with standard UI pills
    const cleanText = processedText.replace(/\[RUN:\s*([\s\S]*?)(?:\]|$)/g, (match, cmdBody) => {
      const parts = cmdBody.trim().split(/\s+/)
      const cmdName = parts[0] || 'command'
      const isClosed = match.endsWith(']')
      const status = isClosed ? 'Done' : 'Running'

      return `<span class="rightbar__command-pill" data-command="${cmdName}">
        <span class="rightbar__command-icon"></span>
        <span class="rightbar__command-text">${status}: ${cmdName}</span>
      </span>`
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

    // Cache the result if the message is "complete" (i.e. not actively being streamed)
    // Note: We cache even partial chunks because we render every 40ms,
    // and caching the previous 40ms worth of work is still a win.
    if (text.length > 0) {
      this.renderCache.set(text, cleanHtml)
      // Basic cache management: Keep it from blowing up
      if (this.renderCache.size > 200) {
        const firstKey = this.renderCache.keys().next().value
        if (firstKey) this.renderCache.delete(firstKey)
      }
    }

    return cleanHtml
  }

  /**
   * Clear the render cache (e.g. when clearing chat)
   */
  clearCache(): void {
    this.renderCache.clear()
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
