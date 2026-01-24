// import { state } from '../core/state'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
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

export class AIService {
  private apiKey: string | null = null
  private editorContext?: EditorContext
  private vaultCache: Map<string, VaultNote> = new Map()
  private vaultMetadataCache: Map<string, NoteMetadata> = new Map()
  private vaultCacheTime: number = 0
  private readonly CACHE_DURATION = 120000 // 2 minutes cache
  private readonly MAX_CONTEXT_TOKENS = 8000 // Approximate token limit
  private readonly MAX_NOTES_TO_LOAD = 50 // Limit notes loaded at once
  private readonly MAX_CONTENT_LENGTH = 2000 // Max chars per note in context

  async loadApiKey(): Promise<void> {
    try {
      const settings = await window.api.getSettings()
      this.apiKey = (settings as any)?.deepseekApiKey || null
    } catch (err) {
      console.error('[AIService] Failed to load API key:', err)
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
    if (this.vaultMetadataCache.size > 0 && (now - this.vaultCacheTime) < this.CACHE_DURATION) {
      return Array.from(this.vaultMetadataCache.values())
    }

    try {
      const notesTree = await window.api.listNotes()
      const metadata: NoteMetadata[] = []

      const flattenNotes = (items: any[], parentPath?: string): void => {
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

      flattenNotes(notesTree)

      // Update metadata cache
      this.vaultMetadataCache.clear()
      metadata.forEach(meta => {
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
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'where', 'when', 'why', 'how'])
    const words = lowerQuery.split(/[\s\W]+/).filter(w => w.length >= 3 && !stopWords.has(w))
    return Array.from(new Set(words))
  }

  /**
   * Calculate TF-IDF score for better relevance
   */
  private calculateRelevanceScore(queryTerms: string[], noteTitle: string, noteContent: string, allNotes: NoteMetadata[]): number {
    const lowerTitle = noteTitle.toLowerCase()
    const lowerContent = noteContent.toLowerCase()
    let score = 0

    queryTerms.forEach(term => {
      if (lowerTitle.includes(term)) {
        score += 20
      }
      if (lowerTitle.includes(queryTerms.join(' '))) {
        score += 30
      }
    })

    queryTerms.forEach(term => {
      const titleMatches = (lowerTitle.match(new RegExp(term, 'g')) || []).length
      const contentMatches = (lowerContent.match(new RegExp(term, 'g')) || []).length
      const termFrequency = titleMatches * 3 + contentMatches
      const documentFrequency = allNotes.filter(n => n.title.toLowerCase().includes(term)).length
      const idf = documentFrequency > 0 ? Math.log(allNotes.length / documentFrequency) : 1
      score += termFrequency * idf
    })

    const matchedTerms = queryTerms.filter(term => lowerTitle.includes(term) || lowerContent.includes(term)).length
    score += matchedTerms * 5

    return score
  }

  /**
   * Extract relevant snippets from note content
   */
  private extractRelevantSnippets(content: string, queryTerms: string[], maxLength: number = 300): string[] {
    const lowerContent = content.toLowerCase()
    const sentences = content.split(/[.!?]\s+/)

    const scoredSentences = sentences.map(sentence => {
      const lowerSentence = sentence.toLowerCase()
      let score = 0
      queryTerms.forEach(term => {
        if (lowerSentence.includes(term)) {
          score += (lowerSentence.match(new RegExp(term, 'g')) || []).length
        }
      })
      return { sentence, score }
    })

    const topSentences = scoredSentences.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(s => s.sentence)

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
          queryTerms.forEach(term => {
            if (lowerTitle.includes(term)) quickScore += 10
          })
          return { meta, quickScore }
        })
      )

      const topCandidates = scoredMetadata
        .filter(item => item.quickScore > 0)
        .sort((a, b) => b.quickScore - a.quickScore)
        .slice(0, Math.min(limit * 3, this.MAX_NOTES_TO_LOAD))
        .map(item => item.meta)

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
   * Find relevant notes based on user message (OLD VERSION - kept for compatibility)
   */
  /**
   * Build context message with smart RAG (lightweight and robust)
   */
  async buildContextMessage(userMessage: string): Promise<string> {
    let context = 'You are an AI assistant helping with a note-taking application. You have FULL ACCESS to the user\'s entire vault of notes. You can read, analyze, and reference any note in the vault.\n\n'

    // Get current note context
    if (this.editorContext) {
      const noteInfo = this.editorContext.getActiveNoteInfo?.()
      const editorContent = this.editorContext.getEditorContent?.()

      if (noteInfo) {
        context += `Current note: "${noteInfo.title}" (ID: ${noteInfo.id})\n`
      }

      if (editorContent && editorContent.trim()) {
        const contentPreview = editorContent.length > 1500
          ? editorContent.substring(0, 1500) + '...'
          : editorContent
        context += `\nCurrent note content:\n${contentPreview}\n\n`
      }
    }

    // Smart vault access with lazy loading
    try {
      const metadata = await this.loadVaultMetadata()
      const vaultSize = metadata.length

      if (vaultSize === 0) {
        context += `\nNote: The vault appears to be empty.\n`
      } else {
        context += `\n=== VAULT ACCESS ===\nYou have access to ${vaultSize} notes in the vault.\n`

        // Check if user is asking about vault overview
        const lowerMessage = userMessage.toLowerCase()
        const isVaultQuery = lowerMessage.includes('vault') ||
                            lowerMessage.includes('all notes') ||
                            lowerMessage.includes('my notes') ||
                            lowerMessage.includes('list') ||
                            lowerMessage.includes('show me')

        if (isVaultQuery) {
          // Show vault overview (metadata only, lightweight)
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
          const relevantNotes = await this.findRelevantNotes(userMessage, 5)

          if (relevantNotes.length > 0) {
            context += `\nRelevant notes from vault (${relevantNotes.length} most relevant):\n`

            let totalLength = 0
            for (const note of relevantNotes) {
              // Use snippets if available, otherwise truncate
              const contentToShow = note.relevanceSnippets && note.relevanceSnippets.length > 0
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
            }
          } else {
            // No relevant matches, show a few recent notes
            const recentNotes = metadata.slice(0, 3)
            context += `\nRecent notes (no specific matches found):\n`
            for (const meta of recentNotes) {
              const content = await this.loadNoteContent(meta.id, meta.path)
              if (content) {
                const preview = content.length > 200 ? content.substring(0, 200) + '...' : content
                const path = meta.path ? ` [${meta.path}]` : ''
                context += `\n"${meta.title}"${path}:\n${preview}\n`
              }
            }
          }
        }

        context += `\nYou can reference any note by its title. When the user asks about their vault or notes, you have full context.\n`
      }
    } catch (error) {
      console.error('[AIService] Failed to load vault for context:', error)
      context += '\nNote: Unable to load vault at this time. You can still help with the current note.\n'
    }

    context += `\n\n=== USER QUESTION ===\n${userMessage}`

    return context
  }

  async callDeepSeekAPI(messages: ChatMessage[], contextMessage: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key not configured')
    }

    try {
      // Build messages array - exclude the last user message, use the context-aware one
      const messagesForAPI = messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
      messagesForAPI.push({ role: 'user', content: contextMessage })

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messagesForAPI,
          temperature: 0.7,
          max_tokens: 2000
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || 'No response'
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to DeepSeek API. Please check your internet connection.')
      }
      throw err
    }
  }
}

export const aiService = new AIService()
