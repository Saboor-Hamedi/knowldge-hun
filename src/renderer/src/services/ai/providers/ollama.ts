import { AIProvider, AIMessage, AIProviderConfig, AIProviderCapabilities } from './base'

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama'
  readonly name = 'Ollama (Local)'
  readonly supportedModels = ['llama3', 'mistral', 'phi3'] // Common defaults
  readonly defaultBaseUrl = 'http://localhost:11434'

  readonly capabilities: AIProviderCapabilities = {
    hasVision: true,
    supportsStreaming: true,
    isLocal: true,
    supportsCustomUrl: true
  }

  async sendMessage(messages: AIMessage[], config: AIProviderConfig): Promise<string> {
    const baseUrl = config.baseUrl || this.defaultBaseUrl
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'llama3',
        messages,
        stream: false
      }),
      signal: config.signal
    })

    if (!response.ok) {
      if (response.status === 404) {
        const model = config.model || 'llama3'
        throw new Error(
          `📂 **Model not found: ${model}**\n\nYou need to download this model first. Run \`ollama run ${model}\` in your terminal.`
        )
      }
      throw new Error(`Ollama failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.message.content
  }

  async *streamResponse(messages: AIMessage[], config: AIProviderConfig): AsyncGenerator<string> {
    const baseUrl = config.baseUrl || this.defaultBaseUrl
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'llama3',
        messages,
        stream: true
      }),
      signal: config.signal
    })

    if (!response.ok) {
      if (response.status === 404) {
        const model = config.model || 'llama3'
        throw new Error(
          `📂 **Model not found: ${model}**\n\nYou need to download this model first. Run \`ollama run ${model}\` in your terminal.`
        )
      }
      throw new Error(`Ollama streaming failed: ${response.statusText}`)
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
        if (line.trim()) {
          try {
            const data = JSON.parse(line)
            if (data.message?.content) yield data.message.content
          } catch (e) {
            // Partial JSON?
          }
        }
      }
    }
  }

  async listModels(config: AIProviderConfig): Promise<string[]> {
    try {
      const baseUrl = config.baseUrl || this.defaultBaseUrl
      const response = await fetch(`${baseUrl}/api/tags`)
      if (!response.ok) return []
      const data = await response.json()
      return data.models?.map((m: any) => m.name) || []
    } catch {
      return []
    }
  }

  async validateConfig(config: AIProviderConfig): Promise<boolean> {
    try {
      const baseUrl = config.baseUrl || this.defaultBaseUrl
      const response = await fetch(`${baseUrl}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }
}
