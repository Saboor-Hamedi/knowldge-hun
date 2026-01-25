import type { ChatMessage } from './aiService'

/**
 * Session data structure
 */
export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  metadata: {
    created_at: number
    updated_at: number
    note_references?: string[]
    tags?: string[]
  }
  is_archived: boolean
}

/**
 * IndexedDB Session Storage Service
 * Handles all session persistence operations
 */
export class SessionStorageService {
  private dbName = 'knowledgeHub_sessions'
  private dbVersion = 1
  private storeName = 'sessions'
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null
  private isInitialized = false
  private maxRetries = 3
  private retryDelay = 100

  /**
   * Initialize IndexedDB connection with retry logic
   */
  public async init(): Promise<void> {
    if (this.db && this.isInitialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.initWithRetry(0)
    return this.initPromise
  }

  /**
   * Initialize with retry mechanism
   */
  private async initWithRetry(attempt: number): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        // Check if IndexedDB is available
        if (!window.indexedDB) {
          reject(new Error('IndexedDB is not available'))
          return
        }

        const request = indexedDB.open(this.dbName, this.dbVersion)

        request.onerror = () => {
          console.error('[SessionStorage] Failed to open database:', request.error)
          reject(request.error)
        }

        request.onsuccess = () => {
          this.db = request.result
          this.isInitialized = true

          // Handle database close/error events
          this.db.onerror = (event) => {
            console.error('[SessionStorage] Database error:', event)
            this.isInitialized = false
            this.db = null
          }

          this.db.onclose = () => {
            console.warn('[SessionStorage] Database closed')
            this.isInitialized = false
            this.db = null
          }

          resolve()
        }

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result

          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains(this.storeName)) {
            const objectStore = db.createObjectStore(this.storeName, {
              keyPath: 'id'
            })
            objectStore.createIndex('created_at', 'metadata.created_at', { unique: false })
            objectStore.createIndex('updated_at', 'metadata.updated_at', { unique: false })
            objectStore.createIndex('is_archived', 'is_archived', { unique: false })
          }
        }

        request.onblocked = () => {
          console.warn('[SessionStorage] Database upgrade blocked - another tab may be open')
        }
      })
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.warn(`[SessionStorage] Init attempt ${attempt + 1} failed, retrying...`, error)
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)))
        return this.initWithRetry(attempt + 1)
      }
      throw error
    }
  }

  /**
   * Ensure database is initialized with validation
   */
  private async ensureInit(): Promise<IDBDatabase> {
    try {
      await this.init()
      if (!this.db || !this.isInitialized) {
        // Try to reinitialize
        this.db = null
        this.isInitialized = false
        this.initPromise = null
        await this.init()
      }

      if (!this.db) {
        throw new Error('[SessionStorage] Database not initialized after retry')
      }

      return this.db
    } catch (error) {
      console.error('[SessionStorage] Failed to ensure initialization:', error)
      throw error
    }
  }

  /**
   * Execute a database operation with error handling and retry
   */
  private async executeOperation<T>(
    operation: (db: IDBDatabase) => Promise<T>,
    retries = 2
  ): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const db = await this.ensureInit()
        return await operation(db)
      } catch (error) {
        if (attempt === retries) {
          console.error('[SessionStorage] Operation failed after retries:', error)
          throw error
        }

        // Reset connection on error
        if (error instanceof Error && error.message.includes('not initialized')) {
          this.db = null
          this.isInitialized = false
          this.initPromise = null
        }

        await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)))
      }
    }
    throw new Error('[SessionStorage] Operation failed')
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Generate a smart title from messages
   */
  private generateTitle(messages: ChatMessage[]): string {
    const firstUserMessage = messages.find((msg) => msg.role === 'user')
    if (!firstUserMessage) {
      return 'New Session'
    }

    let text = firstUserMessage.content.trim()

    // Remove markdown formatting
    text = text
      .replace(/^#+\s+/, '') // Remove heading markers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/`(.+?)`/g, '$1') // Remove code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links, keep text
      .trim()

    // Remove common prefixes/questions
    const prefixes = [
      /^(what|how|why|when|where|who|can|could|should|would|is|are|do|does|did)\s+/i,
      /^(explain|describe|tell|show|help|please)\s+/i,
      /^(i want|i need|i would like|i\'m looking for)\s+/i
    ]

    for (const prefix of prefixes) {
      text = text.replace(prefix, '')
    }
    text = text.trim()

    // Take first line or first 40 characters
    const firstLine = text.split('\n')[0]
    let title = firstLine.substring(0, 40).trim()

    // Capitalize first letter
    if (title.length > 0) {
      title = title.charAt(0).toUpperCase() + title.slice(1)
    }

    // Remove trailing punctuation if it's just one character
    if (title.length > 1 && /[.,!?;:]$/.test(title)) {
      title = title.slice(0, -1)
    }

    // Add ellipsis if truncated
    if (firstLine.length > 40) {
      title += '...'
    }

    return title || 'New Session'
  }

  /**
   * Extract note references from messages
   */
  private extractNoteReferences(messages: ChatMessage[]): string[] {
    const references = new Set<string>()
    const mentionRegex = /@([^\s@]+)/g

    for (const msg of messages) {
      const matches = msg.content.matchAll(mentionRegex)
      for (const match of matches) {
        references.add(match[1])
      }
    }

    return Array.from(references)
  }

  /**
   * Create a new session
   */
  async createSession(messages: ChatMessage[], title?: string): Promise<ChatSession> {
    const now = Date.now()

    const session: ChatSession = {
      id: this.generateSessionId(),
      title: title || this.generateTitle(messages),
      messages: [...messages],
      metadata: {
        created_at: now,
        updated_at: now,
        note_references: this.extractNoteReferences(messages),
        tags: []
      },
      is_archived: false
    }

    return this.executeOperation(async (db) => {
      return new Promise<ChatSession>((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.add(session)

        request.onsuccess = () => resolve(session)
        request.onerror = () => {
          console.error('[SessionStorage] Failed to create session:', request.error)
          reject(request.error)
        }

        transaction.onerror = () => {
          console.error('[SessionStorage] Transaction error:', transaction.error)
          reject(transaction.error)
        }
      })
    })
  }

  /**
   * Save/update an existing session
   */
  async saveSession(session: ChatSession): Promise<ChatSession> {
    // Update metadata
    const updatedSession: ChatSession = {
      ...session,
      metadata: {
        ...session.metadata,
        updated_at: Date.now(),
        note_references: this.extractNoteReferences(session.messages)
      }
    }

    return this.executeOperation(async (db) => {
      return new Promise<ChatSession>((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.put(updatedSession)

        request.onsuccess = () => resolve(updatedSession)
        request.onerror = () => {
          console.error('[SessionStorage] Failed to save session:', request.error)
          reject(request.error)
        }

        transaction.onerror = () => {
          console.error('[SessionStorage] Transaction error:', transaction.error)
          reject(transaction.error)
        }
      })
    })
  }

  /**
   * Update session messages (auto-save) - optimized for frequent calls
   */
  async updateSessionMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    return this.executeOperation(async (db) => {
      return new Promise<void>(async (resolve, reject) => {
        try {
          // First get the session
          const session = await this.getSession(sessionId)
          if (!session) {
            reject(new Error(`[SessionStorage] Session ${sessionId} not found`))
            return
          }

          // Update session data
          session.messages = messages
          session.metadata.updated_at = Date.now()
          session.metadata.note_references = this.extractNoteReferences(messages)

          // Save updated session
          const transaction = db.transaction([this.storeName], 'readwrite')
          const store = transaction.objectStore(this.storeName)
          const request = store.put(session)

          request.onsuccess = () => resolve()
          request.onerror = () => {
            console.error('[SessionStorage] Failed to update session messages:', request.error)
            reject(request.error)
          }

          transaction.onerror = () => {
            console.error('[SessionStorage] Transaction error:', transaction.error)
            reject(transaction.error)
          }
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * Get a session by ID
   */
  async getSession(id: string): Promise<ChatSession | null> {
    return this.executeOperation(async (db) => {
      return new Promise<ChatSession | null>((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.get(id)

        request.onsuccess = () => {
          resolve(request.result || null)
        }
        request.onerror = () => {
          console.error('[SessionStorage] Failed to get session:', request.error)
          reject(request.error)
        }

        transaction.onerror = () => {
          console.error('[SessionStorage] Transaction error:', transaction.error)
          reject(transaction.error)
        }
      })
    })
  }

  /**
   * Get all sessions (excluding archived by default)
   */
  async getAllSessions(includeArchived = false): Promise<ChatSession[]> {
    return this.executeOperation(async (db) => {
      return new Promise<ChatSession[]>((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)

        // Use getAll and filter manually to avoid index issues
        const request = store.getAll()

        request.onsuccess = () => {
          let sessions = request.result as ChatSession[]

          // Filter archived if needed
          if (!includeArchived) {
            sessions = sessions.filter((session) => !session.is_archived)
          }

          // Sort by updated_at descending
          sessions.sort((a, b) => b.metadata.updated_at - a.metadata.updated_at)
          resolve(sessions)
        }
        request.onerror = () => {
          console.error('[SessionStorage] Failed to get all sessions:', request.error)
          reject(request.error)
        }

        transaction.onerror = () => {
          console.error('[SessionStorage] Transaction error:', transaction.error)
          reject(transaction.error)
        }
      })
    })
  }

  /**
   * Get recent sessions (limit)
   */
  async getRecentSessions(limit = 10): Promise<ChatSession[]> {
    const sessions = await this.getAllSessions(false)
    return sessions.slice(0, limit)
  }

  /**
   * Delete a session
   */
  async deleteSession(id: string): Promise<void> {
    const db = await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => {
        console.error('[SessionStorage] Failed to delete session:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Archive/unarchive a session
   */
  async archiveSession(id: string, archived = true): Promise<void> {
    const session = await this.getSession(id)
    if (!session) {
      throw new Error(`[SessionStorage] Session ${id} not found`)
    }

    session.is_archived = archived
    await this.saveSession(session)
  }

  /**
   * Update session title
   */
  async updateSessionTitle(id: string, title: string): Promise<void> {
    return this.executeOperation(async (db) => {
      return new Promise<void>(async (resolve, reject) => {
        try {
          // Get the session
          const session = await this.getSession(id)
          if (!session) {
            reject(new Error(`[SessionStorage] Session ${id} not found`))
            return
          }

          // Update only the title, don't change updated_at timestamp
          session.title = title

          // Save without updating timestamp
          const transaction = db.transaction([this.storeName], 'readwrite')
          const store = transaction.objectStore(this.storeName)
          const request = store.put(session)

          request.onsuccess = () => resolve()
          request.onerror = () => {
            console.error('[SessionStorage] Failed to update session title:', request.error)
            reject(request.error)
          }

          transaction.onerror = () => {
            console.error('[SessionStorage] Transaction error:', transaction.error)
            reject(transaction.error)
          }
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * Search sessions by title or content
   */
  async searchSessions(query: string): Promise<ChatSession[]> {
    const allSessions = await this.getAllSessions(true)
    const lowerQuery = query.toLowerCase()

    return allSessions.filter((session) => {
      // Search in title
      if (session.title.toLowerCase().includes(lowerQuery)) {
        return true
      }

      // Search in message content
      return session.messages.some((msg) => msg.content.toLowerCase().includes(lowerQuery))
    })
  }

  /**
   * Clear all sessions (use with caution)
   */
  async clearAllSessions(): Promise<void> {
    const db = await this.ensureInit()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => {
        console.error('[SessionStorage] Failed to clear sessions:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Get storage usage estimate
   */
  async getStorageInfo(): Promise<{ count: number; estimatedSize: number }> {
    const sessions = await this.getAllSessions(true)
    const estimatedSize = JSON.stringify(sessions).length

    return {
      count: sessions.length,
      estimatedSize
    }
  }
}

// Export singleton instance
export const sessionStorageService = new SessionStorageService()

// Backup and restore functionality for updates
export const sessionBackupService = {
  async backupBeforeUpdate(): Promise<void> {
    try {
      const sessions = await sessionStorageService.getAllSessions(true)
      const backupData = {
        version: Date.now(),
        sessions: sessions,
        timestamp: new Date().toISOString()
      }

      // Save to localStorage as fallback
      localStorage.setItem('knowledgehub_sessions_backup', JSON.stringify(backupData))
    } catch (error) {
      console.error('[SessionBackup] Backup failed:', error)
    }
  },

  async restoreFromBackup(): Promise<boolean> {
    try {
      const backupStr = localStorage.getItem('knowledgehub_sessions_backup')
      if (!backupStr) {
        return false
      }

      const backupData = JSON.parse(backupStr)
      if (!backupData.sessions || !Array.isArray(backupData.sessions)) {
        console.warn('[SessionBackup] Invalid backup format')
        return false
      }

      // Restore sessions
      for (const session of backupData.sessions) {
        try {
          await sessionStorageService.saveSession(session)
        } catch (error) {
          console.error('[SessionBackup] Failed to restore session:', session.id, error)
        }
      }

      // Clear backup after successful restore
      localStorage.removeItem('knowledgehub_sessions_backup')
      return true
    } catch (error) {
      console.error('[SessionBackup] Restore failed:', error)
      return false
    }
  }
}

// Auto-restore on service initialization
sessionStorageService
  .init()
  .then(() => {
    // Check if we need to restore from backup (no sessions exist)
    sessionStorageService.getAllSessions().then((sessions) => {
      if (sessions.length === 0) {
        sessionBackupService.restoreFromBackup()
      }
    })
  })
  .catch(console.error)
