import { state } from '../core/state'
import type { NoteMeta } from '../core/types'

export interface DeleteResult {
  success: boolean
  error?: string
}

export class NoteService {
  async deleteNote(id: string, path?: string): Promise<DeleteResult> {
    try {
      await window.api.deleteNote(id, path)
      // Update tabs
      state.openTabs = state.openTabs.filter((t) => t.id !== id)
      state.pinnedTabs.delete(id)
      return { success: true }
    } catch (error: any) {
      console.error('[NoteService] Delete note failed:', error)
      return { success: false, error: error.message || 'Delete failed' }
    }
  }

  async deleteFolder(path: string): Promise<DeleteResult> {
    try {
      await window.api.deleteFolder(path)
      return { success: true }
    } catch (error: any) {
      console.error('[NoteService] Delete folder failed:', error)
      return { success: false, error: error.message || 'Delete failed' }
    }
  }

  async deleteItems(
    items: { id: string; type: 'note' | 'folder'; path?: string }[]
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = []

    for (const item of items) {
      let result: DeleteResult
      if (item.type === 'note') {
        result = await this.deleteNote(item.id, item.path)
      } else {
        result = await this.deleteFolder(item.id)
      }

      if (!result.success && result.error) {
        errors.push(`${item.id}: ${result.error}`)
      }
    }

    return {
      success: errors.length === 0,
      errors
    }
  }

  async moveNote(id: string, fromPath?: string, toPath?: string): Promise<NoteMeta> {
    const newMeta = await window.api.moveNote(id, fromPath, toPath)

    // Update tabs and active state
    state.openTabs = state.openTabs.map((tab) => {
      if (tab.id === id) {
        return { ...newMeta }
      }
      return tab
    })

    if (state.activeId === id) {
      state.activeId = newMeta.id
    }

    if (state.pinnedTabs.has(id)) {
      state.pinnedTabs.delete(id)
      state.pinnedTabs.add(newMeta.id)
    }

    return newMeta
  }

  async moveFolder(sourcePath: string, targetPath: string): Promise<{ path: string }> {
    const result = await window.api.moveFolder(sourcePath, targetPath)
    const newFolderPath = result.path

    const oldPrefix = sourcePath + '/'
    const newPrefix = newFolderPath + '/'

    // Refresh notes to get updated metadata
    const allNotes = await window.api.listNotes()

    // Update tabs - preserve all properties and update from refreshed notes
    state.openTabs = state.openTabs.map((tab) => {
      if (tab.id.startsWith(oldPrefix)) {
        const newId = tab.id.replace(oldPrefix, newPrefix)
        const lastSlash = newId.lastIndexOf('/')
        const newNotePath = lastSlash === -1 ? '' : newId.substring(0, lastSlash)

        // Find the updated note metadata from the refreshed list
        const updatedNote = allNotes.find((n) => n.id === newId)
        if (updatedNote) {
          return { ...updatedNote }
        }

        // Fallback: preserve existing properties but update id and path
        return {
          ...tab,
          id: newId,
          path: newNotePath,
          title: tab.title || 'Untitled' // Ensure title is never undefined
        }
      }
      return tab
    })

    // Update active ID
    if (state.activeId.startsWith(oldPrefix)) {
      state.activeId = state.activeId.replace(oldPrefix, newPrefix)
    }

    // Update pinned tabs
    for (const id of Array.from(state.pinnedTabs)) {
      if (id.startsWith(oldPrefix)) {
        state.pinnedTabs.delete(id)
        state.pinnedTabs.add(id.replace(oldPrefix, newPrefix))
      }
    }

    // Update expanded folders
    for (const path of Array.from(state.expandedFolders)) {
      if (path.startsWith(oldPrefix)) {
        state.expandedFolders.delete(path)
        state.expandedFolders.add(
          path === sourcePath ? newFolderPath : path.replace(oldPrefix, newPrefix)
        )
      }
    }

    return result
  }

  async createNote(title?: string, path?: string): Promise<NoteMeta> {
    const meta = await window.api.createNote(title || '', path)
    state.newlyCreatedIds.add(meta.id)

    // Ensure parent folder is expanded
    if (path) {
      state.expandedFolders.add(path)
    }

    return meta
  }

  async renameNote(id: string, newId: string, path?: string): Promise<NoteMeta> {
    const newMeta = await window.api.renameNote(id, newId, path)

    // Handle case where rename fails or returns null
    if (!newMeta) {
      console.error(`[NoteService] renameNote: API returned null for ${id} -> ${newId}`)
      throw new Error(`Failed to rename note "${id}" to "${newId}"`)
    }

    // Ensure newMeta has all required properties
    if (!newMeta.title) {
      console.warn(`[NoteService] renameNote: newMeta missing title for ${newMeta.id}`)
      // Extract title from id as fallback
      const parts = newMeta.id.split('/')
      newMeta.title = parts[parts.length - 1] || 'Untitled'
    }

    // Ensure newMeta.id is set
    if (!newMeta.id) {
      console.warn(`[NoteService] renameNote: newMeta missing id, using ${newId}`)
      newMeta.id = newId
    }

    // Update state
    const idx = state.notes.findIndex((n) => n.id === id)
    if (idx >= 0) {
      state.notes[idx] = { ...newMeta }
    } else {
      state.notes.unshift(newMeta)
    }

    // Update tabs - preserve title if newMeta doesn't have it
    state.openTabs = state.openTabs.map((tab) => {
      if (tab.id === id) {
        return {
          ...newMeta,
          title: newMeta.title || tab.title || 'Untitled' // Preserve title
        }
      }
      return tab
    })

    // Update active ID
    if (state.activeId === id) {
      state.activeId = newMeta.id
    }

    // Update pinned tabs
    if (state.pinnedTabs.has(id)) {
      state.pinnedTabs.delete(id)
      state.pinnedTabs.add(newMeta.id)
    }

    return newMeta
  }
}

export const noteService = new NoteService()
