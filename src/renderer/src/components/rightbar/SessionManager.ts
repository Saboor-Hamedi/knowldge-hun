import { sessionStorageService, type ChatSession } from '../../services/sessionStorageService'
import type { ChatMessage } from '../../services/aiService'
import { SessionSidebar } from './session-sidebar'

export interface SessionManagerUI {
  onSessionLoaded: (session: ChatSession) => void
  onSessionCreated: (session: ChatSession) => void
  onNewSessionStarted: () => void
  onMenuItemsUpdated: () => void
  onSessionArchived: () => void
}

/**
 * SessionManager - Handles all chat session persistence and metadata
 */
export class SessionManager {
  private currentSessionId: string | null = null
  private isInitialized = false
  private saveTimeout: number | null = null

  constructor(
    private sessionSidebar: SessionSidebar | null,
    private ui: SessionManagerUI
  ) {}

  getCurrentSessionId(): string | null {
    return this.currentSessionId
  }

  setCurrentSessionId(id: string | null): void {
    this.currentSessionId = id
  }

  /**
   * Initialize session storage and load last session
   */
  async initialize(): Promise<void> {
    try {
      await sessionStorageService.getAllSessions()
      this.isInitialized = true

      const isNewInstance = window.location.search.includes('newInstance=true')
      const lastSessionId = isNewInstance
        ? null
        : localStorage.getItem('knowledgeHub_currentSessionId')

      if (lastSessionId) {
        try {
          const session = await sessionStorageService.getSession(lastSessionId)
          if (session) {
            this.currentSessionId = session.id
            if (this.sessionSidebar) {
              this.sessionSidebar.setCurrentSession(session.id)
            }
            this.ui.onSessionLoaded(session)
            this.ui.onMenuItemsUpdated()
            return
          }
        } catch (error) {
          console.warn('[SessionManager] Failed to restore last session:', error)
          localStorage.removeItem('knowledgeHub_currentSessionId')
        }
      }

      await this.createNewSession([])
      this.ui.onMenuItemsUpdated()
    } catch (error) {
      console.error('[SessionManager] Failed to initialize:', error)
      this.isInitialized = false
    }
  }

