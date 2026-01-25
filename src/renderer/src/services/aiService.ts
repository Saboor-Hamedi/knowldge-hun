// import { state } from '../core/state'
import { ragService } from './rag/ragService'
import type { TreeItem } from '../core/types'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  feedback?: 'thumbs-up' | 'thumbs-down' | null
  messageId?: string // Unique ID for tracking
  citations?: NoteCitation[] // Notes used in this response
}

export interface EditorContext {
  getEditorContent: () => string | null
  getActiveNoteInfo: () => { title: string; id: string } | null
}

export interface VaultNote {
  id: string
  title: string
  content: string
  path?: string
}

interface NoteMetadata {
  id: string
  title: string
  path?: string
}

interface ScoredNote extends VaultNote {
  score: number
  relevanceSnippets?: string[]
}

export interface NoteCitation {
  id: string
  title: string
  path?: string
}

export type ChatMode = 'balanced' | 'thinking' | 'creative' | 'precise' | 'code'

export interface ChatModeConfig {
  id: ChatMode
  label: string
  icon: string
  description: string
  temperature: number
  systemPrompt?: string
}

export const CHAT_MODES: ChatModeConfig[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    icon: '⚖️',
    description: 'General purpose responses',
    temperature: 0.7,
    systemPrompt:
      'You are a helpful AI assistant. Be conversational and natural. When the user says things like "okay", "fine", "thanks", or "got it", respond briefly without re-explaining. If the user says "stop", "don\'t explain", or "just help", IMMEDIATELY stop explaining and only do what they ask - no context, no background, just the direct help they need. Match the user\'s tone and energy level.'
  },
  {
    id: 'thinking',
    label: 'Thinking',
    icon: '🧠',
    description: 'Deep reasoning and analysis',
    temperature: 0.3,
    systemPrompt:
      'Think step by step. Break down complex problems into smaller parts. Show your reasoning process clearly before giving the final answer.'
  },
  {
    id: 'creative',
    label: 'Creative',
    icon: '✨',
    description: 'More imaginative responses',
    temperature: 0.9,
    systemPrompt:
      'Be creative and imaginative. Think outside the box. Offer unique perspectives and novel ideas.'
  },
  {
    id: 'precise',
    label: 'Precise',
    icon: '🎯',
    description: 'Factual and concise',
    temperature: 0.2,
    systemPrompt:
      'Be extremely concise. Answer in 1-2 sentences when possible. No elaboration unless asked. Direct answers only. If the user acknowledges with "okay" or "fine", just say "👍" or similar.'
  },
  {
    id: 'code',
    label: 'Code',
    icon: '💻',
    description: 'Optimized for coding tasks',
    temperature: 0.4,
    systemPrompt:
      'You are a coding expert. Provide clean, well-documented code. Explain technical concepts clearly. Follow best practices and modern conventions.'
  }
]

export class AIService {
  private apiKey: string | null = null
  private editorContext?: EditorContext
  private vaultCache: Map<string, VaultNote> = new Map()
  private vaultMetadataCache: Map<string, NoteMetadata> = new Map()
  private vaultCacheTime: number = 0
  private readonly CACHE_DURATION = 120000 // 2 minutes cache
  private readonly MAX_CONTEXT_TOKENS = 8000 // Approximate token limit
  private readonly MAX_NOTES_TO_LOAD = 30 // Limit notes loaded at once (reduced for performance)
  private readonly MAX_CONTENT_LENGTH = 1500 // Max chars per note in context (reduced for performance)
  private currentMode: ChatMode = 'balanced'

  constructor() {
    // Load persisted mode from localStorage
    const savedMode = localStorage.getItem('ai-chat-mode') as ChatMode | null
    if (savedMode && CHAT_MODES.some((m) => m.id === savedMode)) {
      this.currentMode = savedMode
    }
  }

  setMode(mode: ChatMode): void {
    this.currentMode = mode
    // Persist mode to localStorage
    localStorage.setItem('ai-chat-mode', mode)
  }

  getMode(): ChatMode {
    return this.currentMode
  }

  getModeConfig(): ChatModeConfig {
    return CHAT_MODES.find((m) => m.id === this.currentMode) || CHAT_MODES[0]
  }

  async loadApiKey(): Promise<void> {
    try {
      const settings = (await window.api.getSettings()) as { deepseekApiKey?: string }
      this.apiKey = settings.deepseekApiKey || null
      // Initialize RAG
      this.initRag()
    } catch (err) {
      console.error('[AIService] Failed to load API key:', err)
    }
  }

