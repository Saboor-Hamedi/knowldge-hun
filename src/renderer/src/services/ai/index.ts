import { loadApiKeyFromSettings, validateApiKey } from './keyManager'
import { buildContextMessage } from './retriever'
import { fetchWithTimeout, retryWithBackoff, parseSSE } from './reliability'
import { setTelemetryOptIn, saveKeySecurely } from './privacy'

export type ChatMessage = { role: 'user' | 'assistant' | string; content: string; timestamp?: number }

export class AIService {
  private apiKey: string | null = null
  private editorContext?: { getEditorContent?: () => string | null; getActiveNoteInfo?: () => { title: string; id: string } | null }

  async loadApiKey(): Promise<void> {
    this.apiKey = await loadApiKeyFromSettings()
  }

  getApiKey(): string | null {
    return this.apiKey
  }

  async setApiKey(token: string): Promise<void> {
    await saveKeySecurely(token)
    this.apiKey = token
  }

  setEditorContext(context: { getEditorContent?: () => string | null; getActiveNoteInfo?: () => { title: string; id: string } | null }): void {
    this.editorContext = context
  }

  async buildContextMessage(userMessage: string): Promise<string> {
    const editorContent = this.editorContext?.getEditorContent?.()
    const noteInfo = this.editorContext?.getActiveNoteInfo?.()
    return await buildContextMessage(userMessage, editorContent, noteInfo)
  }

  async validateKey(token: string): Promise<{ valid: boolean; message?: string }> {
    return await validateApiKey(token)
  }

  // Simple call to DeepSeek chat endpoint using reliability helpers
  async callDeepSeekAPI(messages: ChatMessage[], contextMessage: string): Promise<string> {
    if (!this.apiKey) throw new Error('API key not configured')

    const messagesForAPI = messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
    messagesForAPI.push({ role: 'user', content: contextMessage })

    const body = {
      model: 'deepseek-chat',
      messages: messagesForAPI,
      temperature: 0.7,
      max_tokens: 2000
    }

    const fn = async () => {
      const res = await fetchWithTimeout('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body)
      }, 20000)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `API error: ${res.status}`)
      }
      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content || 'No response'
      return stripBoilerplate(raw)
    }

    return await retryWithBackoff(fn, 3, 700)
  }

  // Future: streaming version that uses streamToText
  async callDeepSeekAPIStream(messages: ChatMessage[], contextMessage: string, onChunk?: (chunk: string) => void, signal?: AbortSignal): Promise<string> {
    if (!this.apiKey) throw new Error('API key not configured')
    const messagesForAPI = messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
    messagesForAPI.push({ role: 'user', content: contextMessage })
    const res = await fetchWithTimeout('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: messagesForAPI, stream: true })
    }, 30000, signal)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    // Use SSE parser to extract `data: {...}` payloads and map to content chunks.
    let accumulated = ''
    // @ts-ignore - body is a ReadableStream
    await parseSSE(res.body as any, (data: string) => {
      if (!data) return
      let chunk = ''
      try {
        const obj = JSON.parse(data)
        // OpenAI-like structure: obj.choices[0].delta.content or obj.choices[0].message.content
        const choice = obj.choices && obj.choices[0]
        if (choice) {
          if (choice.delta && typeof choice.delta.content === 'string') chunk = choice.delta.content
          else if (choice.message && typeof choice.message.content === 'string') chunk = choice.message.content
        }
        // Fallbacks
        if (!chunk && typeof obj.content === 'string') chunk = obj.content
      } catch (e) {
        // not JSON, treat raw data as chunk
        chunk = data
      }
      if (chunk) {
        // If this is the very first chunk, strip common leading boilerplate
        if (accumulated.length === 0) {
          chunk = stripLeadingBoilerplate(chunk)
        }
        accumulated += chunk
        try { if (onChunk) onChunk(chunk) } catch (_) {}
      }
    })

    // Final pass: strip trailing boilerplate/sign-offs
    accumulated = stripTrailingBoilerplate(accumulated)
    return accumulated
  }

  async getRelevantContext(maxChars = 4000): Promise<string> {
    // wrapper left for backward compatibility: callers should pass a query/user message
    return ''
  }

  async setTelemetry(enabled: boolean): Promise<void> {
    await setTelemetryOptIn(enabled)
  }

  telemetryEnabled(): boolean {
    // read settings synchronously is not possible; caller should fetch settings
    return false
  }
}

export const aiService = new AIService()

// Helpers to trim conversational boilerplate
const leadingRegex = /^\s*(?:sure|okay|ok|of course|certainly|here's|here you go|no problem|happy to help|i can|i'll|i will|i'm going to|let me)(?:[\s,!:.-]|$)+/i
const trailingRegex = /(?:\s*(?:let me know if you need anything|let me know|if you want me to|happy to help|hope this helps|please let me know|thanks|thank you|regards)[\s\.!,-]*)+$/i

function stripLeadingBoilerplate(s: string): string {
  if (!s) return s
  return s.replace(leadingRegex, '')
}

function stripTrailingBoilerplate(s: string): string {
  if (!s) return s
  return s.replace(trailingRegex, '').trim()
}

function stripBoilerplate(s: string): string {
  return stripTrailingBoilerplate(stripLeadingBoilerplate(s)).trim()
}
