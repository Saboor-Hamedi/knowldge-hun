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

export class AIService {
  private apiKey: string | null = null
  private editorContext?: EditorContext
  private vaultCache: Map<string, VaultNote> = new Map()
  private vaultCacheTime: number = 0
  private readonly CACHE_DURATION = 60000 // 1 minute cache

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
   * Load all notes from vault (with caching)
   */
  private async loadVaultNotes(): Promise<VaultNote[]> {
    const now = Date.now()
    
    // Return cached if still valid
    if (this.vaultCache.size > 0 && (now - this.vaultCacheTime) < this.CACHE_DURATION) {
      return Array.from(this.vaultCache.values())
    }

    try {
      // Get all notes (recursively flatten the tree)
      const notesTree = await window.api.listNotes()
      const allNotes: Array<{ id: string; title: string; path?: string }> = []
      
      const flattenNotes = (items: any[], parentPath?: string) => {
        for (const item of items) {
          if (item.type === 'note') {
            allNotes.push({
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
      
      if (allNotes.length === 0) {
        return []
      }

      const vaultNotes: VaultNote[] = []

      // Load content for each note (in batches to avoid overwhelming)
      const batchSize = 10
      for (let i = 0; i < allNotes.length; i += batchSize) {
        const batch = allNotes.slice(i, i + batchSize)
        const loadedNotes = await Promise.all(
          batch.map(async (note) => {
            try {
              const noteData = await window.api.loadNote(note.id, note.path)
              return {
                id: note.id,
                title: note.title,
                content: noteData?.content || '',
                path: note.path
              }
            } catch (error) {
              console.warn(`[AIService] Failed to load note ${note.id}:`, error)
              return {
                id: note.id,
                title: note.title,
                content: '',
                path: note.path
              }
            }
          })
        )
        vaultNotes.push(...loadedNotes.filter(n => n.content.length > 0))
      }

      // Update cache
      this.vaultCache.clear()
      vaultNotes.forEach(note => {
        this.vaultCache.set(note.id, note)
      })
      this.vaultCacheTime = now

      return vaultNotes
    } catch (error) {
      console.error('[AIService] Failed to load vault notes:', error)
      return Array.from(this.vaultCache.values()) // Return cached if available
    }
  }

  /**
   * Find relevant notes based on user message
   */
  private findRelevantNotes(userMessage: string, allNotes: VaultNote[]): VaultNote[] {
    const lowerMessage = userMessage.toLowerCase()
    const words = lowerMessage.split(/\s+/).filter(w => w.length > 2)
    
    // Score notes based on keyword matches
    const scoredNotes = allNotes.map(note => {
      const noteText = `${note.title} ${note.content}`.toLowerCase()
      let score = 0
      
      // Title matches are worth more
      if (note.title.toLowerCase().includes(lowerMessage)) {
        score += 10
      }
      
      // Word matches
      words.forEach(word => {
        const titleMatches = (note.title.toLowerCase().match(new RegExp(word, 'g')) || []).length
        const contentMatches = (note.content.toLowerCase().match(new RegExp(word, 'g')) || []).length
        score += titleMatches * 3 + contentMatches
      })
      
      return { note, score }
    })
    
    // Sort by score and return top 5
    return scoredNotes
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.note)
  }

  /**
   * Build context message with vault access
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

    // Load vault and find relevant notes
    try {
      const allNotes = await this.loadVaultNotes()
      
      if (allNotes.length > 0) {
        context += `\n=== VAULT ACCESS ===\nYou have access to ${allNotes.length} notes in the vault.\n`
        
        // Check if user is asking about vault
        const lowerMessage = userMessage.toLowerCase()
        const isVaultQuery = lowerMessage.includes('vault') || 
                            lowerMessage.includes('all notes') || 
                            lowerMessage.includes('my notes') ||
                            lowerMessage.includes('read my') ||
                            lowerMessage.includes('scan')
        
        // Find relevant notes based on user message
        const relevantNotes = this.findRelevantNotes(userMessage, allNotes)
        
        if (isVaultQuery || relevantNotes.length === 0) {
          // User wants vault overview or no specific matches - show more notes
          const notesToShow = isVaultQuery ? allNotes.slice(0, 10) : allNotes.slice(0, 5)
          context += `\nNotes in vault (showing ${notesToShow.length} of ${allNotes.length}):\n`
          notesToShow.forEach((note, index) => {
            const preview = note.content.length > 400
              ? note.content.substring(0, 400) + '...'
              : note.content
            const path = note.path ? ` [${note.path}]` : ''
            context += `\n${index + 1}. "${note.title}"${path}:\n${preview}\n`
          })
          
          if (allNotes.length > notesToShow.length) {
            context += `\n... and ${allNotes.length - notesToShow.length} more notes in the vault.\n`
          }
        } else {
          // Show relevant notes
          context += `\nRelevant notes from vault (${relevantNotes.length}):\n`
          relevantNotes.forEach((note, index) => {
            const preview = note.content.length > 600
              ? note.content.substring(0, 600) + '...'
              : note.content
            const path = note.path ? ` [${note.path}]` : ''
            context += `\n${index + 1}. "${note.title}"${path}:\n${preview}\n`
          })
        }
        
        context += `\nYou can reference any note by its title. When the user asks about their vault or notes, you have full context.\n`
      } else {
        context += `\nNote: The vault appears to be empty or notes could not be loaded.\n`
      }
    } catch (error) {
      console.error('[AIService] Failed to load vault for context:', error)
      context += '\nNote: Unable to load full vault at this time. You can still help with the current note.\n'
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
