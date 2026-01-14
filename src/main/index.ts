import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, dirname, normalize } from 'path'
import { mkdir, readdir, readFile, rm, stat, writeFile, access, rename } from 'fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import icon from '../../resources/icon.png?asset'

type NoteMeta = {
  id: string
  title: string
  updatedAt: number
  path?: string // relative path from vault root
}

type NotePayload = NoteMeta & {
  content: string
}

type FolderItem = {
  id: string
  name: string
  type: 'folder'
  path: string
  children: (FolderItem | NoteMeta)[]
  collapsed?: boolean
}

const NOTE_EXTENSION = '.md'
let notesDir = ''
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
    
    // Merge with defaults to ensure all keys exist
    const merged: Settings = { ...DEFAULT_SETTINGS, ...loaded }
    
    // Validate and sanitize values
    if (merged.autoSaveDelay && (merged.autoSaveDelay < 100 || merged.autoSaveDelay > 5000)) {
      merged.autoSaveDelay = DEFAULT_SETTINGS.autoSaveDelay
    }
    
    if (merged.fontSize && (merged.fontSize < 8 || merged.fontSize > 32)) {
      merged.fontSize = DEFAULT_SETTINGS.fontSize
    }
    
    if (!merged.recentVaults) {
      merged.recentVaults = []
    }
    
    if (!merged.expandedFolders) {
      merged.expandedFolders = []
    }
    
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
  
  // Remove if already exists
  const filtered = recents.filter((p) => p !== path)
  
  // Add to front, limit to 10
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

function resolveVaultPath(): string {
  const settings = loadSettings()
  const defaultPath = join(app.getPath('userData'), 'notes')
  
  if (settings.vaultPath && isValidVaultPath(settings.vaultPath)) {
    return settings.vaultPath
  }
  
  // Fallback: clear invalid path and use default
  if (settings.vaultPath && settings.vaultPath !== defaultPath) {
    console.warn('Configured vault path invalid, falling back to default')
    settings.vaultPath = undefined
    saveSettings(settings)
  }
  
  return defaultPath
}

function getNotePath(id: string, relativePath?: string): string {
  if (relativePath) {
    return join(notesDir, relativePath, `${id}${NOTE_EXTENSION}`)
  }
  return join(notesDir, `${id}${NOTE_EXTENSION}`)
}

