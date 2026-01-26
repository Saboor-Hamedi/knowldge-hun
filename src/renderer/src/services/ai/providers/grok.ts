import { OpenAIBaseProvider } from './openai-base'

export class GrokProvider extends OpenAIBaseProvider {
  readonly id = 'grok'
  readonly name = 'xAI Grok'
  readonly defaultBaseUrl = 'https://api.x.ai/v1'

  readonly supportedModels = ['grok-beta', 'grok-vision-beta']
}
