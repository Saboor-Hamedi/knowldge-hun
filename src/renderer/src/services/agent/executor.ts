import { state } from '../../core/state'
import { ragService } from '../rag/ragService'
import { tabService } from '../tabService'
import type { NoteMeta, NotePayload, TreeItem } from '../../core/types'

/**
 * Agent Executor
 *
 * Responsible for translating agent actions into real file operations.
 * Handles path resolution, error handling, and RAG re-indexing.
 */
export class AgentExecutor {
  private dispatchVaultChange(): void {
    window.dispatchEvent(new CustomEvent('vault-changed'))
  }

  /**
   * EXECUTE: Read Note
   */
  async readNote(query: string): Promise<{ title: string; path: string; content: string }> {
    const note = this.resolveNote(query)
    if (!note) throw new Error(`Note not found: ${query}`)

    const data = await window.api.loadNote(note.id, note.path)
    return {
      title: note.title,
      path: note.path || '',
      content: data?.content || ''
    }
  }
  /**
   * Resolve a fuzzy title or path to a specific NoteMeta
   */
  public resolveNote(query: string): NoteMeta | undefined {
    const q = query.trim()
    const qLower = q.toLowerCase()

    // 1. Try exact path match first (best for ambiguous names)
    const exact = state.notes.find((n) => n.path === q || n.id === q)
    if (exact) return exact

    // 2. Try active note
    const active = state.notes.find((n) => n.id === state.activeId)
    if (active && (active.title.toLowerCase() === qLower || active.id.toLowerCase() === qLower)) {
      return active
    }

    // 3. Search all notes by title/id/fuzzy path
    return state.notes.find(
      (n) =>
        n.title.toLowerCase() === qLower ||
        n.id.toLowerCase() === qLower ||
        n.id.toLowerCase() === `${qLower}.md` ||
        n.path?.toLowerCase() === qLower
    )
  }

  /**
   * Resolve a folder path
   */
  public resolveFolder(query: string): string | undefined {
    const q = query.trim()
    const qLower = q.toLowerCase()

    // 1. Try exact path match
    const exact = state.notes.find((n) => n.type === 'folder' && n.path === q)
    if (exact) return exact.path

    // 2. Try to find the most "relevant" folder by name
    const matches = state.notes.filter(
      (n) =>
        n.type === 'folder' &&
        (n.title.toLowerCase() === qLower || n.path?.toLowerCase() === qLower)
    )

    if (matches.length === 0) return undefined
    if (matches.length === 1) return matches[0].path

    // If there are multiple, try to find one that is "closer" to the root or previously selected
    // For now, we return the first one but log a warning.
    console.warn(
      `[AgentExecutor] Ambiguous folder name "${query}": found ${matches.length} matches. Using first one.`
    )
    return matches[0].path
  }

  /**
   * EXECUTE: Write Note
   */
  async writeNote(title: string, content: string, parentPath?: string): Promise<NoteMeta> {
    const existing = this.resolveNote(title)

    if (existing) {
      const result = await window.api.saveNote({
        id: existing.id,
        content,
        title: existing.title,
        path: existing.path
      } as NotePayload)
      void ragService.indexNote(existing.id, content, {
        title: existing.title,
        path: existing.path
      })
      return result
    } else {
      const meta = await window.api.createNote(title, parentPath)
      const result = await window.api.saveNote({
        id: meta.id,
        content,
        title: meta.title
      } as NotePayload)
      void ragService.indexNote(meta.id, content, { title: meta.title, path: meta.path })

      this.dispatchVaultChange()

      // Auto-open the newly created note
      window.dispatchEvent(
        new CustomEvent('knowledge-hub:open-note', {
          detail: { id: meta.id, path: meta.path }
        })
      )

      return result
    }
  }

  /**
   * EXECUTE: Propose changes to a Note (Diff mode)
   */
  async proposeNote(title: string, content: string): Promise<NoteMeta> {
    const note = this.resolveNote(title)
    if (!note) throw new Error(`Note not found: ${title}`)

    // We don't save yet. We just dispatch an event that the editor will catch.
    window.dispatchEvent(
      new CustomEvent('knowledge-hub:propose-note', {
        detail: { id: note.id, content }
      })
    )
    return note
  }

