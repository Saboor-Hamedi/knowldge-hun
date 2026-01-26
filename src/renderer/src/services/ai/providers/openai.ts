import { AIProvider, AIMessage, AIProviderConfig, AIProviderCapabilities } from './base'

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai'
  readonly name = 'OpenAI (ChatGPT)'

  readonly supportedModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']

  readonly capabilities: AIProviderCapabilities = {
    hasVision: true,
    supportsStreaming: true,
    isLocal: false,
    supportsCustomUrl: true // Via Azure or proxy
  }

  async sendMessage(_messages: AIMessage[], _config: AIProviderConfig): Promise<string> {
    throw new Error('OpenAI sendMessage not implemented.')
  }

  async *streamResponse(_messages: AIMessage[], _config: AIProviderConfig): AsyncGenerator<string> {
    throw new Error('OpenAI streamResponse not implemented.')
  }

  async validateConfig(config: AIProviderConfig): Promise<boolean> {
    return !!config.apiKey && config.apiKey.startsWith('sk-')
  }
}
