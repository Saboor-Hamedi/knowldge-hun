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

  private refreshActiveNoteIfNeeded(id: string, path?: string): void {
    if (state.activeId === id) {
      window.dispatchEvent(
        new CustomEvent('knowledge-hub:open-note', {
          detail: { id, path, focus: 'none' }
        })
      )
    }
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
    const commonExtensions = ['.md', '.py', '.ts', '.js', '.txt', '.json']
    return state.notes.find((n) => {
      const idLower = n.id.toLowerCase()
      if (n.title.toLowerCase() === qLower) return true
      if (idLower === qLower) return true
      if (n.path?.toLowerCase() === qLower) return true

      // Try fuzzy extension matches
      for (const ext of commonExtensions) {
        if (idLower === `${qLower}${ext}`) return true
      }

      return false
    })
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
    // CRITICAL: Ensure we have fresh vault data (same as delete)
    if (state.notes.length === 0) {
      console.warn('[AgentExecutor] state.notes is empty, fetching fresh vault data...')
      try {
        const freshNotes = await window.api.listNotes()
        state.notes = freshNotes
        console.log(`[AgentExecutor] Refreshed state with ${freshNotes.length} items`)
      } catch (err) {
        console.error('[AgentExecutor] Failed to refresh vault state:', err)
      }
    }

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
      this.refreshActiveNoteIfNeeded(existing.id, existing.path)
      return result
    } else {
      // CRITICAL: If parentPath is provided, resolve it to an existing folder first
      let resolvedParentPath = parentPath
      if (parentPath && parentPath !== '.') {
        console.log(`[AgentExecutor] Attempting to resolve parent folder: "${parentPath}"`)
        const existingFolder = this.resolveFolder(parentPath)
        if (existingFolder) {
          resolvedParentPath = existingFolder
          console.log(`[AgentExecutor] ✓ Resolved to existing folder: ${existingFolder}`)
        } else {
          console.warn(
            `[AgentExecutor] ✗ Could not find existing folder "${parentPath}", will create new folder`
          )
        }
      }

      const meta = await window.api.createNote(title, resolvedParentPath)
      const result = await window.api.saveNote({
        id: meta.id,
        content,
        title: meta.title
      } as NotePayload)
      void ragService.indexNote(meta.id, content, { title: meta.title, path: meta.path })

      this.dispatchVaultChange()
      this.refreshActiveNoteIfNeeded(meta.id, meta.path)

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
    this.refreshActiveNoteIfNeeded(note.id, note.path)
    return result
  }

  /**
   * EXECUTE: Patch Note (Search and Replace)
   */
  async patchNote(title: string, search: string, replace: string): Promise<NoteMeta> {
    const note = this.resolveNote(title)
    if (!note) throw new Error(`Note not found: ${title}`)

    const data = await window.api.loadNote(note.id, note.path)
    const content = data?.content || ''

    if (!content.includes(search)) {
      throw new Error(`Search string not found in "${title}"`)
    }

    const newContent = content.replace(search, replace)
    const result = await window.api.saveNote({
      id: note.id,
      content: newContent,
      title: note.title,
      path: note.path
    } as NotePayload)

    void ragService.indexNote(note.id, newContent, { title: note.title, path: note.path })
    this.refreshActiveNoteIfNeeded(note.id, note.path)
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
    // CRITICAL: Ensure we have fresh vault data
    if (state.notes.length === 0) {
      console.warn('[AgentExecutor] state.notes is empty, fetching fresh vault data...')
      try {
        const freshNotes = await window.api.listNotes()
        state.notes = freshNotes
        console.log(`[AgentExecutor] Refreshed state with ${freshNotes.length} items`)
      } catch (err) {
        console.error('[AgentExecutor] Failed to refresh vault state:', err)
      }
    }

    const item = this.resolveNote(id)
    if (!item) {
      // IDEMPOTENCY check: If it's already gone, we achieved the target state.
      // Returning success prevents AI from crashing/looping on a Ghost Modal.
      console.log(
        `[AgentExecutor] Deletion target "${id}" already removed or not found. Target achieved.`
      )
      return { success: true }
    }

    let res
    if (item.type === 'folder') {
      // For folders, use item.id as the path (folders don't have a separate path property)
      res = await window.api.deleteFolder(item.id)

      // Close tabs for notes inside this folder
      const folderPathPrefix = item.id.endsWith('/') ? item.id : item.id + '/'
      const idsToClose = state.openTabs
        .filter(
          (tab) => tab.path?.startsWith(folderPathPrefix) || tab.id.startsWith(folderPathPrefix)
        )
        .map((tab) => tab.id)

      if (idsToClose.length > 0) {
        tabService.closeTabs(idsToClose)
      }
    } else {
      res = await window.api.deleteNote(item.id, item.path || '')
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
  public formatTree(items: TreeItem[], indent = '', maxItems = 100): string {
    let count = 0
    const build = (list: TreeItem[], currentIndent = ''): string => {
      let res = ''
      for (const item of list) {
        if (count >= maxItems) {
          if (count === maxItems) {
            res += `${currentIndent}... (tree truncated, use 'ls' or 'tree' for more)\n`
            count++
          }
          continue
        }

        const icon = item.type === 'folder' ? '📂' : '📄'
        const pathSuffix = item.id ? ` (PATH: ${item.id})` : ''
        res += `${currentIndent}${icon} ${item.title}${pathSuffix}\n`
        count++

        if (item.children && item.children.length > 0) {
          res += build(item.children, currentIndent + '  ')
        }
      }
      return res
    }

    return build(items, indent)
  }
}

export const agentExecutor = new AgentExecutor()
