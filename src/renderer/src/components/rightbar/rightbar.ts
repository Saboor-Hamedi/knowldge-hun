import { aiService, type ChatMessage } from '../../services/aiService'
import { notificationManager } from '../notification/notification'
import { createElement, Key } from 'lucide'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import './rightbar.css'

const WELCOME_HTML = `
  <div class="rightbar__welcome">
    <div class="rightbar__welcome-icon">✨</div>
    <p class="rightbar__welcome-title">AI Chat</p>
    <p class="rightbar__welcome-text">Ask about your notes, get summaries, or brainstorm ideas. I have context from your current note.</p>
    <p class="rightbar__welcome-hint">Ctrl+Shift+I to toggle · Drag the left edge to resize</p>
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
  private chatInput!: HTMLTextAreaElement
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

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      breaks: true, // Convert \n to <br> for chat
      typographer: true
    })
    void aiService.loadApiKey()
    this.render()
    this.attachEvents()
  }

  setEditorContext(getEditorContent: () => string | null, getActiveNoteInfo: () => { title: string; id: string } | null): void {
    aiService.setEditorContext({ getEditorContent, getActiveNoteInfo })
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="rightbar">
        <div class="rightbar__resize-handle" id="rightbar-resize-handle"></div>
        <div class="rightbar__header">
          <h3 class="rightbar__title">AI Chat</h3>
          <div style="margin-left:auto;display:flex;gap:6px;align-items:center;">
            <button class="rightbar__header-close" id="rightbar-header-close" title="Close (Ctrl+Shift+I)" aria-label="Close panel">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            </button>
          </div>
        </div>
        <div class="rightbar__chat-container" id="rightbar-chat-container">
          <div class="rightbar__chat-messages" id="rightbar-chat-messages"></div>
        </div>
        <div class="rightbar__api-dropdown" id="rightbar-api-dropdown" style="display:none;position:absolute;right:12px;top:44px;z-index:40;width:320px;background:var(--surface);box-shadow:0 6px 18px rgba(0,0,0,0.12);padding:10px;border-radius:6px;">
          <div style="display:flex;flex-direction:column;gap:8px">
            <label style="font-size:12px;color:var(--muted)">DeepSeek API Key</label>
            <input id="rightbar-api-input" type="password" placeholder="sk-..." style="width:100%;padding:8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--fg)" />
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button id="rightbar-api-clear" class="settings-button settings-button--ghost">Clear</button>
              <button id="rightbar-api-save" class="settings-button settings-button--primary">Save</button>
            </div>
            <div style="font-size:12px;color:var(--muted)">You can also manage your key in <a href="#" id="rightbar-api-open-settings">Settings → Behavior</a></div>
          </div>
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
    this.chatInput = this.container.querySelector('#rightbar-chat-input') as HTMLTextAreaElement
    this.sendButton = this.container.querySelector('#rightbar-chat-send') as HTMLButtonElement
    this.inputWrapper = this.container.querySelector('#rightbar-chat-input-wrapper') as HTMLElement
    this.resizeHandle = this.container.querySelector('#rightbar-resize-handle') as HTMLElement

    const closeBtn = this.container.querySelector('#rightbar-header-close') as HTMLButtonElement
    closeBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('knowledge-hub:toggle-right-sidebar'))
    })

    // removed redundant settings-open button (we provide dropdown and separate settings link)

    // API dropdown toggle and handlers
    const apiDropdown = this.container.querySelector('#rightbar-api-dropdown') as HTMLElement | null
    const apiInput = this.container.querySelector('#rightbar-api-input') as HTMLInputElement | null
    const apiSave = this.container.querySelector('#rightbar-api-save') as HTMLButtonElement | null
    const apiClear = this.container.querySelector('#rightbar-api-clear') as HTMLButtonElement | null
    const apiOpenSettingsLink = this.container.querySelector('#rightbar-api-open-settings') as HTMLAnchorElement | null

    const toggleApiDropdown = (): void => {
      if (!apiDropdown) return
      if (apiDropdown.style.display === 'none' || !apiDropdown.style.display) {
        // set current value
        if (apiInput) apiInput.value = aiService.getApiKey() || ''
        apiDropdown.style.display = 'block'
        setTimeout(() => apiInput?.focus(), 50)
      } else {
        apiDropdown.style.display = 'none'
      }
    }

    // Add small button to header to toggle dropdown (styled minimal and inserted left of close button)
    const header = this.container.querySelector('.rightbar__header') as HTMLElement | null
    if (header) {
      const toggleBtn = document.createElement('button')
      toggleBtn.className = 'rightbar__api-toggle'
      toggleBtn.title = 'Add API Key'
      // Use Lucide Key icon so it matches other icons
      try {
        const svgEl = createElement(Key, { size: 14, 'stroke-width': 1.5, stroke: 'currentColor', color: 'currentColor' })
        toggleBtn.innerHTML = svgEl && (svgEl as any).outerHTML ? (svgEl as any).outerHTML : ''
      } catch (e) {
        // Fallback to text icon
        toggleBtn.textContent = '🔑'
      }
      toggleBtn.style.cursor = 'pointer'
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        toggleApiDropdown()
      })
      // Insert before the close button so close remains at the far right
      const closeBtnEl = this.container.querySelector('#rightbar-header-close')
      if (closeBtnEl && closeBtnEl.parentElement) closeBtnEl.parentElement.insertBefore(toggleBtn, closeBtnEl)
      else header.appendChild(toggleBtn)
    }

    // Save API key
    apiSave?.addEventListener('click', async () => {
      if (!apiInput) return
      const token = apiInput.value.trim()
      if (!token) {
        notificationManager.show('Please enter an API key', 'warning')
        return
      }
      apiSave.disabled = true
      try {
        await window.api.updateSettings({ deepseekApiKey: token })
        await aiService.loadApiKey()
        await this.refreshApiKey()
        notificationManager.show('DeepSeek API key saved', 'success')
        if (apiDropdown) apiDropdown.style.display = 'none'
      } catch (err) {
        console.error('[RightBar] Failed to save API key', err)
        notificationManager.show('Failed to save API key', 'error')
      } finally {
        apiSave.disabled = false
      }
    })

    apiClear?.addEventListener('click', async () => {
      if (!apiInput) return
      apiInput.value = ''
      apiClear.disabled = true
      try {
        await window.api.updateSettings({ deepseekApiKey: '' })
        await aiService.loadApiKey()
        await this.refreshApiKey()
        notificationManager.show('DeepSeek API key cleared', 'success')
      } catch (err) {
        console.error('[RightBar] Failed to clear API key', err)
        notificationManager.show('Failed to clear API key', 'error')
      } finally {
        apiClear.disabled = false
      }
    })

    apiOpenSettingsLink?.addEventListener('click', (e) => {
      e.preventDefault()
      // Reuse existing event to open settings
      window.dispatchEvent(new CustomEvent('knowledge-hub:open-settings', { detail: { section: 'behavior' } }))
      if (apiDropdown) apiDropdown.style.display = 'none'
    })

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (!apiDropdown) return
      const within = target.closest('#rightbar-api-dropdown') || target.closest('.rightbar__api-toggle')
      if (!within) apiDropdown.style.display = 'none'
    })
  }

  private attachEvents(): void {
    this.sendButton.addEventListener('click', () => this.sendMessage())

    this.chatInput.addEventListener('input', () => this.autoResizeTextarea())

    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })

    this.inputWrapper.addEventListener('click', (e) => {
      if (e.target === this.inputWrapper || (e.target as HTMLElement).closest('.rightbar__chat-input-container')) {
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
            setTimeout(() => { btn.textContent = prev; btn.disabled = false }, 1500)
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
      const w = parseInt(getComputedStyle(shell).getPropertyValue('--right-panel-width') || '270', 10)
      if (w > 0) void window.api.updateSettings({ rightPanelWidth: w })
    }
  }

  private autoResizeTextarea(): void {
    this.chatInput.style.height = 'auto'
    this.chatInput.style.height = `${Math.min(this.chatInput.scrollHeight, 200)}px`
  }

  private sendMessage(): void {
    const text = this.chatInput.value.trim()
    if (!text) return
    this.chatInput.value = ''
    this.autoResizeTextarea()
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
      this.addMessage('assistant', '🔑 **API Key Required**\n\nAdd your DeepSeek API key in **Settings → Behavior → DeepSeek API Key**.\n\nGet your key at [platform.deepseek.com](https://platform.deepseek.com)')
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

    let html = this.messages.map((msg) => {
      const isError = msg.role === 'assistant' && msg.content.startsWith('❌')
      const content = this.formatContent(msg.content, msg.role === 'assistant')
      const actions = msg.role === 'assistant'
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
    }).join('')

    if (this.isLoading) html += TYPING_HTML

    this.chatContainer.innerHTML = html
    this.chatContainer.scrollTo({ top: this.chatContainer.scrollHeight, behavior: 'smooth' })
  }

  async refreshApiKey(): Promise<void> {
    await aiService.loadApiKey()
    const wasEmpty = this.messages.length === 0
    this.render()
    this.attachEvents()
    if (wasEmpty && !aiService.getApiKey()) {
      this.addMessage('assistant', '👋 **Welcome!** Add your DeepSeek API key in **Settings → Behavior → DeepSeek API Key**. Get it at [platform.deepseek.com](https://platform.deepseek.com)')
    }
  }
}
