import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import icon from '../../resources/icon.png?asset'

import { vault } from './vault'
import type { NotePayload } from './vault'

let mainWindowRef: BrowserWindow | null = null
const settingsFile = join(app.getPath('userData'), 'settings.json')

type Settings = {
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

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  autoSave: true,
  autoSaveDelay: 800,
  fontSize: 14,
  lineNumbers: true,
  wordWrap: true,
  minimap: false,
  recentVaults: [],
  expandedFolders: []
}

function loadSettings(): Settings {
  try {
    if (!existsSync(settingsFile)) {
      saveSettings(DEFAULT_SETTINGS)
      return { ...DEFAULT_SETTINGS }
    }
    
    const raw = readFileSync(settingsFile, 'utf-8')
    const loaded = JSON.parse(raw) as Partial<Settings>
    const merged: Settings = { ...DEFAULT_SETTINGS, ...loaded }
    
    if (merged.autoSaveDelay && (merged.autoSaveDelay < 100 || merged.autoSaveDelay > 5000)) {
      merged.autoSaveDelay = DEFAULT_SETTINGS.autoSaveDelay
    }
    
    if (merged.fontSize && (merged.fontSize < 8 || merged.fontSize > 32)) {
      merged.fontSize = DEFAULT_SETTINGS.fontSize
    }
    
    if (!merged.recentVaults) merged.recentVaults = []
    if (!merged.expandedFolders) merged.expandedFolders = []
    
    return merged
  } catch (error) {
    console.warn('Failed to read settings, using defaults', error)
    saveSettings(DEFAULT_SETTINGS)
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: Settings): void {
  try {
    writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to save settings', error)
  }
}

function updateSettings(updates: Partial<Settings>): Settings {
  const current = loadSettings()
  const updated = { ...current, ...updates }
  saveSettings(updated)
  return updated
}

function addRecentVault(path: string): void {
  const settings = loadSettings()
  const recents = settings.recentVaults || []
  const filtered = recents.filter((p) => p !== path)
  settings.recentVaults = [path, ...filtered].slice(0, 10)
  saveSettings(settings)
}

function isValidVaultPath(path: string): boolean {
  if (!path || path.trim().length === 0) return false
  try {
    return existsSync(path)
  } catch {
    return false
  }
}

function migrateVaultContent(oldPath: string, newPath: string) {
    if (!existsSync(oldPath)) return
    if (!existsSync(newPath)) {
        try {
            mkdirSync(newPath, { recursive: true })
        } catch (e) {
             console.error('Failed to create new vault dir', e)
             return
        }
    }
    
    try {
        const files = readdirSync(newPath)
        if (files.length > 0) {
            console.warn('Target vault not empty, skipping migration')
            return
        }
        console.log(`Migrating vault from ${oldPath} to ${newPath}`)
        cpSync(oldPath, newPath, { recursive: true })
    } catch (err) {
        console.error('Migration failed:', err)
    }
}

function resolveVaultPath(): string {
  const settings = loadSettings()
  const defaultPath = join(app.getPath('documents'), 'KnowledgeHub')
  const oldDefault = join(app.getPath('userData'), 'notes')
  
  if (settings.vaultPath === oldDefault) {
      migrateVaultContent(oldDefault, defaultPath)
      settings.vaultPath = undefined
      saveSettings(settings)
  }
  
  if (settings.vaultPath && isValidVaultPath(settings.vaultPath)) {
    return settings.vaultPath
  }
  
  if (!existsSync(defaultPath)) {
      try {
          mkdirSync(defaultPath, { recursive: true })
      } catch (e) {
          console.error('Failed to create default notes dir', e)
      }
  }

  if (settings.vaultPath && settings.vaultPath !== defaultPath) {
    settings.vaultPath = undefined
    saveSettings(settings)
  }
  
  return defaultPath
}

async function ensureVault() {
    if (vault.getRootPath()) return
    const path = resolveVaultPath()
    await vault.setVaultPath(path)
}

async function chooseVault(): Promise<{ path: string; name: string; changed: boolean }> {
  const currentPath = vault.getRootPath() || resolveVaultPath()
  const result = await dialog.showOpenDialog({
    title: 'Select Knowledge Hub Vault',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: currentPath,
    buttonLabel: 'Select Vault'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { path: currentPath, name: basename(currentPath) || 'Vault', changed: false }
  }

  const selected = result.filePaths[0]
  if (selected === currentPath) {
    return { path: selected, name: basename(selected), changed: false }
  }
  
  try {
    await vault.setVaultPath(selected)
    updateSettings({ vaultPath: selected })
    addRecentVault(selected)
    return { path: selected, name: basename(selected), changed: true }
  } catch (error) {
    throw new Error(`Cannot use selected folder: ${(error as Error).message}`)
  }
}

function getVaultRoot() {
  const root = vault.getRootPath()
  if (!root) throw new Error('Vault not open')
  return root
}

function createWindow(): void {
  const settings = loadSettings()
  const bounds = settings.windowBounds || { width: 1200, height: 800 }
  
  const mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindowRef = mainWindow
  
  let boundsTimeout: NodeJS.Timeout
  mainWindow.on('resize', () => {
    clearTimeout(boundsTimeout)
    boundsTimeout = setTimeout(() => {
      const bounds = mainWindow.getBounds()
      updateSettings({ windowBounds: bounds })
    }, 500)
  })
  
  mainWindow.on('move', () => {
    clearTimeout(boundsTimeout)
    boundsTimeout = setTimeout(() => {
      const bounds = mainWindow.getBounds()
      updateSettings({ windowBounds: bounds })
    }, 500)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    vault.setMainWindow(mainWindow)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('notes:list', async () => vault.getNotes())
  ipcMain.handle('notes:load', async (_event, id: string) => vault.getNote(id))
  ipcMain.handle('notes:create', async (_event, title?: string, path?: string) => {
    await ensureVault()
    return vault.createNote(title || 'Untitled', path)
  })
  ipcMain.handle('notes:save', async (_event, payload: NotePayload) => {
     await ensureVault()
     return vault.saveNote(payload.id, payload.content, payload.title)
  })
  ipcMain.handle('notes:delete', async (_event, id: string) => {
    await ensureVault()
    await vault.deleteNote(id)
    return { id }
  })
  ipcMain.handle('notes:move', async (_event, id: string, fromPath?: string, toPath?: string) => {
    await ensureVault()
    return vault.moveNote(id, fromPath, toPath) 
  })
  ipcMain.handle('notes:rename', async (_event, id: string, newId: string, path?: string) => {
    await ensureVault()
    const newName = await vault.renameNote(id, newId, path)
    const note = await vault.getNote(newName)
    return note
  })
  ipcMain.handle('notes:import', async (_event, filePath: string, folderPath?: string) => {
    await ensureVault()
    return vault.importNote(filePath, folderPath)
  })
  ipcMain.handle('folder:create', async (_event, name: string, parentPath?: string) => {
    await ensureVault()
    return vault.createFolder(name, parentPath)
  })
  ipcMain.handle('folder:delete', async (_event, path: string) => {
    await ensureVault()
    await vault.deleteFolder(path)
    return { path }
  })
  ipcMain.handle('folder:rename', async (_event, path: string, newName: string) => {
    await ensureVault()
    return vault.renameFolder(path, newName)
  })
  ipcMain.handle('folder:move', async (_event, sourcePath: string, targetPath: string) => {
    await ensureVault()
    return vault.moveFolder(sourcePath, targetPath)
  })

  ipcMain.handle('vault:get', async () => {
    const path = vault.getRootPath() || resolveVaultPath()
    return { path, name: basename(path) }
  })
  
  ipcMain.handle('vault:reveal', async () => {
      let root = vault.getRootPath()
      if (!root) root = resolveVaultPath()
      if (root && existsSync(root)) await shell.openPath(root)
  })
  
  ipcMain.handle('vault:choose', async () => {
    try {
      return await chooseVault()
    } catch (error) {
      console.error('Vault selection error:', error)
      throw error
    }
  })
  
  ipcMain.handle('vault:set', async (_event, dir: string) => {
    try {
      await vault.setVaultPath(dir)
      updateSettings({ vaultPath: dir })
      addRecentVault(dir)
      return { path: dir, name: basename(dir), changed: true }
    } catch (error) {
      console.error('Vault set error:', error)
      throw error
    }
  })
  
  ipcMain.handle('notes:search', async (_event, query: string) => vault.search(query))
  ipcMain.handle('notes:getBacklinks', async (_event, id: string) => vault.getBacklinks(id))
  ipcMain.handle('graph:get', async () => { return { links: vault.getAllLinks() } })
  
  ipcMain.handle('assets:save', async (_event, buffer: ArrayBuffer, name: string) => {
      const root = getVaultRoot()
      const assetsDir = join(root, 'assets')
      await mkdir(assetsDir, { recursive: true })
      const filePath = join(assetsDir, name)
      await writeFile(filePath, Buffer.from(buffer))
      return `assets/${name}`
  })

  ipcMain.handle('settings:get', async () => loadSettings())
  ipcMain.handle('settings:update', async (_event, updates: Partial<Settings>) => updateSettings(updates))
  ipcMain.handle('settings:reset', async () => {
      saveSettings(DEFAULT_SETTINGS)
      return DEFAULT_SETTINGS
  })

  ipcMain.handle('window:minimize', async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindowRef
    win?.minimize()
  })
  ipcMain.handle('window:maximize', async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindowRef
    win?.maximize()
  })
  ipcMain.handle('window:unmaximize', async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindowRef
    win?.unmaximize()
  })
  ipcMain.handle('window:isMaximized', async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindowRef
    return win?.isMaximized()
  })
  ipcMain.handle('window:close', async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindowRef
    win?.close()
  })

  try {
     const savedPath = resolveVaultPath()
     await vault.setVaultPath(savedPath)
  } catch (err) {
      console.error('Failed to initialize vault:', err)
  }

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
