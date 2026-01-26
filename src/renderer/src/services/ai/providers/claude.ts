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

  async sendMessage(_messages: AIMessage[], _config: AIProviderConfig): Promise<string> {
    throw new Error('Claude sendMessage not implemented.')
  }

  async *streamResponse(_messages: AIMessage[], _config: AIProviderConfig): AsyncGenerator<string> {
    throw new Error('Claude streamResponse not implemented.')
  }

  async validateConfig(config: AIProviderConfig): Promise<boolean> {
    return !!config.apiKey && config.apiKey.startsWith('sk-ant-')
  }
}
