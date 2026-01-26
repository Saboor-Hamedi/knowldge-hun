import { AIProvider, AIMessage, AIProviderConfig, AIProviderCapabilities } from './base'

export class GrokProvider implements AIProvider {
  readonly id = 'grok'
  readonly name = 'xAI Grok'

  readonly supportedModels = ['grok-beta', 'grok-vision-beta']

  readonly capabilities: AIProviderCapabilities = {
    hasVision: true,
    supportsStreaming: true,
    isLocal: false,
    supportsCustomUrl: false
  }

  async sendMessage(_messages: AIMessage[], _config: AIProviderConfig): Promise<string> {
    throw new Error('Grok sendMessage not implemented.')
  }

  async *streamResponse(_messages: AIMessage[], _config: AIProviderConfig): AsyncGenerator<string> {
    throw new Error('Grok streamResponse not implemented.')
  }

  async validateConfig(config: AIProviderConfig): Promise<boolean> {
    return !!config.apiKey && config.apiKey.startsWith('xai-')
  }
}