function extractTitleFromContent(content: string): string {
  // First check for HTML comment with title
  const commentMatch = content.match(/^<!--\s*(.+?)\s*-->/)
  if (commentMatch) {
    return commentMatch[1].trim()
  }
  
  // Fallback to first line H1
  const firstLine = content.split(/\r?\n/)[0] ?? ''
  const cleaned = firstLine.replace(/^#\s*/, '').trim()
  return cleaned.length > 0 ? cleaned : 'Untitled note'
}

function normalizeTitle(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim()
  return trimmed.length > 0 ? trimmed : 'Untitled note'
}

async function ensureNotesDir(): Promise<void> {
  if (!notesDir) {
    notesDir = resolveVaultPath()
  }
  await mkdir(notesDir, { recursive: true })
}

async function setVaultPath(dir: string): Promise<string> {
  if (!dir || dir.trim().length === 0) {
    throw new Error('Vault path cannot be empty')
  }
  
  if (!existsSync(dir)) {
    throw new Error('Selected folder does not exist')
  }
  
  notesDir = dir
  
  updateSettings({ vaultPath: dir })
  addRecentVault(dir)
  
  try {
    await ensureNotesDir()
  } catch (error) {
    throw new Error(`Failed to access vault folder: ${(error as Error).message}`)
  }
  
  return notesDir
}

async function chooseVault(): Promise<{ path: string; name: string; changed: boolean }> {
  const currentPath = notesDir || resolveVaultPath()
  
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
  
  // No change if same folder selected
  if (selected === currentPath) {
    return { path: selected, name: basename(selected), changed: false }
  }
  
  try {
    await setVaultPath(selected)
    return { path: selected, name: basename(selected), changed: true }
  } catch (error) {
    throw new Error(`Cannot use selected folder: ${(error as Error).message}`)
  }
}

async function scanFolder(
  folderPath: string,
  relativePath = ''
): Promise<(FolderItem | NoteMeta)[]> {
  const items: (FolderItem | NoteMeta)[] = []
  
  try {
    const entries = await readdir(folderPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(folderPath, entry.name)
      const stats = await stat(fullPath)

      if (stats.isDirectory()) {
          const subPath = relativePath ? join(relativePath, entry.name) : entry.name
          const children = await scanFolder(fullPath, subPath)
          items.push({
            id: `folder-${subPath.replace(/[\\/]/g, '-')}`,
            name: entry.name,
            type: 'folder',
            path: subPath,
            children,
            collapsed: false
          })
      } else if (stats.isFile() && entry.name.endsWith(NOTE_EXTENSION)) {
          const id = entry.name.slice(0, -NOTE_EXTENSION.length)
          const content = await readFile(fullPath, 'utf-8')
          items.push({
            id,
            title: extractTitleFromContent(content),
            updatedAt: stats.mtimeMs,
            path: relativePath || undefined
          })
      }
    }
  } catch (error) {
    console.error('Error scanning folder:', folderPath, error)
  }
  
  return items
}

async function listNotes(): Promise<(FolderItem | NoteMeta)[]> {
  await ensureNotesDir()
  return await scanFolder(notesDir)
}

async function loadNote(id: string, relativePath?: string): Promise<NotePayload | null> {
  await ensureNotesDir()
  const fullPath = getNotePath(id, relativePath)
  if (!existsSync(fullPath)) return null

  const stats = await stat(fullPath)
  if (!stats.isFile()) {
    console.warn(`[Main] Requested note ${fullPath} is not a file (EISDIR safety).`)
    return null
  }

  const rawContent = await readFile(fullPath, 'utf-8')
  
  // Strip title comment if present
  const content = rawContent.replace(/^<!--\s*.+?\s*-->\n?/, '')
  
  return {
    id,
    title: extractTitleFromContent(rawContent),
    content,
    updatedAt: stats.mtimeMs,
    path: relativePath
  }
}

async function updateBacklinks(oldId: string, newId: string): Promise<void> {
    console.log(`[Main] updateBacklinks: "${oldId}" -> "${newId}"`);
    await ensureNotesDir();
    
    let processedCount = 0;
    let updatedCount = 0;

    async function processDirectory(dirPath: string): Promise<void> {
        const entries = await readdir(dirPath);
        for (const entryName of entries) {
            const fullPath = join(dirPath, entryName);
            try {
                const stats = await stat(fullPath);
                if (stats.isDirectory()) {
                    await processDirectory(fullPath);
                } else if (stats.isFile() && entryName.endsWith(NOTE_EXTENSION)) {
                    processedCount++;
                    let content = await readFile(fullPath, 'utf-8');
                    
                    const escapedOld = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`\\[\\[${escapedOld}(\\|.*?)?\\]\\]`, 'g');
                    
                    if (regex.test(content)) {
                        console.log(`[Main] Updating links in: ${fullPath}`);
                        content = content.replace(regex, (_match, alias) => {
                            return `[[${newId}${alias || ''}]]`;
                        });
                        await writeFile(fullPath, content, 'utf-8');
                        updatedCount++;
                    }
                }
            } catch (e) {
                console.warn(`[Main] Skipping "${fullPath}" during link update:`, (e as any).message);
            }
        }
    }

    try {
        await processDirectory(notesDir);
        console.log(`[Main] Backlink update complete. Scanned ${processedCount} notes, updated ${updatedCount} links.`);
    } catch (error) {
        console.error('[Main] Critical error during updateBacklinks:', error);
    }
}



async function saveNote(payload: NotePayload): Promise<NoteMeta> {
  const title = normalizeTitle(payload.title)
  await ensureNotesDir()
  
  const fullPath = getNotePath(payload.id, payload.path)
  const dir = join(fullPath, '..')
  await mkdir(dir, { recursive: true })
  
  // Prepend title as HTML comment so it can be extracted on load
  const contentWithTitle = `<!-- ${title} -->\n${payload.content}`
  
  await writeFile(fullPath, contentWithTitle, 'utf-8')
  const stats = await stat(fullPath)
  return { id: payload.id, title, updatedAt: stats.mtimeMs, path: payload.path }
}

