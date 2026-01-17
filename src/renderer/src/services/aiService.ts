// import { state } from '../core/state'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface EditorContext {
  getEditorContent: () => string | null
  getActiveNoteInfo: () => { title: string; id: string } | null
}

export class AIService {
  private apiKey: string | null = null
  private editorContext?: EditorContext

  async loadApiKey(): Promise<void> {
    try {
      const settings = await window.api.getSettings()
      this.apiKey = (settings as any)?.deepseekApiKey || null
    } catch (err) {
      console.error('[AIService] Failed to load API key:', err)
    }
  }

  setEditorContext(context: EditorContext): void {
    this.editorContext = context
  }

  getApiKey(): string | null {
    return this.apiKey
  }

  buildContextMessage(userMessage: string): string {
    if (!this.editorContext) {
      return userMessage
    }

    const noteInfo = this.editorContext.getActiveNoteInfo?.()
    const editorContent = this.editorContext.getEditorContent?.()

    if (!noteInfo && !editorContent) {
      return userMessage
    }

    let context = 'Context: You are helping with a note-taking application. '

    if (noteInfo) {
      context += `The user is currently working on a note titled "${noteInfo.title}" (ID: ${noteInfo.id}). `
    }

    if (editorContent && editorContent.trim()) {
      const contentPreview = editorContent.length > 2000
        ? editorContent.substring(0, 2000) + '...'
        : editorContent
      context += `\n\nCurrent note content:\n${contentPreview}\n\n`
    }

    context += `\nUser's question: ${userMessage}`

    return context
  }

  async callDeepSeekAPI(messages: ChatMessage[], contextMessage: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key not configured')
    }

    try {
      // Build messages array - exclude the last user message, use the context-aware one
      const messagesForAPI = messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
      messagesForAPI.push({ role: 'user', content: contextMessage })

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messagesForAPI,
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
}

export const aiService = new AIService()
