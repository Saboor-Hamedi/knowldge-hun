export type NoteMeta = {
  id: string
  title: string
  updatedAt: number
  createdAt?: number
  path?: string
  type?: 'note' | 'folder'
  children?: NoteMeta[]
  collapsed?: boolean
}

export type FolderItem = NoteMeta & { type: 'folder' }

export type TreeItem = NoteMeta

export type NotePayload = NoteMeta & {
  content: string
}

export type AppState = {
  notes: NoteMeta[]
  tree: TreeItem[]
  expandedFolders: Set<string>
  openTabs: NoteMeta[]
  activeId: string
  isDirty: boolean
  lastSavedAt: number
  applyingRemote: boolean
  activeView: 'notes' | 'search' | 'settings'
  projectName: string
  vaultPath?: string
  settings?: AppSettings
  pinnedTabs: Set<string>
  newlyCreatedIds: Set<string>
  selectedIds: Set<string>
}

export type AppSettings = {
  vaultPath?: string
  theme?: string
  sidebarVisible?: boolean
  autoSave?: boolean
  autoSaveDelay?: number
  fontSize?: number
  lineNumbers?: boolean
  wordWrap?: boolean
  minimap?: boolean
  recentVaults?: string[]
  lastOpenedNote?: string
  expandedFolders?: string[]
  openTabs?: { id: string; path?: string }[]
  pinnedTabs?: string[]
  activeId?: string
  windowBounds?: { width: number; height: number; x?: number; y?: number }
}
