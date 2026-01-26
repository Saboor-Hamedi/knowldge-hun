import { state } from '../../core/state'
import { AIProviderFactory, ProviderType } from './factory'
import { AIMessage, AIProviderConfig } from './providers/base'

/**
 * Main AI Service that orchestration communication with different AI providers.
 * It automatically uses the provider and configuration defined in app settings.
 */
export class AIProviderManager {
  /**
   * Sends a message to the currently configured AI provider.
   */
  async sendMessage(
    messages: AIMessage[],
    overrideConfig?: Partial<AIProviderConfig>
  ): Promise<string> {
    const provider = this.getActiveProvider()
    const config = this.getProviderConfig(overrideConfig)

    // Ollama doesn't need key
    if (!config.apiKey && !provider.capabilities.isLocal) {
      throw new Error(`API Key for ${provider.name} is not configured. Please check your settings.`)
    }

    return provider.sendMessage(messages, config)
  }

  /**
   * Streams a response from the currently configured AI provider.
   */
  async *streamResponse(
    messages: AIMessage[],
    overrideConfig?: Partial<AIProviderConfig>
  ): AsyncGenerator<string> {
    const provider = this.getActiveProvider()
    const config = this.getProviderConfig(overrideConfig)

    if (!config.apiKey && !provider.capabilities.isLocal) {
      throw new Error(`API Key for ${provider.name} is not configured. Please check your settings.`)
    }

    yield* provider.streamResponse(messages, config)
  }

  /**
   * Fetches models from the active provider.
   */
  async listModels(overrideConfig?: Partial<AIProviderConfig>): Promise<string[]> {
    const provider = this.getActiveProvider()
    const config = this.getProviderConfig(overrideConfig)
    if (provider.listModels) {
      return provider.listModels(config)
    }
    return provider.supportedModels
  }

  /**
   * Helper to get the current AIProvider instance based on settings.
   */
  private getActiveProvider() {
    const providerType = (state.settings?.aiProvider || 'deepseek') as ProviderType
    return AIProviderFactory.getProvider(providerType)
  }

  /**
   * Aggregates configuration from global settings for the active provider.
   */
  private getProviderConfig(override?: Partial<AIProviderConfig>): AIProviderConfig {
    const s = state.settings
    const providerType = s?.aiProvider || 'deepseek'

    let apiKey: string | undefined
    let baseUrl: string | undefined

    switch (providerType) {
      case 'openai':
        apiKey = s?.openaiApiKey
        break
      case 'claude':
        apiKey = s?.claudeApiKey
        break
      case 'deepseek':
        apiKey = s?.deepseekApiKey
        break
      case 'grok':
        apiKey = s?.grokApiKey
        break
      case 'ollama':
        baseUrl = s?.ollamaBaseUrl
        break
    }

    return {
      apiKey,
      baseUrl,
      model: s?.aiModel || undefined,
      ...override
    }
  }
}

export const aiProviderManager = new AIProviderManager()
