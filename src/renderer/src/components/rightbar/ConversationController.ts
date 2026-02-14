import { aiService, type ChatMessage } from '../../services/aiService'
import { state } from '../../core/state'
import { agentService } from '../../services/agent/agent-service'

export interface ConversationState {
  messages: ChatMessage[]
  isLoading: boolean
  isExecutingCommand: boolean
  streamingMessageIndex: number | null
  messageFeedback: Map<number, 'thumbs-up' | 'thumbs-down'>
  lastFailedMessage: string | null
}

export interface ConversationControllerUI {
  onStateChange: (state: ConversationState) => void
  onMessageAdded: () => void
  onNewSessionRequired: () => Promise<void>
  onAutoSaveRequired: () => Promise<void>
  onMenuItemsUpdateRequired: () => void
}

export class ConversationController {
  private state: ConversationState = {
    messages: [],
    isLoading: false,
    isExecutingCommand: false,
    streamingMessageIndex: null,
    messageFeedback: new Map(),
    lastFailedMessage: null
  }

  private abortController: AbortController | null = null
  private ui: ConversationControllerUI

  constructor(ui: ConversationControllerUI) {
    this.ui = ui
  }

  public getState(): ConversationState {
    return { ...this.state }
  }

  public setMessages(messages: ChatMessage[]): void {
    this.state.messages = [...messages]
    this.notify()
  }

  public setFeedback(feedback: Map<number, 'thumbs-up' | 'thumbs-down'>): void {
    this.state.messageFeedback = new Map(feedback)
    this.notify()
  }

  public clearFeedback(): void {
    this.state.messageFeedback.clear()
    this.notify()
  }

  private currentActionId: number = 0

  public stopGeneration(): void {
    this.currentActionId++ // Invalidate any pending async actions
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.state.isLoading = false
    this.state.isExecutingCommand = false
    this.state.streamingMessageIndex = null
    this.notify()
  }

  public async sendMessage(text: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed) return

