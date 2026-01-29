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
  recentProjects?: { name: string; path: string }[]
  cursorPositions: Map<string, { lineNumber: number; column: number }>
  isLoading: boolean
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
  openTabs?: { id: string; path?: string; title?: string }[]
  pinnedTabs?: string[]
  activeId?: string
  activeView?: 'notes' | 'search' | 'settings'
  windowBounds?: { width: number; height: number; x?: number; y?: number }
  deepseekApiKey?: string
  openaiApiKey?: string
  claudeApiKey?: string
  grokApiKey?: string
  ollamaBaseUrl?: string
  aiProvider?: 'deepseek' | 'openai' | 'claude' | 'grok' | 'ollama'
  aiModel?: string
  gistToken?: string
  gistId?: string
  rightPanelWidth?: number
  rightPanelVisible?: boolean
  passwordHash?: string | null
  activeSettingsSection?: string
  // Caret settings
  caretEnabled?: boolean
  caretMaxWidth?: number
  cursorPositions?: Record<string, { lineNumber: number; column: number }>
  graphTheme?: string
  // Security & Lock screen settings
  fireWall?: {
    passwordHash?: string | null
    lockScreenAlignment?: 'left' | 'center' | 'right'
    lockScreenName?: string
  }
}
