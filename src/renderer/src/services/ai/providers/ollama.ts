import { AIProvider, AIMessage, AIProviderConfig, AIProviderCapabilities } from './base'

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama'
  readonly name = 'Ollama (Local)'

  readonly supportedModels = [] // Fetched dynamically usually, but placeholder for now

  readonly defaultBaseUrl = 'http://localhost:11434'

  readonly capabilities: AIProviderCapabilities = {
    hasVision: true,
    supportsStreaming: true,
    isLocal: true,
    supportsCustomUrl: true
  }

  async sendMessage(_messages: AIMessage[], _config: AIProviderConfig): Promise<string> {
    throw new Error('Ollama sendMessage not implemented.')
  }

  async *streamResponse(_messages: AIMessage[], _config: AIProviderConfig): AsyncGenerator<string> {
    throw new Error('Ollama streamResponse not implemented.')
  }

  async validateConfig(config: AIProviderConfig): Promise<boolean> {
    return !!(config.baseUrl || this.defaultBaseUrl)
  }
}