  /**
   * EXECUTE: Append Note
   */
  async appendNote(title: string, contentToAppend: string): Promise<NoteMeta> {
    const note = this.resolveNote(title)
    if (!note) throw new Error(`Note not found: ${title}`)

    const data = await window.api.loadNote(note.id, note.path)
    const newContent = (data?.content || '') + '\n' + contentToAppend

    const result = await window.api.saveNote({
      id: note.id,
      content: newContent,
      title: note.title,
      path: note.path
    } as NotePayload)

    void ragService.indexNote(note.id, newContent, { title: note.title, path: note.path })
    return result
  }

  /**
   * EXECUTE: Append Chunk (Internal for streaming)
   */
  async appendChunk(id: string, chunk: string): Promise<void> {
    await window.api.appendNote(id, chunk)
  }

  /**
   * EXECUTE: Create Folder
   */
  async createFolder(name: string, parentPath?: string): Promise<{ name: string; path: string }> {
    console.log(`[AgentExecutor] Creating folder "${name}" with parent:`, parentPath || 'root')
    const result = await window.api.createFolder(name, parentPath)
    this.dispatchVaultChange()
    console.log(`[AgentExecutor] Folder created at:`, result.path)
    return result
  }

  /**
   * EXECUTE: Rename
   */
  async rename(oldId: string, newName: string): Promise<NoteMeta | { name: string; path: string }> {
    const item = this.resolveNote(oldId)
    if (item) {
      let result
      if (item.type === 'folder') {
        result = await window.api.renameFolder(item.path!, newName)
      } else {
        result = await window.api.renameNote(item.id, newName, item.path)
      }
      this.dispatchVaultChange()
      return result
    }
    throw new Error(`Item not found for renaming: ${oldId}`)
  }

  /**
   * EXECUTE: Move
   */
  async move(
    id: string,
    targetFolderPath: string
  ): Promise<NoteMeta | { success?: boolean; path?: string }> {
    const item = this.resolveNote(id)
    if (!item) throw new Error(`Item not found for moving: ${id}`)

    const targetPath = this.resolveFolder(targetFolderPath)
    if (!targetPath) throw new Error(`Target folder not found: ${targetFolderPath}`)

    console.log(
      `[AgentExecutor] Moving item "${item.title}" (${item.path}) to target path:`,
      targetPath
    )

    if (item.type === 'folder') {
      const res = await window.api.moveFolder(item.path!, targetPath)
      this.dispatchVaultChange()
      return res
    } else {
      const res = await window.api.moveNote(item.id, item.path, targetPath)
      this.dispatchVaultChange()
      return res
    }
  }

  /**
   * EXECUTE: Delete
   */
  async delete(id: string): Promise<{ success: boolean }> {
    const item = this.resolveNote(id)
    if (!item) throw new Error(`Item not found for deletion: ${id}`)

    let res
    if (item.type === 'folder') {
      res = await window.api.deleteFolder(item.path!)

      // Close tabs for notes inside this folder
      const folderPathPrefix = item.path!.endsWith('/') ? item.path! : item.path! + '/'
      const idsToClose = state.openTabs
        .filter((tab) => tab.path?.startsWith(folderPathPrefix))
        .map((tab) => tab.id)

      if (idsToClose.length > 0) {
        tabService.closeTabs(idsToClose)
      }
    } else {
      res = await window.api.deleteNote(item.id, item.path!)
      tabService.closeTab(item.id)
      void ragService.deleteNote(item.id)
    }
    this.dispatchVaultChange()
    return res
  }
  /**
   * EXECUTE: Run terminal command
   */
  async executeTerminal(command: string): Promise<string> {
    try {
      // Get current vault path for CWD
      const vault = await window.api.getVault()
      const result = (await window.api.invoke('terminal:run-command', command, vault.path)) as {
        success: boolean
        output: string
        error: string
      }

      if (result.success) {
        return result.output || 'Command executed successfully (no output).'
      } else {
        return `Error: ${result.error}\nOutput: ${result.output}`
      }
    } catch (err) {
      throw new Error(`Terminal execution failed: ${(err as Error).message}`)
    }
  }

  /**
   * Helper to format the vault tree for AI output
   */
  public formatTree(items: TreeItem[], indent = ''): string {
    let res = ''
    for (const item of items) {
      const icon = item.type === 'folder' ? '📂' : '📄'
      res += `${indent}${icon} ${item.title}\n`
      if (item.children) res += this.formatTree(item.children, indent + '  ')
    }
    return res
  }
}

export const agentExecutor = new AgentExecutor()
