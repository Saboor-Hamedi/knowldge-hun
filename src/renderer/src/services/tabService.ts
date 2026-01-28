import { state } from '../core/state'
import type { NoteMeta } from '../core/types'
import { syncTabsWithNotes, ensureTab, sortTabs } from '../utils/helpers'

export class TabService {
  ensureTab(note: NoteMeta): void {
    state.openTabs = ensureTab(state.openTabs, {
      id: note.id,
      title: note.title,
      updatedAt: note.updatedAt,
      path: note.path
    })
    state.openTabs = sortTabs(state.openTabs, state.pinnedTabs)
  }

  syncTabs(): void {
    state.openTabs = syncTabsWithNotes(state.openTabs, state.notes)
    state.openTabs = sortTabs(state.openTabs, state.pinnedTabs)

    // Clear activeId if it's no longer in openTabs
    if (state.activeId && !state.openTabs.some((t) => t.id === state.activeId)) {
      state.activeId = ''
    }
  }

  closeTab(id: string): void {
    state.openTabs = state.openTabs.filter((t) => t.id !== id)
    state.pinnedTabs.delete(id)

    if (state.activeId === id) {
      state.activeId = ''
    }
  }

  closeTabs(ids: string[]): void {
    state.openTabs = state.openTabs.filter((t) => !ids.includes(t.id))
    ids.forEach((id) => state.pinnedTabs.delete(id))

    if (ids.includes(state.activeId)) {
      state.activeId = ''
    }
  }

  setActiveTab(id: string): void {
    state.activeId = id
  }

  getActiveTabId(): string {
    return state.activeId
  }

  findNextTabToOpen(): NoteMeta | null {
    if (state.openTabs.length > 0) {
      return state.openTabs[0]
    }
    return null
  }
}

export const tabService = new TabService()
