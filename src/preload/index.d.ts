import { ElectronAPI } from '@electron-toolkit/preload'

type NoteMeta = {
  id: string
  title: string
  updatedAt: number
  path?: string
  type?: 'note' | 'folder'
  children?: NoteMeta[]
  collapsed?: boolean
}

type TreeItem = NoteMeta

type NotePayload = NoteMeta & {
  content: string
}

type VaultInfo = {
  path: string
  name: string
  changed?: boolean
}

type AppSettings = {
  vaultPath?: string
  theme?: string
  autoSave?: boolean
  autoSaveDelay?: number
  fontSize?: number
  lineNumbers?: boolean
  wordWrap?: boolean
  minimap?: boolean
  recentVaults?: string[]
  lastOpenedNote?: string
  expandedFolders?: string[]
  windowBounds?: { width: number; height: number; x?: number; y?: number }
}

type WindowApi = {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  unmaximize: () => Promise<void>
  isMaximized: () => Promise<boolean>
  close: () => Promise<void>
}

type NoteApi = {
  listNotes: () => Promise<TreeItem[]>
  loadNote: (id: string, path?: string) => Promise<NotePayload | null>
  createNote: (title?: string, path?: string) => Promise<NoteMeta>
  saveNote: (payload: NotePayload) => Promise<NoteMeta>
  deleteNote: (id: string, path?: string) => Promise<{ id: string }>
  moveNote: (id: string, fromPath?: string, toPath?: string) => Promise<NoteMeta>
  importNote: (filePath: string, folderPath?: string) => Promise<NoteMeta>
  saveAsset: (buffer: ArrayBuffer, name: string) => Promise<string>
  createFolder: (name: string, parentPath?: string) => Promise<{ name: string; path: string }>
  renameFolder: (path: string, newName: string) => Promise<{ path: string }> 
  deleteFolder: (path: string) => Promise<{ path: string }>
  moveFolder: (sourcePath: string, targetPath: string) => Promise<{ path: string }>
  searchNotes: (query: string) => Promise<NoteMeta[]>
  getBacklinks: (id: string) => Promise<string[]>
  getGraph: () => Promise<{ links: { source: string; target: string }[] }>
  getVault: () => Promise<VaultInfo>
  chooseVault: () => Promise<VaultInfo>
  setVault: (dir: string) => Promise<VaultInfo>
  revealVault: () => Promise<void>
  getSettings: () => Promise<AppSettings>
  updateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>
  resetSettings: () => Promise<AppSettings>
  window: WindowApi
  onVaultChanged: (callback: (data: any) => void) => () => void
  onNoteOpened: (callback: (id: string) => void) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: NoteApi
  }
}