async function createNote(title?: string, relativePath?: string): Promise<NoteMeta> {
  const safeTitle = normalizeTitle(title)
  
  // Use sanitized title as ID (filename) if provided, otherwise UUID
  // This ensures [[My Note]] creates "My Note.md"
  const shouldUseTitle = safeTitle !== 'Untitled note'
  const id = shouldUseTitle ? safeTitle.replace(/[<>:"/\\|?*]/g, '-') : randomUUID()

  const content = shouldUseTitle ? `<!-- ${safeTitle} -->\n` : ''
  await ensureNotesDir()
  
  const fullPath = getNotePath(id, relativePath)
  const dir = join(fullPath, '..')
  await mkdir(dir, { recursive: true })
  
  // Check if exists to prevent overwrite?
  // For now default to overwrite or handle gracefully? 
  // If we overwrite, we lose data. Better to append number?
  // Given user request "must save automatically set the name", implying creation.
  // If exists, existing content is overwritten which is bad.
  // Implementation of append number:
  
  let finalPath = fullPath
  let finalId = id
  let counter = 1
  while (existsSync(finalPath)) {
      finalId = `${id} ${counter}`
      finalPath = getNotePath(finalId, relativePath)
      counter++
  }

  await writeFile(finalPath, content, 'utf-8')
  const stats = await stat(finalPath)
  return { id: finalId, title: safeTitle, updatedAt: stats.mtimeMs, path: relativePath }
}

async function deleteNote(id: string, relativePath?: string): Promise<void> {
  await ensureNotesDir()
  await rm(getNotePath(id, relativePath), { force: true })
}

async function createFolder(
  name: string,
  parentPath = ''
): Promise<{ name: string; path: string }> {
  await ensureNotesDir()
  const folderPath = parentPath ? join(notesDir, parentPath, name) : join(notesDir, name)
  // Guard: prevent duplicate folders
  if (existsSync(folderPath)) {
    throw new Error('Folder already exists')
  }
  await mkdir(folderPath, { recursive: true })
  const relativePath = parentPath ? join(parentPath, name) : name
  return { name, path: relativePath }
}

async function deleteFolder(relativePath: string): Promise<void> {
  await ensureNotesDir()
  const folderPath = join(notesDir, relativePath)
  await rm(folderPath, { recursive: true, force: true })
}

async function renameFolder(path: string, newName: string): Promise<{ path: string }> {
  await ensureNotesDir()
  const sourceFullPath = join(notesDir, path)
  
  // Calculate new path relative to parent
  const parent = dirname(path)
  // dirname of "A" is "."
  let newPath = ''
  if (parent === '.' || parent === '') {
      newPath = newName
  } else {
      newPath = join(parent, newName)
  }
  
  const targetFullPath = join(notesDir, newPath)
  
  if (path === newPath) return { path }
  
  // Check if target exists
  try {
      await access(targetFullPath)
      throw new Error('Folder already exists') 
  } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
  }

  await rename(sourceFullPath, targetFullPath)
  return { path: newPath }
}

async function moveFolder(sourcePath: string, targetPath: string): Promise<{ path: string }> {
  await ensureNotesDir()

  const sourceFullPath = join(notesDir, sourcePath)
  const targetFullPath = join(notesDir, targetPath)
  
  // RENAME LOGIC:
  // If targetPath does NOT end with source folder name, and we are just renaming in place (same parent),
  // then we should just rename.
  // Actually, let's create a specific renameFolder function to avoid ambiguity.
  // But strictly staying in this function:
  
  // Get folder name from source path
  const folderName = basename(sourcePath)
  const newFolderPath = join(targetFullPath, folderName)

  // Check if source and target are the same
  if (sourceFullPath === newFolderPath) {
    return { path: join(targetPath, folderName) }
  }

  // Ensure target parent directory exists
  await mkdir(dirname(newFolderPath), { recursive: true })

  // Manual recursive copy then delete
  const copyDir = async (src: string, dst: string): Promise<void> => {

    await mkdir(dst, { recursive: true })
    const files = await readdir(src)

    for (const file of files) {
      const srcFile = join(src, file)
      const dstFile = join(dst, file)
      const stats = await stat(srcFile)

      if (stats.isDirectory()) {
        await copyDir(srcFile, dstFile)
      } else {
        await writeFile(dstFile, await readFile(srcFile))
      }
    }
  }

  await copyDir(sourceFullPath, newFolderPath)
  await rm(sourceFullPath, { recursive: true, force: true })

  return { path: join(targetPath, folderName) }
}

async function renameNote(
  oldId: string,
  newId: string,
  relativePath: string | undefined
): Promise<NoteMeta> {
  await ensureNotesDir()
  
  const oldPath = getNotePath(oldId, relativePath)
  const newPath = getNotePath(newId, relativePath)
  
  const oldStats = await stat(oldPath)
  if (!oldStats.isFile()) {
      throw new Error(`Cannot rename "${oldId}": it is a directory.`)
  }
  if (oldPath === newPath) {
    const stats = await stat(oldPath)
    const content = await readFile(oldPath, 'utf-8')
    return { id: oldId, title: extractTitleFromContent(content), updatedAt: stats.mtimeMs, path: relativePath }
  }

  if (existsSync(newPath)) {
      throw new Error(`A note with the name "${newId}" already exists in this folder.`)
  }
  
  await rename(oldPath, newPath)
  
  // Update title comment in content
  let content = await readFile(newPath, 'utf-8')
  const newComment = `<!-- ${newId} -->`
  const hasComment = content.startsWith('<!--')
  
  if (hasComment) {
      content = content.replace(/^<!--\s*.+?\s*-->/, newComment)
  } else {
      content = `${newComment}\n${content}`
  }
  
  await writeFile(newPath, content, 'utf-8')
  
  const stats = await stat(newPath)
  
  return { 
    id: newId, 
    title: newId, // Use newId as title
    updatedAt: stats.mtimeMs, 
    path: relativePath 
  }
}

async function moveNote(
  id: string,
  fromPath: string | undefined,
  toPath: string | undefined
): Promise<NoteMeta> {
  await ensureNotesDir()
  
  const oldPath = getNotePath(id, fromPath)
  const newPath = getNotePath(id, toPath)
  
  if (oldPath === newPath) {
    const stats = await stat(oldPath)
    const content = await readFile(oldPath, 'utf-8')
    return { id, title: extractTitleFromContent(content), updatedAt: stats.mtimeMs, path: toPath }
  }
  
  const newDir = join(newPath, '..')
  await mkdir(newDir, { recursive: true })
  
  const content = await readFile(oldPath, 'utf-8')
  await writeFile(newPath, content, 'utf-8')
  await rm(oldPath, { force: true })
  
  const stats = await stat(newPath)
  return { id, title: extractTitleFromContent(content), updatedAt: stats.mtimeMs, path: toPath }
}

async function importNote(externalFilePath: string, folderPath?: string): Promise<NoteMeta> {
  const normalizedPath = normalize(externalFilePath)

  // Verify file exists before trying to read
  // This prevents ENOENT crashes if the path is malformed or file was moved
  if (!existsSync(normalizedPath)) {
    throw new Error(`File not found: ${normalizedPath}`)
  }

  await ensureNotesDir()
  
  // Read the external file
  const content = await readFile(normalizedPath, 'utf-8')
  
  // Create a proper ID instead of relying on filename (since filename might conflict)
  // But wait, the system relies on ID == Filename for some reason in getNotePath?
  // getNotePath(id, path) uses `join(notesDir, path || '', `${id}${NOTE_EXTENSION}`)`
  // So yes, ID must match filename logic.
  
  const fileName = basename(externalFilePath)
  // const ext = fileName.match(/\.[^.]+$/)?.[0] || ''
  
  // If dragging .txt, convert to .md but keep original name content?
  // Or just create a new ID if it conflicts?
  // Current logic: fileName = nameWithoutExt + NOTE_EXTENSION
  
  let nameWithoutExt = fileName.replace(/\.[^.]+$/, '')
  let id = nameWithoutExt
  let targetFileName = id + NOTE_EXTENSION
  let targetPath = folderPath ? join(notesDir, folderPath, targetFileName) : join(notesDir, targetFileName)
  
  // If file exists, try appending a number
  let counter = 1
  while (existsSync(targetPath)) {
      id = `${nameWithoutExt} ${counter}`
      targetFileName = id + NOTE_EXTENSION
      targetPath = folderPath ? join(notesDir, folderPath, targetFileName) : join(notesDir, targetFileName)
      counter++
  }
  
  // Ensure directory exists
  await mkdir(dirname(targetPath), { recursive: true })
  
  // Write the file
  await writeFile(targetPath, content, 'utf-8')
  
  // Get stats
  const stats = await stat(targetPath)
  
  return {
    id,
    title: extractTitleFromContent(content),
    updatedAt: stats.mtimeMs,
    path: folderPath
  }
}

function createWindow(): void {
  const settings = loadSettings()
  const bounds = settings.windowBounds || { width: 1200, height: 800 }
  
  // Create the browser window.
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
  
  // Save window bounds on resize/move
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
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('notes:list', async () => listNotes())
  ipcMain.handle('notes:load', async (_event, id: string, path?: string) => loadNote(id, path))
  ipcMain.handle('notes:create', async (_event, title?: string, path?: string) =>
    createNote(title, path)
  )
  ipcMain.handle('notes:save', async (_event, payload: NotePayload) => saveNote(payload))
  ipcMain.handle('notes:delete', async (_event, id: string, path?: string) => {
    await deleteNote(id, path)
    return { id }
  })
  ipcMain.handle('notes:move', async (_event, id: string, fromPath?: string, toPath?: string) =>
    moveNote(id, fromPath, toPath)
  )
  ipcMain.handle('notes:rename', async (_event, id: string, newId: string, path?: string) =>
    renameNote(id, newId, path)
  )
  ipcMain.handle('notes:import', async (_event, filePath: string, folderPath?: string) =>
    importNote(filePath, folderPath)
  )
  ipcMain.handle('assets:save', async (_event, buffer: ArrayBuffer, name: string) => {
      await ensureNotesDir()
      const assetsDir = join(notesDir, 'assets')
      await mkdir(assetsDir, { recursive: true })
      
      const fileName = `${name}` 
      // Ensure unique name?
      // For now client provides timestamp
      
      const filePath = join(assetsDir, fileName)
      await writeFile(filePath, Buffer.from(buffer))
      return `assets/${fileName}`
  })
  ipcMain.handle('folder:create', async (_event, name: string, parentPath?: string) =>
    createFolder(name, parentPath)
  )
  ipcMain.handle('folder:delete', async (_event, path: string) => {
    await deleteFolder(path)
    return { path }
  })
  ipcMain.handle('folder:rename', async (_event, path: string, newName: string) => {
      const res = await renameFolder(path, newName)
      return res
  })
  ipcMain.handle('folder:move', async (_event, sourcePath: string, targetPath: string) =>
    moveFolder(sourcePath, targetPath)
  )
  ipcMain.handle('vault:get', async () => {
    const path = notesDir || resolveVaultPath()
    return { path, name: basename(path) }
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
      const path = await setVaultPath(dir)
      return { path, name: basename(path), changed: true }
    } catch (error) {
      console.error('Vault set error:', error)
      throw error
    }
  })
  
  ipcMain.handle('settings:get', async () => loadSettings())
  ipcMain.handle('settings:update', async (_event, updates: Partial<Settings>) =>
    updateSettings(updates)
  )
  ipcMain.handle('settings:reset', async () => {
    saveSettings(DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  })

  // Window control IPC
  ipcMain.handle('window:minimize', () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindowRef
    win?.minimize()
  })
  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindowRef
    if (win && !win.isMaximized()) win.maximize()
  })
  ipcMain.handle('window:unmaximize', () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindowRef
    if (win && win.isMaximized()) win.unmaximize()
  })
  ipcMain.handle('window:isMaximized', () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindowRef
    return win?.isMaximized() || false
  })
  ipcMain.handle('window:close', () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindowRef
    win?.close()
  })

  ipcMain.handle('notes:rename-links', async (_event, oldId: string, newId: string) => 
     updateBacklinks(oldId, newId)
  )

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
