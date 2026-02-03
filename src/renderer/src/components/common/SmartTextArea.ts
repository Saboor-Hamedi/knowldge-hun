import { state } from '../../core/state'
import { messageFormatter } from '../rightbar/MessageFormatter'
import { createElement } from 'lucide'

export interface SmartTextAreaOptions {
  placeholder?: string
  className?: string
  onSend?: (text: string) => void | Promise<void>
  onInput?: (text: string) => void
  slashCommands?: Array<{
    command: string
    description: string
    icon: any // LucideIcon component
    action?: () => void
  }>
}

/**
 * Robust Chat Input with Mentions and Autocomplete
 */
export class SmartTextArea {
  private container: HTMLElement
  private inputEl: HTMLElement
  private autocompleteEl: HTMLElement
  private options: SmartTextAreaOptions
  private autocompleteItems: HTMLElement[] = []
  private selectedAutocompleteIndex = -1
  private typingTimeout: number | null = null

  constructor(parent: HTMLElement, options: SmartTextAreaOptions = {}) {
    this.options = options
    this.container = document.createElement('div')
    this.container.className = `kb-smart-input ${options.className || ''}`
    parent.appendChild(this.container)

    this.render()
    this.inputEl = this.container.querySelector('.kb-smart-input__area') as HTMLElement
    this.autocompleteEl = this.container.querySelector(
      '.kb-smart-input__autocomplete'
    ) as HTMLElement

    this.attachEvents()
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="kb-smart-input__area" 
           contenteditable="true" 
           data-placeholder="${this.options.placeholder || 'Type something...'}" 
           role="textbox" 
           aria-multiline="true"
           spellcheck="false"></div>
      <div class="kb-smart-input__autocomplete"></div>
    `
  }

  private attachEvents(): void {
    this.inputEl.addEventListener('input', () => {
      this.autoResize()
      if (this.options.onInput) this.options.onInput(this.getPlainText())

      // Robust placeholder fix
      if (this.isEmpty()) {
        if (this.inputEl.innerHTML !== '') this.inputEl.innerHTML = ''
      }

      if (this.typingTimeout) clearTimeout(this.typingTimeout)
      this.removeTypingHighlight()

      this.typingTimeout = window.setTimeout(() => {
        this.handleTrigger()
      }, 100)
    })

    this.inputEl.addEventListener('keydown', (e) => this.handleKeyDown(e))
    this.inputEl.addEventListener('paste', (e) => this.handlePaste(e))
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.autocompleteEl.style.display === 'block') {
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
        if (this.selectedAutocompleteIndex === -1 && count > 0) this.selectedAutocompleteIndex = 0
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
      const text = this.getPlainText().trim()
      if (text && this.options.onSend) {
        this.options.onSend(text)
        this.clear()
      }
    }

    // Handle backspace on mentions
    if (e.key === 'Backspace') {
      this.handleBackspace(e)
    }
  }

  private handleBackspace(e: KeyboardEvent): void {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return

    const range = selection.getRangeAt(0)
    const container = range.startContainer
    const offset = range.startOffset

    let nodeBefore: Node | null = null
    if (container.nodeType === Node.TEXT_NODE) {
      if (offset === 0) nodeBefore = container.previousSibling
      else {
        const textBefore = container.textContent?.substring(0, offset) || ''
        if (textBefore.trim().length === 0) nodeBefore = container.previousSibling
      }
    } else if (container === this.inputEl) {
      nodeBefore = this.inputEl.childNodes[offset - 1]
    }

    while (
      nodeBefore &&
      nodeBefore.nodeType === Node.TEXT_NODE &&
      !nodeBefore.textContent?.trim()
    ) {
      nodeBefore = nodeBefore.previousSibling
    }

    if (nodeBefore instanceof HTMLElement && nodeBefore.classList.contains('kb-mention')) {
      e.preventDefault()
      nodeBefore.remove()
      this.autoResize()
    }
  }

  private handlePaste(e: ClipboardEvent): void {
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') || ''
    document.execCommand('insertText', false, text)
  }

  private handleTrigger(): void {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const textBefore = this.getTextBeforeCursor(range)

    // Find last @ or /
    const lastAt = textBefore.lastIndexOf('@')
    const lastSlash = textBefore.lastIndexOf('/')

    const triggerIndex = Math.max(lastAt, lastSlash)
    if (triggerIndex === -1) {
      this.hideAutocomplete()
      return
    }

    const triggerChar = textBefore[triggerIndex]
    const query = textBefore.substring(triggerIndex + 1).toLowerCase()

    // Query shouldn't have spaces
    if (query.includes(' ') || query.includes('\n')) {
      this.hideAutocomplete()
      return
    }

    this.showAutocomplete(triggerIndex, query, range, triggerChar)
  }

  private getTextBeforeCursor(range: Range): string {
    const clone = range.cloneRange()
    clone.selectNodeContents(this.inputEl)
    clone.setEnd(range.endContainer, range.endOffset)
    return clone.toString()
  }

  private showAutocomplete(
    atIndex: number,
    query: string,
    range: Range,
    triggerChar: string
  ): void {
    let items: any[] = []

    if (triggerChar === '@') {
      items = state.notes.filter((n) => (n.title || n.id).toLowerCase().includes(query)).slice(0, 8)
    } else if (triggerChar === '/' && this.options.slashCommands) {
      items = this.options.slashCommands
        .filter((c) => c.command.toLowerCase().substring(1).includes(query))
        .slice(0, 8)
    }

    if (items.length === 0) {
      this.hideAutocomplete()
      return
    }

    this.selectedAutocompleteIndex = -1
    this.autocompleteItems = []
    ;(this.autocompleteEl as any).__context = { atIndex, range, query, triggerChar }

    this.autocompleteEl.innerHTML = items
      .map((item, idx) => {
        if (triggerChar === '@') {
          return `
          <div class="kb-smart-input__item" data-index="${idx}" data-id="${item.id}" data-title="${item.title}" data-type="note">
            <div class="kb-smart-input__item-title">${this.escapeHtml(item.title)}</div>
            ${item.path ? `<div class="kb-smart-input__item-path">/${this.escapeHtml(item.path)}</div>` : ''}
          </div>
        `
        } else {
          const iconHtml = item.icon ? this.renderIcon(item.icon) : ''
          return `
          <div class="kb-smart-input__item" data-index="${idx}" data-command="${item.command}" data-type="command">
            <div class="kb-smart-input__item-row">
              <span class="kb-smart-input__item-icon">${iconHtml}</span>
              <span class="kb-smart-input__item-title">${this.escapeHtml(item.command)}</span>
            </div>
            <div class="kb-smart-input__item-path">${this.escapeHtml(item.description)}</div>
          </div>
        `
        }
      })
      .join('')

    this.autocompleteEl.style.display = 'block'
    this.autocompleteItems = Array.from(
      this.autocompleteEl.querySelectorAll('.kb-smart-input__item')
    ) as HTMLElement[]

    this.autocompleteItems.forEach((item, idx) => {
      item.onclick = () => {
        this.selectedAutocompleteIndex = idx
        this.selectAutocompleteItem()
      }
    })
  }

  private selectAutocompleteItem(): void {
    const item = this.autocompleteItems[this.selectedAutocompleteIndex]
    if (!item) return

    const context = (this.autocompleteEl as any).__context as {
      atIndex: number
      range: Range
      query: string
      triggerChar: string
    }
    if (!context) return

    const { atIndex } = context
    const type = item.dataset.type
    const value = type === 'note' ? item.dataset.title : item.dataset.command

    // Create mention or text
    const selection = window.getSelection()
    if (!selection) return

    const range = document.createRange()
    const walker = document.createTreeWalker(this.inputEl, NodeFilter.SHOW_TEXT)
    let currentPos = 0
    let startNode: Node | null = null
    let startOffset = 0

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const len = node.textContent?.length || 0
      if (currentPos <= atIndex && atIndex < currentPos + len) {
        startNode = node
        startOffset = atIndex - currentPos
        break
      }
      currentPos += len
    }

    if (startNode) {
      range.setStart(startNode, startOffset)
      range.setEnd(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset)
      range.deleteContents()

      if (type === 'note') {
        const mention = document.createElement('span')
        mention.className = 'kb-mention'
        mention.dataset.noteId = item.dataset.id
        mention.contentEditable = 'false'
        mention.textContent = `@${value}`
        range.insertNode(mention)
        const space = document.createTextNode(' ')
        mention.after(space)
        this.setCursorAfter(space)
      } else {
        const text = document.createTextNode(value || '')
        range.insertNode(text)
        this.setCursorAfter(text)
      }
    }

    this.hideAutocomplete()
    this.autoResize()
  }

  private setCursorAfter(node: Node): void {
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.setStartAfter(node)
    range.setEndAfter(node)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  private updateAutocompleteSelection(): void {
    this.autocompleteItems.forEach((item, idx) => {
      item.classList.toggle('is-selected', idx === this.selectedAutocompleteIndex)
      if (idx === this.selectedAutocompleteIndex) item.scrollIntoView({ block: 'nearest' })
    })
  }

  private hideAutocomplete(): void {
    this.autocompleteEl.style.display = 'none'
  }

  private removeTypingHighlight(): void {
    // Implement if needed (already handled by removeTypingHighlight in rightbar)
  }

  public getPlainText(): string {
    const clone = this.inputEl.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.kb-mention').forEach((m) => {
      m.replaceWith(document.createTextNode(m.textContent || ''))
    })
    return clone.textContent || ''
  }

  public isEmpty(): boolean {
    return (
      this.getPlainText().trim().length === 0 &&
      this.inputEl.querySelectorAll('.kb-mention').length === 0
    )
  }

  public clear(): void {
    this.inputEl.innerHTML = ''
    this.autoResize()
  }

  public focus(): void {
    this.inputEl.focus()
  }

  public setEnabled(enabled: boolean): void {
    this.inputEl.contentEditable = String(enabled)
    this.container.classList.toggle('is-disabled', !enabled)
  }

  public setPlaceholder(text: string): void {
    this.inputEl.dataset.placeholder = text
  }

  public setValue(text: string): void {
    this.inputEl.textContent = text
    this.autoResize()
  }

  private autoResize(): void {
    this.inputEl.style.height = 'auto'
    this.inputEl.style.height = `${this.inputEl.scrollHeight}px`
  }

  private escapeHtml(s: string): string {
    return messageFormatter.escapeHtml(s)
  }

  private renderIcon(icon: any): string {
    return createElement(icon, { size: 14 }).outerHTML
  }
}
