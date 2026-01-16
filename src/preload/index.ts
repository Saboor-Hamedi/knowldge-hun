import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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

// Custom APIs for renderer
type VaultInfo = {
  path: string
  name: string
  changed?: boolean
}

type AppSettings = {
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
  activeId?: string
  windowBounds?: { width: number; height: number; x?: number; y?: number }
}

const api = {
    requestUpdate: (): void => {
      ipcRenderer.send('app:update');
    },
  listNotes: (): Promise<TreeItem[]> => ipcRenderer.invoke('notes:list'),
  loadNote: (id: string, path?: string): Promise<NotePayload | null> =>
    ipcRenderer.invoke('notes:load', id, path),
  createNote: (title?: string, path?: string): Promise<NoteMeta> =>
    ipcRenderer.invoke('notes:create', title, path),
  saveNote: (payload: NotePayload): Promise<NoteMeta> => ipcRenderer.invoke('notes:save', payload),
  deleteNote: (id: string, path?: string): Promise<{ id: string }> =>
    ipcRenderer.invoke('notes:delete', id, path),
  moveNote: (id: string, fromPath?: string, toPath?: string): Promise<NoteMeta> =>
    ipcRenderer.invoke('notes:move', id, fromPath, toPath),
  renameNote: (id: string, newId: string, path?: string): Promise<NoteMeta> =>
    ipcRenderer.invoke('notes:rename', id, newId, path),
  importNote: (filePath: string, folderPath?: string): Promise<NoteMeta> =>
    ipcRenderer.invoke('notes:import', filePath, folderPath),
  saveAsset: (buffer: ArrayBuffer, name: string): Promise<string> =>
    ipcRenderer.invoke('assets:save', buffer, name),
  createFolder: (name: string, parentPath?: string): Promise<{ name: string; path: string }> =>
    ipcRenderer.invoke('folder:create', name, parentPath),

  deleteFolder: (path: string): Promise<{ path: string }> =>
    ipcRenderer.invoke('folder:delete', path),
  renameFolder: (path: string, newName: string): Promise<{ path: string }> =>
    ipcRenderer.invoke('folder:rename', path, newName),
  moveFolder: (sourcePath: string, targetPath: string): Promise<{ path: string }> =>
    ipcRenderer.invoke('folder:move', sourcePath, targetPath),
  getVault: (): Promise<VaultInfo> => ipcRenderer.invoke('vault:get'),
  chooseVault: (): Promise<VaultInfo> => ipcRenderer.invoke('vault:choose'),
  setVault: (dir: string): Promise<VaultInfo> => ipcRenderer.invoke('vault:set', dir),
  revealVault: (): Promise<void> => ipcRenderer.invoke('vault:reveal'),

  
  searchNotes: (query: string): Promise<NoteMeta[]> => ipcRenderer.invoke('notes:search', query),
  getBacklinks: (id: string): Promise<string[]> => ipcRenderer.invoke('notes:getBacklinks', id),
  getGraph: (): Promise<{ links: { source: string; target: string }[] }> => ipcRenderer.invoke('graph:get'),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (updates: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', updates),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset'),
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    unmaximize: (): Promise<void> => ipcRenderer.invoke('window:unmaximize'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close')
  },
  getAppIcon: (): Promise<string> => ipcRenderer.invoke('app:getIcon'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  onVaultChanged: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('vault:changed', subscription)
    return () => ipcRenderer.removeListener('vault:changed', subscription)
  },
  onNoteOpened: (_callback: (id: string) => void) => {} // Unused but maybe needed for typing
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
