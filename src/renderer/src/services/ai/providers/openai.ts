import { OpenAIBaseProvider } from './openai-base'

export class OpenAIProvider extends OpenAIBaseProvider {
  readonly id = 'openai'
  readonly name = 'OpenAI (ChatGPT)'
  readonly defaultBaseUrl = 'https://api.openai.com/v1'

  readonly supportedModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
}
