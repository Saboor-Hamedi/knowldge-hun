import { AIProvider, AIMessage, AIProviderConfig, AIProviderCapabilities } from './base'

export class DeepSeekProvider implements AIProvider {
  readonly id = 'deepseek'
  readonly name = 'DeepSeek'

  readonly supportedModels = ['deepseek-chat', 'deepseek-coder']

  readonly capabilities: AIProviderCapabilities = {
    hasVision: false,
    supportsStreaming: true,
    isLocal: false,
    supportsCustomUrl: false
  }

  async sendMessage(_messages: AIMessage[], _config: AIProviderConfig): Promise<string> {
    throw new Error('DeepSeek sendMessage not implemented.')
  }

  async *streamResponse(_messages: AIMessage[], _config: AIProviderConfig): AsyncGenerator<string> {
    throw new Error('DeepSeek streamResponse not implemented.')
  }

  async validateConfig(config: AIProviderConfig): Promise<boolean> {
    return !!config.apiKey && (config.apiKey.startsWith('sk-') || config.apiKey.length > 20)
  }
}
