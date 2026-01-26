import { AIProvider, AIMessage, AIProviderConfig, AIProviderCapabilities } from './base'

/**
 * Base class for OpenAI-compatible providers (OpenAI, DeepSeek, Grok).
 */
export abstract class OpenAIBaseProvider implements AIProvider {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly supportedModels: string[]
  abstract readonly defaultBaseUrl: string

  readonly capabilities: AIProviderCapabilities = {
    hasVision: true,
    supportsStreaming: true,
    isLocal: false,
    supportsCustomUrl: true
  }

  protected getBaseUrl(config: AIProviderConfig): string {
    return config.baseUrl || this.defaultBaseUrl
  }

  async sendMessage(messages: AIMessage[], config: AIProviderConfig): Promise<string> {
    const response = await fetch(`${this.getBaseUrl(config)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || this.supportedModels[0],
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
        stream: false
      }),
      signal: config.signal
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `AI request failed with status ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  async *streamResponse(messages: AIMessage[], config: AIProviderConfig): AsyncGenerator<string> {
    const response = await fetch(`${this.getBaseUrl(config)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || this.supportedModels[0],
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
        stream: true
      }),
      signal: config.signal
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `AI streaming failed with status ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            const content = data.choices[0]?.delta?.content
            if (content) yield content
          } catch (e) {
            console.warn('Failed to parse SSE line:', trimmed)
          }
        }
      }
    }
  }

  async validateConfig(config: AIProviderConfig): Promise<boolean> {
    if (!config.apiKey) return false
    try {
      // Fast check: just list models or similar lightweight call
      const response = await fetch(`${this.getBaseUrl(config)}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` }
      })
      return response.ok
    } catch {
      return false
    }
  }
}