    // Add user message
    this.addMessage('user', trimmed)
    await this.doSend(trimmed)
  }

  public async regenerateMessage(messageIndex: number): Promise<void> {
    const message = this.state.messages[messageIndex]
    if (!message || message.role !== 'assistant') return

    // Find the user message that prompted this response
    let userMessageIndex = messageIndex - 1
    while (userMessageIndex >= 0 && this.state.messages[userMessageIndex].role !== 'user') {
      userMessageIndex--
    }

    if (userMessageIndex < 0) return

    const userMessage = this.state.messages[userMessageIndex].content

    // Remove the assistant message and all subsequent messages
    this.state.messages = this.state.messages.slice(0, messageIndex)
    this.state.messageFeedback.delete(messageIndex)

    this.notify()
    this.ui.onMenuItemsUpdateRequired()

    await this.doSend(userMessage, true)
  }

  public async doSend(
    message: string,
    skipAddingUserMessage: boolean = false,
    role: 'user' | 'assistant' | 'system' = 'user'
  ): Promise<void> {
    const actionId = ++this.currentActionId
    await this.ui.onNewSessionRequired()

    if (!skipAddingUserMessage && role !== 'user') {
      this.addMessage(role, message)
    }

    this.state.isLoading = true
    this.state.lastFailedMessage = null
    this.notify()

    this.abortController = new AbortController()

    const apiKey = aiService.getApiKey()
    const currentProvider = state.settings?.aiProvider || 'deepseek'
    const isLocal = currentProvider === 'ollama'

    if (!apiKey && !isLocal) {
      this.state.isLoading = false
      this.notify()

      const providerName = currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1)
      const setupLink =
        {
          openai: 'https://platform.openai.com',
          claude: 'https://console.anthropic.com',
          deepseek: 'https://platform.deepseek.com',
          grok: 'https://console.x.ai'
        }[currentProvider] || '#'

      this.addMessage(
        'assistant',
        `🔑 **${providerName} API Key Required**\n\nPlease add your ${providerName} API key in **Settings → AI**. \n\nYou can get your key at [${setupLink}](${setupLink})`
      )
      return
    }

    try {
      let contextMessage = message
      let citations: { id: string; title: string }[] = []

      if (role === 'user') {
        const contextObj = await aiService.buildContextMessage(message)
        contextMessage = contextObj.context
        citations = contextObj.citations
      }

      // Check if cancelled during context build
      if (actionId !== this.currentActionId) return

      const insertIndex = this.state.messages.length
      this.state.messages.push({
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        messageId: `msg_${Date.now()}_${Math.random()}`,
        citations: citations.length > 0 ? citations : undefined
      })
      this.state.streamingMessageIndex = insertIndex
      this.notify()

      const messagesForAPI = this.state.messages.slice(0, insertIndex)
      let lastRenderTime = 0
      let currentThrottle = 100

      const fullResponse = await aiService.callDeepSeekAPIStream(
        messagesForAPI,
        { context: contextMessage, citations },
        (chunk: string) => {
          if (actionId !== this.currentActionId) return

          if (
            this.state.streamingMessageIndex !== null &&
            this.state.messages[this.state.streamingMessageIndex]
          ) {
            const msg = this.state.messages[this.state.streamingMessageIndex]
            msg.content += chunk

            // Dynamic throttle: if output is getting very long, slow down rendering to keep UI responsive
            const contentLength = msg.content.length
            if (contentLength > 10000) currentThrottle = 250
            if (contentLength > 30000) currentThrottle = 400

            const now = Date.now()
            if (now - lastRenderTime >= currentThrottle) {
              lastRenderTime = now
              this.notify()
            }
          }
        },
        this.abortController.signal
      )

      if (actionId !== this.currentActionId) return

      if (this.state.streamingMessageIndex !== null) {
        this.state.messages[this.state.streamingMessageIndex].content = fullResponse
      }

      this.state.streamingMessageIndex = null
      this.state.isLoading = false
      this.abortController = null
      this.notify()

      await this.ui.onAutoSaveRequired()

      if (fullResponse.includes('[RUN:')) {
        await this.handleAgenticCommands(fullResponse, actionId)
      }
    } catch (err: unknown) {
      if (actionId !== this.currentActionId) return

      this.state.isLoading = false
      this.abortController = null

      const error = err as Error
      if (error.name === 'AbortError' || error.message === 'Request cancelled') {
        this.notify()
        return
      }

      this.state.lastFailedMessage = message
      this.addMessage(
        'assistant',
        `❌ **Error**\n\n${error.message || 'Failed to get response'}\n\nPlease check your API key and connection.`
      )
      this.notify()
    }
  }

  private async handleAgenticCommands(content: string, actionId: number): Promise<void> {
    this.state.isExecutingCommand = true
    this.notify()

    const results = await agentService.processResponse(
      content,
      () => {
        if (actionId === this.currentActionId) {
          this.notify()
        }
      },
      this.abortController?.signal || undefined
    )

    if (actionId !== this.currentActionId || this.abortController?.signal.aborted) {
      this.state.isExecutingCommand = false
      this.notify()
      return
    }

    this.state.isExecutingCommand = false

    if (results.length > 0) {
      const resultsMessage = results.join('\n\n')
      // Delay slightly before responding to user with tool results
      setTimeout(() => {
        if (actionId === this.currentActionId) {
          void this.doSend(resultsMessage, false, 'system')
        }
      }, 50)
    } else {
      this.notify()
    }
  }

  public addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    this.state.messages.push({
      role,
      content,
      timestamp: Date.now(),
      messageId: `msg_${Date.now()}_${Math.random()}`
    })
    this.notify()
    this.ui.onMessageAdded()
  }

  private notify(): void {
    this.ui.onStateChange({ ...this.state })
  }
}
