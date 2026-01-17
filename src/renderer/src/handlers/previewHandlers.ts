import { state } from '../core/state'
import type { NoteMeta } from '../core/types'
import { tabService } from '../services/tabService'

export interface PreviewHandlersCallbacks {
  showPreview: (content: string) => Promise<void>
  updateViewVisibility: () => void
  setStatus: (message: string) => void
  setMeta: (message: string) => void
  updateSidebarSelection: (noteId: string) => void
  renderTabBar: () => void
  persistWorkspace: () => Promise<void>
}

export class PreviewHandlers {
  private callbacks: PreviewHandlersCallbacks

  constructor(callbacks: PreviewHandlersCallbacks) {
    this.callbacks = callbacks
  }

  /**
   * Opens a preview tab for the currently active note
   */
  async openPreviewTab(): Promise<void> {
    const currentNoteId = state.activeId
    if (!currentNoteId || currentNoteId === 'settings') {
      // No note open or settings is open, can't show preview
      return
    }

    const previewTabId = this.getPreviewTabId(currentNoteId)

    // Check if preview tab already exists
    const existingPreviewTab = state.openTabs.find(t => t.id === previewTabId)
    if (existingPreviewTab) {
      // Preview tab exists, just switch to it
      state.activeId = previewTabId
      this.callbacks.renderTabBar()
      await this.showPreviewTab(currentNoteId, existingPreviewTab.path)
      return
    }

    // Get current note to create preview tab
    const currentNote = state.notes.find(n => n.id === currentNoteId)
    if (!currentNote) return

    // Create preview tab
    const previewTab: NoteMeta = {
      id: previewTabId,
      title: `Preview: ${currentNote.title || currentNote.id}`,
      updatedAt: currentNote.updatedAt,
      path: currentNote.path
    }

    tabService.ensureTab(previewTab)
    state.activeId = previewTabId

    this.callbacks.renderTabBar()
    await this.showPreviewTab(currentNoteId, currentNote.path)
    await this.callbacks.persistWorkspace()
  }

  /**
   * Shows preview content for a specific note
   */
  async showPreviewTab(noteId: string, path?: string): Promise<void> {
    // Load the note content and show preview
    const note = await window.api.loadNote(noteId, path)
    if (!note) return

    // Show preview in editor
    await this.callbacks.showPreview(note.content)
    this.callbacks.updateViewVisibility()
    this.callbacks.setStatus('Preview mode')
    this.callbacks.setMeta(`📁 ${state.vaultPath || ''}`)

    // Update sidebar selection to the original note
    this.callbacks.updateSidebarSelection(noteId)
  }

  /**
   * Closes all preview tabs except the one being activated
   */
  closePreviewTabs(activeTabId?: string): void {
    // Close all preview tabs except the one being activated
    const previewTabs = state.openTabs.filter(t => t.id.startsWith('preview-') && t.id !== activeTabId)
    previewTabs.forEach(tab => {
      const index = state.openTabs.findIndex(t => t.id === tab.id)
      if (index !== -1) {
        state.openTabs.splice(index, 1)
      }
    })
    if (previewTabs.length > 0) {
      this.callbacks.renderTabBar()
    }
  }

  /**
   * Checks if a tab ID is a preview tab
   */
  isPreviewTab(tabId: string): boolean {
    return tabId.startsWith('preview-')
  }

  /**
   * Extracts the original note ID from a preview tab ID
   */
  getNoteIdFromPreviewTab(previewTabId: string): string {
    return previewTabId.replace('preview-', '')
  }

  /**
   * Generates a preview tab ID from a note ID
   */
  getPreviewTabId(noteId: string): string {
    return `preview-${noteId}`
  }
}
