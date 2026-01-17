import { state } from '../../core/state'
import { aiService, type ChatMessage, type EditorContext } from '../../services/aiService'
import './rightbar.css'

export class RightBar {
  private container: HTMLElement
  private chatContainer!: HTMLElement
  private chatInput!: HTMLTextAreaElement
  private sendButton!: HTMLElement
  private inputWrapper!: HTMLElement
  private resizeHandle!: HTMLElement
  private messages: ChatMessage[] = []
  private isResizing = false
  private startX = 0
  private startWidth = 0

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    void aiService.loadApiKey()
    this.render()
    this.attachEvents()
  }

  setEditorContext(getEditorContent: () => string | null, getActiveNoteInfo: () => { title: string; id: string } | null): void {
    aiService.setEditorContext({ getEditorContent, getActiveNoteInfo })
  }

  private render() {
    this.container.innerHTML = `
      <div class="rightbar">
        <div class="rightbar__resize-handle" id="rightbar-resize-handle"></div>
        <div class="rightbar__header">
          <h3 class="rightbar__title">AI Chat</h3>
        </div>
        <div class="rightbar__chat-container" id="rightbar-chat-container">
          <div class="rightbar__chat-messages" id="rightbar-chat-messages"></div>
        </div>
        <div class="rightbar__chat-input-wrapper" id="rightbar-chat-input-wrapper">
          <div class="rightbar__chat-input-container">
            <textarea
              class="rightbar__chat-input"
              id="rightbar-chat-input"
              placeholder="Ask me anything..."
              rows="1"
            ></textarea>
            <div class="rightbar__chat-footer">
              <button class="rightbar__chat-send" id="rightbar-chat-send" title="Send message (Enter)">
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
    this.chatInput = this.container.querySelector('#rightbar-chat-input') as HTMLTextAreaElement
    this.sendButton = this.container.querySelector('#rightbar-chat-send') as HTMLElement
    this.inputWrapper = this.container.querySelector('#rightbar-chat-input-wrapper') as HTMLElement
    this.resizeHandle = this.container.querySelector('#rightbar-resize-handle') as HTMLElement
  }

  private attachEvents() {
    this.sendButton.addEventListener('click', () => this.sendMessage())

    // Auto-resize textarea
    this.chatInput.addEventListener('input', () => {
      this.autoResizeTextarea()
    })

    // Handle Enter key (Shift+Enter for new line)
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })

    // Focus input when clicking in the input area
    this.inputWrapper.addEventListener('click', (e) => {
      if (e.target === this.inputWrapper || (e.target as HTMLElement).closest('.rightbar__chat-input-container')) {
        this.chatInput.focus()
      }
    })

    // Resize handle events
    if (this.resizeHandle) {
      this.resizeHandle.addEventListener('mousedown', (e) => this.handleResizeStart(e))
    }
  }

  private handleResizeStart(e: MouseEvent): void {
    e.preventDefault()
    this.isResizing = true
    this.startX = e.clientX
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    if (shell) {
      const currentWidth = parseInt(getComputedStyle(shell).getPropertyValue('--right-panel-width') || '270', 10)
      this.startWidth = currentWidth
    }

    document.addEventListener('mousemove', this.handleResizeMove)
    document.addEventListener('mouseup', this.handleResizeEnd)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  private handleResizeMove = (e: MouseEvent): void => {
    if (!this.isResizing) return

    const deltaX = this.startX - e.clientX // Inverted because we're resizing from the left
    const newWidth = Math.max(200, Math.min(800, this.startWidth + deltaX)) // Min 200px, max 800px

    const shell = document.querySelector('.vscode-shell') as HTMLElement
    if (shell) {
      shell.style.setProperty('--right-panel-width', `${newWidth}px`)
    }
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
      const w = parseInt(getComputedStyle(shell).getPropertyValue('--right-panel-width') || '270', 10)
      if (w > 0) void window.api.updateSettings({ rightPanelWidth: w })
    }
  }

  private autoResizeTextarea(): void {
    this.chatInput.style.height = 'auto'
    const newHeight = Math.min(this.chatInput.scrollHeight, 200) // Max 200px
    this.chatInput.style.height = `${newHeight}px`
  }

  private async sendMessage(): Promise<void> {
    const message = this.chatInput.value.trim()
    if (!message) return

    this.addMessage('user', message)
    this.chatInput.value = ''
    this.autoResizeTextarea()
    this.sendButton.disabled = true

    // Check if API key exists
    const apiKey = aiService.getApiKey()
    if (!apiKey) {
      this.addMessage('assistant', '🔑 **API Key Required**\n\nTo use AI chat, please add your DeepSeek API key in **Settings → Behavior → DeepSeek API Key**.\n\nGet your API key at [platform.deepseek.com](https://platform.deepseek.com)')
      this.sendButton.disabled = false
      this.chatInput.focus()
      return
    }

    // Show loading indicator
    this.addMessage('assistant', '...')

    try {
      // Build context-aware message
      const contextMessage = aiService.buildContextMessage(message)
      const response = await aiService.callDeepSeekAPI(this.messages, contextMessage)
      // Remove loading message and add actual response
      this.messages.pop()
      this.addMessage('assistant', response)
    } catch (err: any) {
      // Remove loading message and add error
      this.messages.pop()
      const errorMsg = err.message || 'Failed to get response'
      this.addMessage('assistant', `❌ **Error**\n\n${errorMsg}\n\nPlease check your API key and internet connection.`)
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

  private renderMessages(): void {
    this.chatContainer.innerHTML = this.messages.map(msg => {
      // Support basic markdown in assistant messages
      let content = this.escapeHtml(msg.content)
      if (msg.role === 'assistant') {
        // Bold: **text**
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Links: [text](url)
        content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--primary); text-decoration: underline;">$1</a>')
      }
      content = content.replace(/\n/g, '<br>')
      return `
        <div class="rightbar__message rightbar__message--${msg.role}">
          <div class="rightbar__message-content">${content}</div>
        </div>
      `
    }).join('')
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  async refreshApiKey(): Promise<void> {
    await aiService.loadApiKey()
    const wasEmpty = this.messages.length === 0
    this.render()
    this.attachEvents()
    // If messages were cleared, show welcome message again if no key
    if (wasEmpty && !aiService.getApiKey()) {
      this.addMessage('assistant', '👋 **Welcome to AI Chat!**\n\nTo get started, add your DeepSeek API key in **Settings → Behavior → DeepSeek API Key**.\n\nGet your API key at [platform.deepseek.com](https://platform.deepseek.com)')
    }
  }
}
