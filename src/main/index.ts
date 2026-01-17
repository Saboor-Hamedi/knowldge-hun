// --- App Update Integration ---
import { setupUpdateApp } from '../renderer/src/components/updateApp/updateApp'
import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, dirname } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { version } from '../../package.json'
import icon from '../../resources/icon.ico?asset'
import { vault } from './vault'
import type { NotePayload } from './vault'
import { loadSettings, saveSettings, updateSettings, DEFAULT_SETTINGS, type Settings } from './settings'

let mainWindowRef: BrowserWindow | null = null

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

function migrateVaultContent(oldPath: string, newPath: string): void {
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

async function ensureVault(): Promise<void> {
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

function getVaultRoot(): string {
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
    icon, // Set icon for all platforms
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: true
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
    mainWindow.maximize()
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

  // Vault validation and location handlers
  ipcMain.handle('vault:validate', async (_event, path: string) => {
    const exists = isValidVaultPath(path)
    const settings = loadSettings()
    const recentVault = settings.recentVaults?.find(p => p === path)
    return {
      exists,
      lastOpened: recentVault ? Date.now() : undefined // Could track actual last opened time
    }
  })

  ipcMain.handle('vault:locate', async (_event, originalPath: string) => {
    if (!originalPath) {
      return { foundPath: null }
    }

    // If path exists, return it
    if (existsSync(originalPath)) {
      return { foundPath: originalPath }
    }

    // Phase 3: Smart Detection - Try to find vault by name in common locations
    const vaultName = basename(originalPath)
    if (!vaultName) {
      return { foundPath: null }
    }

    const commonLocations = [
      app.getPath('documents'),
      app.getPath('home'),
      join(app.getPath('home'), 'Documents'),
      join(app.getPath('home'), 'Desktop'),
      dirname(originalPath), // Check parent directory
      join(dirname(originalPath), '..'), // Check grandparent
    ]

    // Also check recent vaults for similar structure
    const settings = loadSettings()
    const recentPaths = settings.recentVaults || []
    for (const recentPath of recentPaths) {
      if (recentPath !== originalPath && existsSync(recentPath)) {
        const recentName = basename(recentPath)
        if (recentName === vaultName) {
          // Found a recent vault with the same name
          try {
            const files = readdirSync(recentPath, { recursive: true, withFileTypes: true })
            const hasNotes = files.some(f => f.isFile() && (f.name.endsWith('.md') || f.name.endsWith('.txt')))
            if (hasNotes) {
              return { foundPath: recentPath }
            }
          } catch {
            // Skip if can't read
          }
        }
      }
    }

    // Search common locations
    for (const basePath of commonLocations) {
      try {
        if (!existsSync(basePath)) continue

        const potentialPath = join(basePath, vaultName)
        if (existsSync(potentialPath)) {
          // Quick validation: check if it looks like a vault (has .md files)
          try {
            const files = readdirSync(potentialPath, { recursive: true, withFileTypes: true })
            const hasNotes = files.some(f => f.isFile() && (f.name.endsWith('.md') || f.name.endsWith('.txt')))
            if (hasNotes) {
              return { foundPath: potentialPath }
            }
          } catch {
            // Skip if can't read directory
          }
        }

        // Also check subdirectories (one level deep)
        try {
          const entries = readdirSync(basePath, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name === vaultName) {
              const subPath = join(basePath, entry.name)
              try {
                const files = readdirSync(subPath, { recursive: true, withFileTypes: true })
                const hasNotes = files.some(f => f.isFile() && (f.name.endsWith('.md') || f.name.endsWith('.txt')))
                if (hasNotes) {
                  return { foundPath: subPath }
                }
              } catch {
                // Skip if can't read
              }
            }
          }
        } catch {
          // Skip if can't read base path
        }
      } catch {
        // Skip inaccessible paths
      }
    }

    return { foundPath: null }
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

  // Expose app icon path to renderer
  ipcMain.handle('app:getIcon', async () => {
    return icon
  })
  // ipcMain.handle('app:getVersion', async () => {
  //   return app.getVersion()
  // })
  ipcMain.handle('app:getVersion', () => {
  return version
})

  try {
     const savedPath = resolveVaultPath()
     await vault.setVaultPath(savedPath)
  } catch (err) {
      console.error('Failed to initialize vault:', err)
  }

  createWindow()

  if (mainWindowRef) {
    setupUpdateApp(mainWindowRef)
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
