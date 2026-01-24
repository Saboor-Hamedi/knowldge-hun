import { state } from '../core/state'
import { tabService } from '../services/tabService'
import { contextMenu } from '../components/contextmenu/contextmenu'

export interface TabHandlers {
  handleTabContextMenu: (id: string, e: MouseEvent) => void
  togglePinTab: (id: string) => void
  closeOtherTabs: (id: string) => Promise<void>
  closeAllTabs: () => Promise<void>
  closeTab: (
    id: string,
    force?: boolean,
    onTabClose?: (id: string) => Promise<void>,
    onRefresh?: () => Promise<void>,
    onOpenNote?: (id: string, path?: string) => Promise<void>,
    onShowEmpty?: () => void
  ) => Promise<void>
}

export class TabHandlersImpl {
  constructor(
    private tabBar: { render: () => void },
    private statusBar: { setStatus: (msg: string) => void; setMeta: (msg: string) => void },
    private editor: { isPreviewMode: boolean; [key: string]: any },
    private persistWorkspace: () => Promise<void>,
    private updateViewVisibility?: () => void
  ) {}

  handleTabContextMenu(
    id: string,
    e: MouseEvent,
    closeTabFn: (id: string, force?: boolean) => Promise<void>,
    closeOtherTabsFn: (id: string) => Promise<void>,
    closeAllTabsFn: () => Promise<void>
  ): void {
    const isPinned = state.pinnedTabs.has(id)
    contextMenu.show(e.clientX, e.clientY, [
      {
        label: isPinned ? 'Unpin Tab' : 'Pin Tab',
        onClick: () => this.togglePinTab(id)
      },
      { separator: true },
      {
        label: 'Close',
        keybinding: 'Ctrl+W',
        onClick: () => closeTabFn(id, true)
      },
      {
        label: 'Close Others',
        onClick: () => closeOtherTabsFn(id)
      },
      {
        label: 'Close All',
        onClick: () => closeAllTabsFn()
      }
    ])
  }

  togglePinTab(id: string): void {
    if (state.pinnedTabs.has(id)) {
      state.pinnedTabs.delete(id)
    } else {
      state.pinnedTabs.add(id)
    }
    tabService.syncTabs()
    this.tabBar.render()
    void this.persistWorkspace()
  }

  async closeOtherTabs(
    id: string,
    closeTabFn: (id: string, force?: boolean) => Promise<void>
  ): Promise<void> {
    const toClose = state.openTabs.filter((t) => t.id !== id && !state.pinnedTabs.has(t.id))
    for (const tab of toClose) {
      await closeTabFn(tab.id, true)
    }
  }

  async closeAllTabs(closeTabFn: (id: string, force?: boolean) => Promise<void>): Promise<void> {
    const toClose = state.openTabs.filter((t) => !state.pinnedTabs.has(t.id))
    for (const tab of toClose) {
      await closeTabFn(tab.id, true)
    }
  }

  async closeTab(
    id: string,
    force = false,
    onDeleteNote?: (id: string, path?: string) => Promise<void>,
    onRefreshNotes?: () => Promise<void>,
    onOpenNote?: (id: string, path?: string) => Promise<void>,
    onShowEmpty?: () => void
  ): Promise<void> {
    if (!force && state.pinnedTabs.has(id)) {
      this.statusBar.setStatus('Pinned tab cannot be closed')
      return
    }

    if (id.startsWith('preview-') && state.activeId === id) {
      this.editor.isPreviewMode = false
      const editorHost = this.editor['editorHost'] as HTMLElement
      const previewHost = this.editor['previewHost'] as HTMLElement
      if (editorHost) editorHost.style.display = 'block'
      if (previewHost) previewHost.style.display = 'none'
    }

    const wasActive = state.activeId === id
    const tabIndex = state.openTabs.findIndex((t) => t.id === id)

    if (state.pinnedTabs.has(id)) {
      state.pinnedTabs.delete(id)
    }

    const tab = state.openTabs.find((t) => t.id === id)
    if (tab && (state.newlyCreatedIds.has(id) || state.newlyCreatedIds.has(tab.id))) {
      try {
        if (onDeleteNote) await onDeleteNote(id, tab.path)
        state.newlyCreatedIds.delete(id)
        if (onRefreshNotes) await onRefreshNotes()
      } catch {
        // Failed to cleanup new note
      }
    }

    tabService.closeTab(id)

    if (wasActive) {
      const remainingTabs = state.openTabs
      if (remainingTabs.length > 0) {
        const nextIndex = Math.min(tabIndex, remainingTabs.length - 1)
        const fallback = remainingTabs[nextIndex >= 0 ? nextIndex : 0]
        if (onOpenNote) {
          await onOpenNote(fallback.id, fallback.path)
        }
      } else {
        state.activeId = ''
        if (onShowEmpty) onShowEmpty()
        this.statusBar.setStatus('No open editors')
        this.statusBar.setMeta('')
      }
    }

    this.tabBar.render()
    if (this.updateViewVisibility) this.updateViewVisibility()
    void this.persistWorkspace()
  }
}
