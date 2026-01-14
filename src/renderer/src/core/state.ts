import type { AppState } from './types'

export const state: AppState = {
  notes: [],
  tree: [],
  expandedFolders: new Set<string>(),
  openTabs: [],
  activeId: '',
  isDirty: false,
  lastSavedAt: 0,
  applyingRemote: false,
  activeView: 'notes',
  projectName: 'Knowledge Hub',
  vaultPath: undefined,
  settings: undefined,
  pinnedTabs: new Set<string>()
}
