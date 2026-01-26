/**
 * Represents a single message in a conversation.
 */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Common configuration for any AI provider.
 */
export interface AIProviderConfig {
  apiKey?: string
  baseUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
}

/**
 * Metadata about what a provider can do.
 */
export interface AIProviderCapabilities {
  readonly hasVision: boolean
  readonly supportsStreaming: boolean
  readonly isLocal: boolean
  readonly supportsCustomUrl: boolean
}

/**
 * Interface that all AI service providers must implement.
 */
export interface AIProvider {
  /**
   * Unique machine-readable identifier (e.g. 'deepseek', 'claude').
   */
  readonly id: string

  /**
   * Human-readable display name (e.g. 'DeepSeek', 'Anthropic Claude').
   */
  readonly name: string

  /**
   * List of supported model IDs for this provider.
   */
  readonly supportedModels: string[]

  /**
   * The capabilities of this specific provider.
   */
  readonly capabilities: AIProviderCapabilities

  /**
   * Sends a full array of messages and waits for a complete response.
   */
  sendMessage(messages: AIMessage[], config: AIProviderConfig): Promise<string>

  /**
   * Async generator for streaming response tokens.
   */
  streamResponse(messages: AIMessage[], config: AIProviderConfig): AsyncGenerator<string>

  /**
   * Validates the provided configuration (e.g. pings API or checks key format).
   */
  validateConfig(config: AIProviderConfig): Promise<boolean>
}
