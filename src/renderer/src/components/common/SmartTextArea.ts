import { state } from '../../core/state'
import { messageFormatter } from '../rightbar/MessageFormatter'
import { getSnippetIconHtml } from '../../utils/fileIconMappers'
import { createElement } from 'lucide'

export interface SmartTextAreaOptions {
  placeholder?: string
  className?: string
  onSend?: (text: string) => void | Promise<void>
  onInput?: (text: string) => void
  slashCommands?: Array<{
    command: string
    description: string
    icon?: any // eslint-disable-line @typescript-eslint/no-explicit-any
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
  private autocompleteContext: {
    atIndex: number
    range: Range
    query: string
    triggerChar: string
  } | null = null

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
    let items: Array<any> = [] // eslint-disable-line @typescript-eslint/no-explicit-any

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
    this.autocompleteContext = { atIndex, range, query, triggerChar }

    this.autocompleteEl.innerHTML = items
      .map((item, idx) => {
        if (triggerChar === '@') {
          const iconHtml = getSnippetIconHtml({ title: item.title, language: 'markdown' }, 14)
          return `
          <div class="kb-smart-input__item" data-index="${idx}" data-id="${item.id}" data-title="${item.title}" data-type="note">
            <div class="kb-smart-input__item-row">
              <span class="kb-smart-input__item-icon">${iconHtml}</span>
              <div class="kb-smart-input__item-details">
                <div class="kb-smart-input__item-title">${this.escapeHtml(item.title)}</div>
                ${item.path ? `<div class="kb-smart-input__item-path">/${this.escapeHtml(item.path)}</div>` : ''}
              </div>
            </div>
          </div>
        `
        } else {
          const iconHtml = item.icon ? this.renderIcon(item.icon, 12) : ''
          return `
          <div class="kb-smart-input__item" data-index="${idx}" data-command="${item.command}" data-type="command">
            <div class="kb-smart-input__item-row">
              <span class="kb-smart-input__item-icon">${iconHtml}</span>
              <div class="kb-smart-input__item-details">
                <div class="kb-smart-input__item-title">${this.escapeHtml(item.command)}</div>
                <div class="kb-smart-input__item-path">${this.escapeHtml(item.description)}</div>
              </div>
            </div>
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
      item.onmousedown = (e) => {
        e.preventDefault()
        this.selectedAutocompleteIndex = idx
        this.selectAutocompleteItem()
      }
    })
  }

  private selectAutocompleteItem(): void {
    const item = this.autocompleteItems[this.selectedAutocompleteIndex]
    if (!item || !this.autocompleteContext) return

    const context = this.autocompleteContext

    const value = item.dataset.type === 'note' ? item.dataset.title : item.dataset.command
    const type = item.dataset.type

    // Ensure input is focused but don't force it if we already have it
    // to avoid cursor jumping to start.
    if (document.activeElement !== this.inputEl) {
      this.inputEl.focus()
    }

    // Use the captured range from trigger time as it's the most reliable
    // anchor for the replacement.
    const selection = window.getSelection()
    if (!selection) return

    // We'll use the current cursor as the end point, but fallback to
    // the captured range end if the selection has been lost.
    let endContainer: Node = context.range.endContainer
    let endOffset: number = context.range.endOffset

    if (selection.rangeCount > 0) {
      const currentRange = selection.getRangeAt(0)
      if (this.inputEl.contains(currentRange.endContainer)) {
        endContainer = currentRange.endContainer
        endOffset = currentRange.endOffset
      }
    }

    // Create a range for replacement
    const range = document.createRange()
    let startNode: Node | null = null
    let startOffset = 0

    // NEW ROBUST TRIAGE:
    // 1. Try fast-path: Trigger is in the current text node (most common)
    if (endContainer.nodeType === Node.TEXT_NODE) {
      const text = endContainer.textContent || ''
      const textBefore = text.substring(0, endOffset)
      const lastTrigger = textBefore.lastIndexOf(context.triggerChar)

      // Double check this is the right trigger (not a previous one)
      // The query should match what's between lastTrigger and endOffset
      if (lastTrigger !== -1) {
        const actualQuery = textBefore.substring(lastTrigger + 1).toLowerCase()
        if (actualQuery === context.query.toLowerCase()) {
          startNode = endContainer
          startOffset = lastTrigger
        }
      }
    }

    // 2. Fallback: Slow-path TreeWalker with structural awareness
    if (!startNode) {
      const walker = document.createTreeWalker(this.inputEl, NodeFilter.SHOW_TEXT)
      let currentPos = 0
      const targetIndex = context.atIndex

      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        const len = node.textContent?.length || 0

        // If this node contains the targetIndex, we found it
        if (currentPos <= targetIndex && targetIndex <= currentPos + len) {
          startNode = node
          startOffset = targetIndex - currentPos
          break
        }

        currentPos += len

        // ACCOUNT FOR INVISIBLE NEWLINES:
        // range.toString() adds \n after block elements. If the next sibling
        // is a block or we just finished a block, toString() would have added 1.
        const parent = node.parentElement
        if (parent && parent !== this.inputEl && !node.nextSibling) {
          currentPos += 1 // The implied \n
        }
      }
    }

    if (startNode) {
      try {
        range.setStart(startNode, startOffset)
        range.setEnd(endContainer, endOffset)
        range.deleteContents()

        if (type === 'note') {
          const mention = document.createElement('span')
          mention.className = 'kb-mention'
          mention.dataset.noteId = item.dataset.id
          mention.contentEditable = 'false'
          mention.textContent = `@${value}`
          range.insertNode(mention)
          const space = document.createTextNode('\u00A0') // Use non-breaking space for stability
          mention.after(space)
          this.setCursorAfter(space)
        } else {
          // Check if the command has an associated action
          const commandText = value || ''
          const commandObj = this.options.slashCommands?.find((c) => c.command === commandText)

          if (commandObj?.action) {
            commandObj.action()
          } else {
            const text = document.createTextNode(commandText)
            range.insertNode(text)
            this.setCursorAfter(text)
          }
        }
      } catch (err) {
        console.error('[SmartTextArea] Replacement failed:', err)
        // Fallback: If complex range fails, just insert at current cursor
        this.inputEl.focus()
      }
    } else {
      // LAST RESORT: If we can't find the trigger, just insert it at the cursor
      // This is better than doing nothing or jumping to the start.
      document.execCommand('insertText', false, (type === 'note' ? '@' : '') + value + ' ')
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

  public setSlashCommands(commands: { command: string; description: string; icon?: any }[]): void {
    this.options.slashCommands = commands
  }

  public setPlaceholder(ph: string): void {
    this.inputEl.dataset.placeholder = ph
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

  private renderIcon(icon: any, size: number = 14): string {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    const el = createElement(icon, { size })
    return el?.outerHTML || ''
  }
}
