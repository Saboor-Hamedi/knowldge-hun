import { AIProvider, AIMessage, AIProviderConfig, AIProviderCapabilities } from './base'

export class ClaudeProvider implements AIProvider {
  readonly id = 'claude'
  readonly name = 'Anthropic Claude'

  readonly supportedModels = [
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307'
  ]

  readonly capabilities: AIProviderCapabilities = {
    hasVision: true,
    supportsStreaming: true,
    isLocal: false,
    supportsCustomUrl: false
  }

  async sendMessage(messages: AIMessage[], config: AIProviderConfig): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true' // In Electron we might need this or proxy
      },
      body: JSON.stringify({
        model: config.model || this.supportedModels[0],
        messages: messages.filter((m) => m.role !== 'system'),
        system: messages.find((m) => m.role === 'system')?.content,
        max_tokens: config.maxTokens || 4096,
        stream: false
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `Claude request failed: ${response.status}`)
    }

    const data = await response.json()
    return data.content[0].text
  }

  async *streamResponse(messages: AIMessage[], config: AIProviderConfig): AsyncGenerator<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model || this.supportedModels[0],
        messages: messages.filter((m) => m.role !== 'system'),
        system: messages.find((m) => m.role === 'system')?.content,
        max_tokens: config.maxTokens || 4096,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `Claude streaming failed: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'content_block_delta' && data.delta?.text) {
              yield data.delta.text
            }
          } catch {
            // Likely not JSON (e.g. event: message)
          }
        }
      }
    }
  }

  async validateConfig(config: AIProviderConfig): Promise<boolean> {
    return !!config.apiKey && config.apiKey.startsWith('sk-ant-')
  }
}