  /**
   * Create a new session or reuse existing empty one
   */
  async createNewSession(messages: ChatMessage[], explicitTitle?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      if (messages.length === 0) {
        // Only reuse empty session if we are creating a fresh empty session
        const allSessions = await sessionStorageService.getAllSessions(false)
        const emptySession = allSessions.find((s) => s.messages.length === 0)

        if (emptySession) {
          this.currentSessionId = emptySession.id
          localStorage.setItem('knowledgeHub_currentSessionId', emptySession.id)
          if (this.sessionSidebar) {
            this.sessionSidebar.setCurrentSession(emptySession.id)
            await this.sessionSidebar.refresh()
          }
          this.ui.onSessionCreated(emptySession)
          return
        }
      }

      const title =
        explicitTitle || (messages.length > 0 ? this.generateSmartTitle(messages) : undefined)
      const session = await sessionStorageService.createSession(messages, title)
      this.currentSessionId = session.id
      localStorage.setItem('knowledgeHub_currentSessionId', session.id)

      if (this.sessionSidebar) {
        this.sessionSidebar.setCurrentSession(session.id)
        await this.sessionSidebar.refresh()
      }
      this.ui.onSessionCreated(session)
      this.ui.onMenuItemsUpdated()
    } catch (error) {
      console.error('[SessionManager] Failed to create session:', error)
    }
  }

  /**
   * Auto-save current session (debounced)
   */
  async autoSave(messages: ChatMessage[]): Promise<void> {
    if (!this.isInitialized || !this.currentSessionId || messages.length === 0) {
      return
    }

    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout)
    }

    this.saveTimeout = window.setTimeout(() => {
      const saveOperation = async (): Promise<void> => {
        try {
          await sessionStorageService.updateSessionMessages(this.currentSessionId!, messages)
          const session = await sessionStorageService.getSession(this.currentSessionId!)
          if (session && session.title === 'New Session' && messages.length > 0) {
            const newTitle = this.generateSmartTitle(messages)
            if (newTitle && newTitle !== 'New Session') {
              await sessionStorageService.updateSessionTitle(this.currentSessionId!, newTitle)
              if (this.sessionSidebar) await this.sessionSidebar.refresh()
            }
          }
        } catch (error) {
          console.error('[SessionManager] Auto-save failed:', error)
        }
        this.saveTimeout = null
      }

      if ('requestIdleCallback' in window) {
        requestIdleCallback(saveOperation, { timeout: 2000 })
      } else {
        setTimeout(saveOperation, 0)
      }
    }, 1000)
  }

  /**
   * Load a session by ID
   */
  async loadSession(sessionId: string): Promise<void> {
    try {
      const session = await sessionStorageService.getSession(sessionId)
      if (session) {
        this.currentSessionId = session.id
        localStorage.setItem('knowledgeHub_currentSessionId', sessionId)
        if (this.sessionSidebar) {
          this.sessionSidebar.setCurrentSession(sessionId)
        }
        this.ui.onSessionLoaded(session)
        this.ui.onMenuItemsUpdated()
      }
    } catch (error) {
      console.error('[SessionManager] Failed to load session:', error)
    }
  }

  /**
   * Archive session
   */
  async archiveCurrent(): Promise<void> {
    if (!this.currentSessionId) return
    try {
      await sessionStorageService.archiveSession(this.currentSessionId)
      this.currentSessionId = null
      localStorage.removeItem('knowledgeHub_currentSessionId')
      if (this.sessionSidebar) {
        this.sessionSidebar.setCurrentSession(null)
        await this.sessionSidebar.refresh()
      }
      this.ui.onSessionArchived()
    } catch (error) {
      console.error('[SessionManager] Failed to archive:', error)
    }
  }

  /**
   * Generate title from messages
   */
  generateSmartTitle(messages: ChatMessage[]): string {
    const firstUserMessage = messages.find((msg) => msg.role === 'user')
    if (!firstUserMessage) return 'New Session'

    let text = firstUserMessage.content.trim()
    text = text
      .replace(/^#+\s+/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .trim()

    const prefixes = [
      /^(what|how|why|when|where|who|can|could|should|would|is|are|do|does|did)\s+/i,
      /^(explain|describe|tell|show|help|please)\s+/i,
      /^(i want|i need|i would like|i'm looking for)\s+/i
    ]

    for (const prefix of prefixes) {
      text = text.replace(prefix, '')
    }
    text = text.trim()

    const firstLine = text.split('\n')[0]
    let title = firstLine.substring(0, 40).trim()

    if (title.length > 0) {
      title = title.charAt(0).toUpperCase() + title.slice(1)
    }

    if (title.length > 1 && /[.,!?;:]$/.test(title)) {
      title = title.slice(0, -1)
    }

    if (firstLine.length > 40) {
      title += '...'
    }

    return title || 'New Session'
  }

  /**
   * Export current session to Markdown
   */
  async exportToMarkdown(messages: ChatMessage[], title: string = 'Chat Session'): Promise<void> {
    if (messages.length === 0) return

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      let markdown = `# ${title}\n\n`
      markdown += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`

      messages.forEach((msg) => {
        const role = msg.role === 'user' ? '**You**' : '**AI**'
        const time = new Date(msg.timestamp).toLocaleTimeString()
        markdown += `### ${role} (${time})\n\n${msg.content}\n\n`
        if (msg.feedback) {
          markdown += `*Feedback: ${msg.feedback === 'thumbs-up' ? '👍' : '👎'}*\n\n`
        }
        markdown += '---\n\n'
      })

      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[SessionManager] Export failed:', error)
    }
  }

  /**
   * Get active session metadata
   */
  async getSessionMetadata(): Promise<ChatSession | null> {
    if (!this.currentSessionId) return null
    return await sessionStorageService.getSession(this.currentSessionId)
  }
}