  private async initRag(): Promise<void> {
    try {
      console.log('[AIService] Initializing RAG service...')
      await ragService.configureProvider('local')
      await ragService.init()
      console.log('[AIService] RAG service initialized successfully')
    } catch (err) {
      console.warn('[AIService] Failed to init RAG, falling back to TF-IDF:', err)
    }
  }

  setEditorContext(context: EditorContext): void {
    this.editorContext = context
  }

  getApiKey(): string | null {
    return this.apiKey
  }

  /**
   * Load note metadata only (lightweight, fast)
   */
  private async loadVaultMetadata(): Promise<NoteMetadata[]> {
    const now = Date.now()

    // Return cached metadata if still valid
    if (this.vaultMetadataCache.size > 0 && now - this.vaultCacheTime < this.CACHE_DURATION) {
      return Array.from(this.vaultMetadataCache.values())
    }

    try {
      const notesTree = await window.api.listNotes()
      const metadata: NoteMetadata[] = []

      const flattenNotes = (items: TreeItem[], parentPath?: string): void => {
        for (const item of items) {
          if (item.type === 'note') {
            metadata.push({
              id: item.id,
              title: item.title,
              path: item.path || parentPath
            })
          } else if (item.type === 'folder' && item.children) {
            flattenNotes(item.children, item.path || parentPath)
          }
        }
      }

      flattenNotes(notesTree as TreeItem[])

      // Update metadata cache
      this.vaultMetadataCache.clear()
      metadata.forEach((meta) => {
        this.vaultMetadataCache.set(meta.id, meta)
      })
      this.vaultCacheTime = now

      return metadata
    } catch (error) {
      console.error('[AIService] Failed to load vault metadata:', error)
      return Array.from(this.vaultMetadataCache.values())
    }
  }

  /**
   * Load note content on-demand (lazy loading)
   */
  private async loadNoteContent(noteId: string, path?: string): Promise<string> {
    // Check cache first
    const cached = this.vaultCache.get(noteId)
    if (cached) {
      return cached.content
    }

    try {
      const noteData = await window.api.loadNote(noteId, path)
      const content = noteData?.content || ''

      // Cache it
      const metadata = this.vaultMetadataCache.get(noteId)
      if (metadata) {
        this.vaultCache.set(noteId, {
          id: noteId,
          title: metadata.title,
          content,
          path: metadata.path
        })
      }

      return content
    } catch (error) {
      console.warn(`[AIService] Failed to load note ${noteId}:`, error)
      return ''
    }
  }

