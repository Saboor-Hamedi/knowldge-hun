import { state } from '../../core/state'
import './rightbar.css'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export class RightBar {
  private container: HTMLElement
  private chatContainer!: HTMLElement
  private chatInput!: HTMLTextAreaElement
  private sendButton!: HTMLElement
  private messages: ChatMessage[] = []
  private apiKey: string | null = null

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.loadApiKey()
    this.render()
    this.attachEvents()
  }

  private async loadApiKey(): Promise<void> {
    try {
      const settings = await window.api.getSettings()
      this.apiKey = (settings as any)?.deepseekApiKey || null
    } catch (err) {
      console.error('[RightBar] Failed to load API key:', err)
    }
  }

  private render() {
    this.container.innerHTML = `
      <div class="rightbar">
        <div class="rightbar__header">
          <h3 class="rightbar__title">AI Chat</h3>
        </div>
        <div class="rightbar__chat-container" id="rightbar-chat-container">
          <div class="rightbar__chat-messages" id="rightbar-chat-messages"></div>
        </div>
        <div class="rightbar__chat-input-wrapper">
          <textarea
            class="rightbar__chat-input"
            id="rightbar-chat-input"
            placeholder="Ask me anything..."
            rows="3"
          ></textarea>
          <button class="rightbar__chat-send" id="rightbar-chat-send">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 14l12-6L2 2v4l8 2-8 2v4z"/>
            </svg>
          </button>
        </div>
      </div>
    `
    this.chatContainer = this.container.querySelector('#rightbar-chat-messages') as HTMLElement
    this.chatInput = this.container.querySelector('#rightbar-chat-input') as HTMLTextAreaElement
    this.sendButton = this.container.querySelector('#rightbar-chat-send') as HTMLElement
  }

  private attachEvents() {
    this.sendButton.addEventListener('click', () => this.sendMessage())
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })
  }

  private async sendMessage(): Promise<void> {
    const message = this.chatInput.value.trim()
    if (!message || !this.apiKey || this.chatInput.disabled) return

    this.addMessage('user', message)
    this.chatInput.value = ''
    this.chatInput.disabled = true
    this.sendButton.disabled = true

    // Show loading indicator
    this.addMessage('assistant', '...')

    try {
      const response = await this.callDeepSeekAPI(message)
      // Remove loading message and add actual response
      this.messages.pop()
      this.addMessage('assistant', response)
    } catch (err: any) {
      // Remove loading message and add error
      this.messages.pop()
      const errorMsg = err.message || 'Failed to get response'
      this.addMessage('assistant', `Error: ${errorMsg}`)
      console.error('[RightBar] API Error:', err)
    } finally {
      this.sendButton.disabled = false
      this.chatInput.disabled = !this.apiKey
      this.chatInput.focus()
    }
  }

  private async callDeepSeekAPI(userMessage: string): Promise<string> {
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            ...this.messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || 'No response'
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to DeepSeek API. Please check your internet connection.')
      }
      throw err
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
    await this.loadApiKey()
    const wasEmpty = this.messages.length === 0
    this.render()
    this.attachEvents()
    // If messages were cleared, show welcome message again if no key
    if (wasEmpty && !this.apiKey) {
      this.addMessage('assistant', '👋 **Welcome to AI Chat!**\n\nTo get started, add your DeepSeek API key in **Settings → Behavior → DeepSeek API Key**.\n\nGet your API key at [platform.deepseek.com](https://platform.deepseek.com)')
    }
  }
}
