import { AIProvider } from './providers/base'
import { DeepSeekProvider } from './providers/deepseek'
import { OpenAIProvider } from './providers/openai'
import { OllamaProvider } from './providers/ollama'
import { GrokProvider } from './providers/grok'
import { ClaudeProvider } from './providers/claude'

export type ProviderType = 'deepseek' | 'openai' | 'ollama' | 'grok' | 'claude'

export class AIProviderFactory {
  private static providers: Map<ProviderType, AIProvider> = new Map()

  static getProvider(type: ProviderType): AIProvider {
    if (!this.providers.has(type)) {
      this.providers.set(type, this.createProvider(type))
    }
    return this.providers.get(type)!
  }

  private static createProvider(type: ProviderType): AIProvider {
    switch (type) {
      case 'deepseek':
        return new DeepSeekProvider()
      case 'openai':
        return new OpenAIProvider()
      case 'ollama':
        return new OllamaProvider()
      case 'grok':
        return new GrokProvider()
      case 'claude':
        return new ClaudeProvider()
      default:
        throw new Error(`Unknown provider type: ${type}`)
    }
  }

  static getAllProviders(): AIProvider[] {
    return [
      new DeepSeekProvider(),
      new OpenAIProvider(),
      new ClaudeProvider(),
      new GrokProvider(),
      new OllamaProvider()
    ]
  }
}
