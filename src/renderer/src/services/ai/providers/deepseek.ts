import { OpenAIBaseProvider } from './openai-base'

export class DeepSeekProvider extends OpenAIBaseProvider {
  readonly id = 'deepseek'
  readonly name = 'DeepSeek'
  readonly defaultBaseUrl = 'https://api.deepseek.com/v1'

  readonly supportedModels = ['deepseek-chat', 'deepseek-coder']
}
