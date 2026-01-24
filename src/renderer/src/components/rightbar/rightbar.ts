import { aiService, type ChatMessage } from '../../services/aiService'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import './rightbar.css'

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
    <span></span><span></span><span></span>
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

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      breaks: true, // Convert \n to <br> for chat
      typographer: true
    })
    void aiService.loadApiKey()
    void this.loadNotes()
    this.render()
    this.attachEvents()
  }

  private async loadNotes(): Promise<void> {
    try {
      const notes = await window.api.listNotes()
      this.allNotes = notes.map(note => ({
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
          <button class="rightbar__header-close" id="rightbar-header-close" title="Close (Ctrl+I)" aria-label="Close panel">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        </div>
        <div class="rightbar__chat-container" id="rightbar-chat-container">
          <div class="rightbar__chat-messages" id="rightbar-chat-messages"></div>
        </div>
        <div class="rightbar__chat-input-wrapper" id="rightbar-chat-input-wrapper">
          <div class="rightbar__chat-input-container" id="rightbar-chat-input-container">
            <div class="rightbar__chat-input-wrapper-inner">
              <div
                class="rightbar__chat-input"
                id="rightbar-chat-input"
                contenteditable="true"
                data-placeholder="Ask me anything... Use @notename to reference notes"
                role="textbox"
                aria-multiline="true"
              ></div>
              <div class="rightbar__chat-autocomplete" id="rightbar-chat-autocomplete"></div>
            </div>
            <div class="rightbar__chat-footer">
              <div class="rightbar__chat-footer-left">
                <span class="rightbar__chat-hint">Shift+Enter for new line</span>
                <span class="rightbar__chat-counter" id="rightbar-chat-counter">0</span>
              </div>
              <button class="rightbar__chat-send" id="rightbar-chat-send" type="button" title="Send message (Enter)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 14l12-6L2 2v4l8 2-8 2v4z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `
    this.chatContainer = this.container.querySelector('#rightbar-chat-messages') as HTMLElement
    this.chatInput = this.container.querySelector('#rightbar-chat-input') as HTMLElement
    this.sendButton = this.container.querySelector('#rightbar-chat-send') as HTMLButtonElement
    this.inputWrapper = this.container.querySelector('#rightbar-chat-input-wrapper') as HTMLElement
    this.resizeHandle = this.container.querySelector('#rightbar-resize-handle') as HTMLElement
    this.autocompleteDropdown = this.container.querySelector('#rightbar-chat-autocomplete') as HTMLElement
    this.characterCounter = this.container.querySelector('#rightbar-chat-counter') as HTMLElement

    const closeBtn = this.container.querySelector('#rightbar-header-close') as HTMLButtonElement
    closeBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('knowledge-hub:toggle-right-sidebar'))
    })

    // Initialize character counter
    if (this.characterCounter) {
      this.characterCounter.textContent = '0'
    }
  }

  private attachEvents(): void {
    this.sendButton.addEventListener('click', () => this.sendMessage())

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
      if (action === 'copy') {
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
      }
    })
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
    clone.querySelectorAll('.rightbar__mention').forEach(span => {
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
      if (existingText === `@${range.toString().substring(atIndex + 1, atIndex + 1 + queryLength)}`) {
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
    const filteredNotes = this.allNotes.filter(note => {
      const titleLower = note.title.toLowerCase()
      return titleLower.includes(query) || titleLower.startsWith(query)
    }).slice(0, 8) // Limit to 8 results

    if (filteredNotes.length === 0) {
      this.hideAutocomplete()
      return
    }

    this.autocompleteItems = []
    this.selectedAutocompleteIndex = -1

    // Store context for selection
    ;(this.autocompleteDropdown as any).__context = { atIndex, range, query }

    const html = filteredNotes.map((note, index) => {
      const displayTitle = note.title
      const displayPath = note.path ? `/${note.path}` : ''
      return `
        <div class="rightbar__autocomplete-item" data-index="${index}" data-note-id="${note.id}" data-note-title="${this.escapeHtml(note.title)}">
          <span class="rightbar__autocomplete-item-title">${this.escapeHtml(displayTitle)}</span>
          ${displayPath ? `<span class="rightbar__autocomplete-item-path">${this.escapeHtml(displayPath)}</span>` : ''}
        </div>
      `
    }).join('')

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
    if (this.selectedAutocompleteIndex < 0 || this.selectedAutocompleteIndex >= this.autocompleteItems.length) {
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
    
    mentions.forEach(mention => {
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

  private async doSend(message: string): Promise<void> {
    this.addMessage('user', message)
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

    try {
      const contextMessage = aiService.buildContextMessage(message)
      const response = await aiService.callDeepSeekAPI(this.messages, contextMessage)
      this.isLoading = false
      this.addMessage('assistant', response)
    } catch (err: unknown) {
      this.isLoading = false
      this.lastFailedMessage = message
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response'
      this.addMessage(
        'assistant',
        `❌ **Error**\n\n${errorMsg}\n\nPlease check your API key and internet connection.`
      )
      console.error('[RightBar] API Error:', err)
    } finally {
      this.sendButton.disabled = false
      this.chatInput.focus()
    }
  }

  private addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({ role, content, timestamp: Date.now() })
    this.renderMessages()
  }

  private formatContent(text: string, isAssistant: boolean): string {
    if (!isAssistant) {
      // User messages: simple line breaks
      return this.escapeHtml(text).replace(/\n/g, '<br>')
    }
    // Assistant messages: full markdown rendering
    if (!this.md) {
      // Fallback if md not initialized (shouldn't happen, but safety check)
      this.md = new MarkdownIt({ html: true, linkify: true, breaks: true, typographer: true })
    }
    const rawHtml = this.md.render(text)
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['class', 'target', 'rel'],
      ADD_TAGS: ['pre', 'code'],
      KEEP_CONTENT: true
    })
    return cleanHtml
  }

  private escapeHtml(raw: string): string {
    const div = document.createElement('div')
    div.textContent = raw
    return div.innerHTML
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
        const actions =
          msg.role === 'assistant'
            ? `<div class="rightbar__message-actions">
             <button type="button" class="rightbar__message-action" data-action="copy" title="Copy">Copy</button>
             ${isError && this.lastFailedMessage ? '<button type="button" class="rightbar__message-action rightbar__message-action--retry" data-action="retry" title="Retry">Retry</button>' : ''}
           </div>`
            : ''
        return `
        <div class="rightbar__message rightbar__message--${msg.role}">
          <div class="rightbar__message-content">${content}</div>
          ${actions}
        </div>
      `
      })
      .join('')

    if (this.isLoading) html += TYPING_HTML

    this.chatContainer.innerHTML = html
    this.chatContainer.scrollTo({ top: this.chatContainer.scrollHeight, behavior: 'smooth' })
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