  /**
   * Extract keywords and expand query
   */
  private extractQueryTerms(query: string): string[] {
    const lowerQuery = query.toLowerCase()
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'what',
      'which',
      'who',
      'where',
      'when',
      'why',
      'how'
    ])
    const words = lowerQuery.split(/[\s\W]+/).filter((w) => w.length >= 3 && !stopWords.has(w))
    return Array.from(new Set(words))
  }

  /**
   * Calculate TF-IDF score for better relevance
   */
  private calculateRelevanceScore(
    queryTerms: string[],
    noteTitle: string,
    noteContent: string,
    allNotes: NoteMetadata[]
  ): number {
    const lowerTitle = noteTitle.toLowerCase()
    const lowerContent = noteContent.toLowerCase()
    let score = 0

    queryTerms.forEach((term) => {
      if (lowerTitle.includes(term)) {
        score += 20
      }
      if (lowerTitle.includes(queryTerms.join(' '))) {
        score += 30
      }
    })

    queryTerms.forEach((term) => {
      const titleMatches = (lowerTitle.match(new RegExp(term, 'g')) || []).length
      const contentMatches = (lowerContent.match(new RegExp(term, 'g')) || []).length
      const termFrequency = titleMatches * 3 + contentMatches
      const documentFrequency = allNotes.filter((n) => n.title.toLowerCase().includes(term)).length
      const idf = documentFrequency > 0 ? Math.log(allNotes.length / documentFrequency) : 1
      score += termFrequency * idf
    })

    const matchedTerms = queryTerms.filter(
      (term) => lowerTitle.includes(term) || lowerContent.includes(term)
    ).length
    score += matchedTerms * 5

    return score
  }

  /**
   * Extract relevant snippets from note content
   */
  private extractRelevantSnippets(
    content: string,
    queryTerms: string[],
    maxLength: number = 300
  ): string[] {
    const sentences = content.split(/[.!?]\s+/)

    const scoredSentences = sentences.map((sentence) => {
      const lowerSentence = sentence.toLowerCase()
      let score = 0
      queryTerms.forEach((term) => {
        if (lowerSentence.includes(term)) {
          score += (lowerSentence.match(new RegExp(term, 'g')) || []).length
        }
      })
      return { sentence, score }
    })

    const topSentences = scoredSentences
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.sentence)

    if (topSentences.length > 0) {
      const combined = topSentences.join('. ')
      return [combined.length > maxLength ? combined.substring(0, maxLength) + '...' : combined]
    }

    return [content.substring(0, maxLength) + '...']
  }

  /**
   * Find relevant notes with smart scoring (lazy loading) - NEW VERSION
   */
  private async findRelevantNotes(userMessage: string, limit: number = 5): Promise<ScoredNote[]> {
    try {
      const allMetadata = await this.loadVaultMetadata()
      if (allMetadata.length === 0) return []

      const queryTerms = this.extractQueryTerms(userMessage)
      if (queryTerms.length === 0) return []

      const scoredMetadata = await Promise.all(
        allMetadata.map(async (meta) => {
          const lowerTitle = meta.title.toLowerCase()
          let quickScore = 0
          queryTerms.forEach((term) => {
            if (lowerTitle.includes(term)) quickScore += 10
          })
          return { meta, quickScore }
        })
      )

      const topCandidates = scoredMetadata
        .filter((item) => item.quickScore > 0)
        .sort((a, b) => b.quickScore - a.quickScore)
        .slice(0, Math.min(limit * 3, this.MAX_NOTES_TO_LOAD))
        .map((item) => item.meta)

      const scoredNotes: ScoredNote[] = []

      for (const meta of topCandidates) {
        try {
          const content = await this.loadNoteContent(meta.id, meta.path)
          if (content.length === 0) continue

          const score = this.calculateRelevanceScore(queryTerms, meta.title, content, allMetadata)
          if (score > 0) {
            const snippets = this.extractRelevantSnippets(content, queryTerms)
            scoredNotes.push({
              id: meta.id,
              title: meta.title,
              content,
              path: meta.path,
              score,
              relevanceSnippets: snippets
            })
          }
        } catch (error) {
          console.warn(`[AIService] Failed to score note ${meta.id}:`, error)
        }
      }

      return scoredNotes.sort((a, b) => b.score - a.score).slice(0, limit)
    } catch (error) {
      console.error('[AIService] Failed to find relevant notes:', error)
      return []
    }
  }

  /**
   * Hybrid search: Try RAG first, fall back to TF-IDF
   */
  private async findRelevantNotesHybrid(
    userMessage: string,
    limit: number = 5
  ): Promise<ScoredNote[]> {
    try {
      // 1. Try Vector RAG
      const ragResults = await ragService.search(userMessage, limit)

      if (ragResults && ragResults.length > 0) {
        // Hydrate results with content
        const scoredNotes: ScoredNote[] = []
        for (const res of ragResults) {
          try {
            const content = await this.loadNoteContent(res.id, res.metadata?.path)
            if (content) {
              scoredNotes.push({
                id: res.id,
                title: res.metadata?.title || 'Unknown Note',
                content,
                path: res.metadata?.path,
                score: res.score * 100 // Scale cosine (0-1) to be comparable roughly
              })
            }
          } catch {
            // Ignore load error
          }
        }

        if (scoredNotes.length > 0) {
          console.log(`[AIService] Using ${scoredNotes.length} RAG results`)
          return scoredNotes
        }
      }
    } catch (err) {
      console.warn('[AIService] RAG search failed, falling back to TF-IDF:', err)
    }

    // 2. Fallback to TF-IDF
    console.log('[AIService] Using TF-IDF fallback')
    return this.findRelevantNotes(userMessage, limit)
  }

  /**
   * Find relevant notes based on user message (OLD VERSION - kept for compatibility)
   */
  /**
   * Build context message with smart RAG (lightweight and robust)
   * Returns both the context string and citations of notes used
   */
  async buildContextMessage(
    userMessage: string
  ): Promise<{ context: string; citations: NoteCitation[] }> {
    // FIRST: Check if user is telling us to stop explaining or just wants direct help
    const stopPhrases =
      /\b(stop|don't explain|dont explain|just help|just fix|no explanation|skip the|enough|stop explaining|stop it|please stop)\b/i
    const isStopCommand = stopPhrases.test(userMessage)

    // Check if this is just an acknowledgment
    const isAcknowledgment =
      /^(okay|ok|fine|thanks|got it|alright|cool|nice|good|sure|yep|yeah|yes)\b/i.test(
        userMessage.trim()
      )

    if (isStopCommand || isAcknowledgment) {
      // User wants us to stop - send ONLY their message, no context at all
      return { context: userMessage, citations: [] }
    }

    let context =
      "You are an AI assistant helping with a note-taking application. You have FULL ACCESS to the user's entire vault of notes. You can read, analyze, and reference any note in the vault.\n\n"
    const citations: NoteCitation[] = []

    // Get current note context (but keep it minimal)
    if (this.editorContext) {
      const noteInfo = this.editorContext.getActiveNoteInfo?.()
      const editorContent = this.editorContext.getEditorContent?.()

      if (noteInfo) {
        context += `Current note: "${noteInfo.title}"\n`
        citations.push({ id: noteInfo.id, title: noteInfo.title })
      }

      // Only include content if user is asking about it specifically
      const askingAboutContent =
        /\b(this note|current note|this code|this file|what does|explain this|in this)\b/i.test(
          userMessage
        )
      if (editorContent && editorContent.trim() && askingAboutContent) {
        const contentPreview =
          editorContent.length > 800 ? editorContent.substring(0, 800) + '...' : editorContent
        context += `\nNote content:\n${contentPreview}\n\n`
      }
    }

    // Smart vault access with lazy loading
    try {
      const metadata = await this.loadVaultMetadata()
      const vaultSize = metadata.length

      if (vaultSize === 0) {
        context += `\nNote: The vault appears to be empty.\n`
      } else {
        // Only mention vault access if it seems relevant
        const lowerMessage = userMessage.toLowerCase()

        // Check if this is just an acknowledgment (user saying "okay", "fine", etc.)
        const isAcknowledgment =
          /^(okay|ok|fine|thanks|got it|alright|cool|nice|good|sure|yep|yeah|yes)\b/i.test(
            userMessage.trim()
          )

        if (isAcknowledgment) {
          // Don't add vault context for simple acknowledgments
          return { context: userMessage, citations }
        }

        context += `\nVault: ${vaultSize} notes available.\n`

        // Check if user is asking about vault overview
        const isVaultQuery =
          lowerMessage.includes('vault') ||
          lowerMessage.includes('all notes') ||
          lowerMessage.includes('my notes') ||
          lowerMessage.includes('list') ||
          lowerMessage.includes('show me')

        if (isVaultQuery) {
          // Show vault overview (metadata only, lightweight)
          // Don't add vault overview notes to citations - they're just context, not specific references
          const notesToShow = metadata.slice(0, 15)
          context += `\nVault overview (${notesToShow.length} of ${vaultSize} notes):\n`
          notesToShow.forEach((note, index) => {
            const path = note.path ? ` [${note.path}]` : ''
            context += `${index + 1}. "${note.title}"${path}\n`
          })

          if (vaultSize > notesToShow.length) {
            context += `\n... and ${vaultSize - notesToShow.length} more notes.\n`
          }
        } else {
          // Find and load only relevant notes (smart RAG)
          const relevantNotes = await this.findRelevantNotesHybrid(userMessage, 5)

          if (relevantNotes.length > 0) {
            context += `\nRelevant notes from vault (${relevantNotes.length} most relevant):\n`

            let totalLength = 0
            for (const note of relevantNotes) {
              // Use snippets if available, otherwise truncate
              const contentToShow =
                note.relevanceSnippets && note.relevanceSnippets.length > 0
                  ? note.relevanceSnippets.join(' ')
                  : note.content.length > this.MAX_CONTENT_LENGTH
                    ? note.content.substring(0, this.MAX_CONTENT_LENGTH) + '...'
                    : note.content

              const path = note.path ? ` [${note.path}]` : ''
              const noteContext = `\n"${note.title}"${path}:\n${contentToShow}\n`

              // Estimate tokens (rough: 1 token ≈ 4 chars)
              const estimatedTokens = noteContext.length / 4

              // Don't exceed context window
              if (totalLength + estimatedTokens > this.MAX_CONTEXT_TOKENS * 0.6) {
                context += `\n... and ${relevantNotes.length - relevantNotes.indexOf(note)} more relevant notes.\n`
                break
              }

              context += noteContext
              totalLength += estimatedTokens

              // Add to citations
              if (!citations.find((c) => c.id === note.id)) {
                citations.push({ id: note.id, title: note.title, path: note.path })
              }
            }
          } else {
            // No relevant matches found - don't add fallback notes to citations
            // Only provide context hint to AI without showing irrelevant citations to user
            context += `\nNo notes found matching your query. The vault contains ${vaultSize} notes that you can ask about.\n`
          }
        }

        context += `\nYou can reference any note by its title. When the user asks about their vault or notes, you have full context.\n`
      }
    } catch (error) {
      console.error('[AIService] Failed to load vault for context:', error)
      context +=
        '\nNote: Unable to load vault at this time. You can still help with the current note.\n'
    }

    context += `\n\n=== USER QUESTION ===\n${userMessage}`

    return { context, citations }
  }

  async callDeepSeekAPI(
    messages: ChatMessage[],
    contextMessage: string | { context: string; citations: NoteCitation[] }
  ): Promise<string> {
    // Handle both old string format and new object format for backward compatibility
    const context = typeof contextMessage === 'string' ? contextMessage : contextMessage.context
    if (!this.apiKey) {
      throw new Error('API key not configured')
    }

    const modeConfig = this.getModeConfig()

    try {
      // Build messages array with optional system prompt for mode
      const messagesForAPI: Array<{ role: string; content: string }> = []

      // Add system prompt if mode has one
      if (modeConfig.systemPrompt) {
        messagesForAPI.push({ role: 'system', content: modeConfig.systemPrompt })
      }

      // Detect if user is saying stop/don't explain
      const stopPhrases =
        /\b(stop|don't explain|dont explain|just help|just fix|no explanation|skip the|enough|stop explaining|stop it|please stop)\b/i
      const isStopCommand = stopPhrases.test(context)

      // If it's a stop command, only include the last 2 messages to avoid re-explaining
      // Otherwise include full history
      const historyToInclude = isStopCommand
        ? messages.slice(-3, -1) // Only last 2 messages (excluding current)
        : messages.slice(0, -1) // All history (excluding current)

      // Add conversation history
      messagesForAPI.push(...historyToInclude.map((m) => ({ role: m.role, content: m.content })))

      // Add the context-enhanced user message
      messagesForAPI.push({ role: 'user', content: context })

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messagesForAPI,
          temperature: modeConfig.temperature,
          max_tokens: 2000
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || 'No response'
    } catch (err: unknown) {
      const error = err as Error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(
          'Network error: Unable to connect to DeepSeek API. Please check your internet connection.'
        )
      }
      throw error
    }
  }

  /**
   * Call DeepSeek API with streaming support
   * @param messages - Chat messages array
   * @param contextMessage - Context-aware user message
   * @param onChunk - Callback for each chunk received
   * @param signal - Optional AbortSignal for cancellation
   * @returns Full response text
   */
  async callDeepSeekAPIStream(
    messages: ChatMessage[],
    contextMessage: string | { context: string; citations: NoteCitation[] },
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    // Handle both old string format and new object format for backward compatibility
    const context = typeof contextMessage === 'string' ? contextMessage : contextMessage.context

    if (!this.apiKey) {
      throw new Error('API key not configured')
    }

    const modeConfig = this.getModeConfig()

    try {
      // Build messages array with optional system prompt for mode
      const messagesForAPI: Array<{ role: string; content: string }> = []

      // Add system prompt if mode has one
      if (modeConfig.systemPrompt) {
        messagesForAPI.push({ role: 'system', content: modeConfig.systemPrompt })
      }

      // Add conversation history (exclude the last user message)
      messagesForAPI.push(
        ...messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }))
      )

      // Add the context-enhanced user message
      messagesForAPI.push({ role: 'user', content: context })

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messagesForAPI,
          temperature: modeConfig.temperature,
          max_tokens: 2000,
          stream: true
        }),
        signal // Pass the abort signal
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || `API error: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              const delta = json.choices?.[0]?.delta?.content
              if (delta) {
                fullText += delta
                onChunk(delta)
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6)
        if (data !== '[DONE]') {
          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta?.content
            if (delta) {
              fullText += delta
              onChunk(delta)
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      return fullText
    } catch (err: unknown) {
      const error = err as Error
      if (error.name === 'AbortError') {
        // User cancelled the request - this is expected, not an error
        return ''
      }
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(
          'Network error: Unable to connect to DeepSeek API. Please check your internet connection.'
        )
      }
      throw error
    }
  }
}

export const aiService = new AIService()
