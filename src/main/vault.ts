import { join, basename, relative, dirname, normalize } from 'path'
import { readFile, writeFile, rm, rename, stat, readdir, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { watch } from 'chokidar'
import type { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'

export type NoteMeta = {
  id: string
  title: string
  updatedAt: number
  path?: string // relative path from vault root
  type?: 'note' | 'folder'
  children?: NoteMeta[]
  collapsed?: boolean
}

export type NotePayload = NoteMeta & {
  content: string
}

export type FileChange = {
  event: 'add' | 'change' | 'unlink'
  path: string
}

const NOTE_EXTENSIONS = ['.md', '.txt']

export class VaultManager {
  private rootPath: string = ''
  private watcher: FSWatcher | null = null
  private mainWindow: BrowserWindow | null = null
  
  // In-memory cache
  private notes = new Map<string, NoteMeta>()
  private folders = new Set<string>()
  private links = new Map<string, Set<string>>() // Source -> Targets
  private backlinks = new Map<string, Set<string>>() // Target -> Sources
  
  constructor() {}                                                                            

  public setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  public getRootPath(): string {
    return this.rootPath
  }

  public async setVaultPath(path: string) {
    if (!path || !existsSync(path)) {
      throw new Error(`Invalid vault path: ${path}`)
    }
    this.rootPath = path
    this.notes.clear()
    this.folders.clear()
    this.links.clear()
    this.backlinks.clear()
    
    await this.startWatcher()
    await this.initialScan()
  }

  private async initialScan() {
    console.log('[Vault] Starting initial scan...')
    await this.scanDirectory(this.rootPath)
  }

  private async scanDirectory(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.name.startsWith('.')) continue // Skip hidden
      
      if (entry.isDirectory()) {
        const relPath = relative(this.rootPath, fullPath)
        const normalizedPath = relPath.replace(/\\/g, '/')
        this.folders.add(normalizedPath)
        await this.scanDirectory(fullPath)
      } else if (entry.isFile() && this.isNoteFile(entry.name)) {
        await this.indexFile(fullPath)
      }
    }
  }

  private isNoteFile(filename: string): boolean {
    const lower = filename.toLowerCase()
    return NOTE_EXTENSIONS.some(ext => lower.endsWith(ext))
  }

  private async indexFile(fullPath: string) {
    try {
      const content = await readFile(fullPath, 'utf-8')
      const stats = await stat(fullPath)
      const relPath = relative(this.rootPath, fullPath)
      const normalizedPath = relPath.replace(/\\/g, '/')
      const id = this.getIdFromPath(normalizedPath)
      
      // Extract directory path (without filename)
      const dirPath = dirname(normalizedPath)
      const relativeDir = dirPath === '.' ? '' : dirPath
      
      const meta: NoteMeta = {
        id,
        title: this.extractTitle(content, id),
        updatedAt: stats.mtimeMs,
        path: relativeDir, 
        type: 'note'
      }
      
      this.notes.set(id, meta)
      this.updateLinks(id, content)
    } catch (err) {
      console.error(`[Vault] Failed to index ${fullPath}`, err)
    }
  }

  private async startWatcher() {
    if (this.watcher) await this.watcher.close()
    
    this.watcher = watch(this.rootPath, {
      ignored: /(^|[\/\\])\../, // ignore hidden files
      persistent: true,
      ignoreInitial: true 
    })

    this.watcher.on('add', (path) => this.handleFileChange('add', path))
    this.watcher.on('change', (path) => this.handleFileChange('change', path))
    this.watcher.on('unlink', (path) => this.handleFileChange('unlink', path))
    this.watcher.on('addDir', (path) => this.handleDirChange('add', path))
    this.watcher.on('unlinkDir', (path) => this.handleDirChange('unlink', path))
    
    console.log('[Vault] Watcher started')
  }

  private async handleFileChange(event: 'add' | 'change' | 'unlink', fullPath: string) {
    if (!this.isNoteFile(fullPath)) return
    
    console.log(`[Vault] File ${event}: ${fullPath}`)
    const relativePath = relative(this.rootPath, fullPath)
    const id = this.getIdFromPath(relativePath)

    if (event === 'unlink') {
      this.notes.delete(id)
      this.removeLinks(id)
    } else {
      await this.indexFile(fullPath)
    }

    // Notify Frontend
    this.mainWindow?.webContents.send('vault-changed', {
      event,
      id,
      meta: this.notes.get(id)
    })
  }

  private async handleDirChange(event: 'add' | 'unlink', fullPath: string) {
      const relPath = relative(this.rootPath, fullPath)
      const normalizedPath = relPath.replace(/\\/g, '/')
      
      if (event === 'add') {
          this.folders.add(normalizedPath)
      } else {
          this.folders.delete(normalizedPath)
      }
      // Notify Frontend to refresh list
      this.mainWindow?.webContents.send('vault-changed', { event: 'refresh' })
  }

  // --- Helpers ---

  private getIdFromPath(relPath: string): string {
    // relPath is already normalized to forward slashes
    let id = relPath
    for (const ext of NOTE_EXTENSIONS) {
      if (id.toLowerCase().endsWith(ext)) {
        id = id.slice(0, -ext.length)
        break
      }
    }
    return id
  }

  private extractTitle(_content: string, id: string): string {
    // Title is ALWAYS the filename (basename of id)
    return basename(id)
  }

  private updateLinks(sourceId: string, content: string) {
    const links = new Set<string>()
    const regex = /\[\[(.*?)\]\]/g
    let match
    while ((match = regex.exec(content)) !== null) {
      const [target] = match[1].split('|')
      links.add(target.trim())
    }
    
    this.links.set(sourceId, links)
  }

  private removeLinks(sourceId: string) {
    this.links.delete(sourceId)
  }

  // --- Public API for Renderer ---

  public getNotes(): NoteMeta[] {
    const notes = Array.from(this.notes.values())
    const folderMetas = Array.from(this.folders).map(path => {
        const dir = dirname(path)
        const parentPath = dir === '.' ? '' : dir.replace(/\\/g, '/')
        return {
            id: path, // Use full path for folder ID to ensure uniqueness
            title: basename(path),
            updatedAt: 0,
            path: parentPath,
            type: 'folder'
        } as any as NoteMeta
    })
    return [...notes, ...folderMetas]
  }

  public async getNote(id: string): Promise<NotePayload | null> {
    const meta = this.notes.get(id)
    if (!meta) return null
    
    // id is like "folder/sub/note"
    // meta.path is the directory "folder/sub"
    const filename = `${basename(id)}.md`
    const fullPath = join(this.rootPath, meta.path || '', filename)
    
    try {
        let content = await readFile(fullPath, 'utf-8')
        
        // MIGRATION: Auto-strip old <!-- Title --> comments if they exist
        if (content.startsWith('<!--')) {
            content = content.replace(/^<!--\s*(.+?)\s*-->\r?\n?/, '')
        }

        return { 
            id, 
            content, 
            title: meta.title, 
            path: meta.path,
            updatedAt: meta.updatedAt 
        }
    } catch (e) {
        console.error(`[Vault] Failed to load note ${id} at ${fullPath}`, e)
        return null
    }
  }

  public async saveNote(id: string, content: string, _title?: string): Promise<NoteMeta> {
    const meta = this.notes.get(id)
    if (!meta) throw new Error('Note not found')
    
    // We no longer prepend <!-- title --> comments
    const finalContent = content
    
    const filename = `${basename(id)}.md`
    const fullPath = join(this.rootPath, meta.path || '', filename)
    
    await writeFile(fullPath, finalContent, 'utf-8')
    await this.indexFile(fullPath)
    
    return this.notes.get(id)!
  }

  public async createNote(title: string, folderPath?: string): Promise<NoteMeta> {
    const safeTitle = title.trim() || 'Untitled'
    // Sanitize ID
    const baseId = safeTitle.replace(/[<>:"/\\|?*]/g, '-')
    
    const targetDir = folderPath ? join(this.rootPath, folderPath) : this.rootPath
    
    let finalId = baseId
    let filename = `${finalId}.md`
    let fullPath = join(targetDir, filename)
    let counter = 1
    
    while (existsSync(fullPath)) {
        finalId = `${baseId} ${counter}`
        filename = `${finalId}.md`
        fullPath = join(targetDir, filename)
        counter++
    }
    
    const content = `\n`
    await writeFile(fullPath, content, 'utf-8')
    await this.indexFile(fullPath)
    
    return this.notes.get(finalId) || {
        id: finalId,
        title: safeTitle,
        updatedAt: Date.now(),
        path: relative(this.rootPath, fullPath),
        type: 'note'
    }
  }

  public async deleteNote(id: string): Promise<void> {
    const meta = this.notes.get(id)
    if (!meta) return
    
    const filename = `${basename(id)}.md`
    const fullPath = join(this.rootPath, meta.path || '', filename)
    
    if (existsSync(fullPath)) {
        await rm(fullPath)
    }
    
    this.notes.delete(id)
    this.removeLinks(id)
  }

  public async renameNote(id: string, newId: string, path?: string): Promise<string> {
    const meta = this.notes.get(id)
    if (!meta) throw new Error('Note not found')
    
    const oldFilename = `${basename(id)}.md`
    const newFilename = `${basename(newId)}.md`
    
    const currentDir = join(this.rootPath, meta.path || '')
    const targetDir = path ? join(this.rootPath, path) : currentDir
    
    const oldPath = join(currentDir, oldFilename)
    const newPath = join(targetDir, newFilename)

    if (existsSync(newPath)) throw new Error('Note already exists')
    
    await mkdir(targetDir, { recursive: true })
    await rename(oldPath, newPath)
    
    // Cleanup old and re-index new
    this.notes.delete(id)
    await this.indexFile(newPath)
    
    // In our system, the ID is based on the new relative path
    const newRelPath = relative(this.rootPath, newPath).replace(/\\/g, '/')
    const actualNewId = this.getIdFromPath(newRelPath)
    
    return actualNewId
  }

  public async moveNote(id: string, fromPath?: string, toPath?: string): Promise<NoteMeta> {
    const oldDir = fromPath ? join(this.rootPath, fromPath.replace(/\\/g, '/')) : this.rootPath
    const newDir = toPath ? join(this.rootPath, toPath.replace(/\\/g, '/')) : this.rootPath
    
    const filename = `${basename(id)}.md` 
    const oldFullPath = join(oldDir, filename)
    const newFullPath = join(newDir, filename)

    if (oldFullPath === newFullPath) {
       return this.notes.get(id)!
    }

    await mkdir(newDir, { recursive: true })
    await rename(oldFullPath, newFullPath)
    
    // Update cache
    this.notes.delete(id)
    await this.indexFile(newFullPath)
    
    const newRelPath = relative(this.rootPath, newFullPath).replace(/\\/g, '/')
    const newId = this.getIdFromPath(newRelPath)
    return this.notes.get(newId)!
  }

  public async importNote(externalFilePath: string, folderPath?: string): Promise<NoteMeta> {
    const normalizedPath = normalize(externalFilePath)
    if (!existsSync(normalizedPath)) throw new Error(`File not found: ${normalizedPath}`)
    
    const content = await readFile(normalizedPath, 'utf-8')
    const fileName = basename(externalFilePath)
    let nameWithoutExt = fileName.replace(/\.[^.]+$/, '')
    let idBase = nameWithoutExt
    const targetDir = folderPath ? join(this.rootPath, folderPath) : this.rootPath
    
    let targetPath = join(targetDir, `${idBase}.md`)
    let counter = 1
    while (existsSync(targetPath)) {
        idBase = `${nameWithoutExt} ${counter}`
        targetPath = join(targetDir, `${idBase}.md`)
        counter++
    }
    
    await mkdir(targetDir, { recursive: true })
    await writeFile(targetPath, content, 'utf-8')
    await this.indexFile(targetPath)
    
    const newRelPath = relative(this.rootPath, targetPath).replace(/\\/g, '/')
    const newId = this.getIdFromPath(newRelPath)
    return this.notes.get(newId)!
  }

  public async createFolder(name: string, parentPath = ''): Promise<{ name: string; path: string }> {
    const targetDir = parentPath ? join(this.rootPath, parentPath) : this.rootPath
    let safeName = name || 'New Folder'
    let folderPath = join(targetDir, safeName)
    
    let counter = 1
    while (existsSync(folderPath)) {
        safeName = `${name || 'New Folder'} ${counter}`
        folderPath = join(targetDir, safeName)
        counter++
    }
    
    await mkdir(folderPath, { recursive: true })
    
    const relPath = relative(this.rootPath, folderPath).replace(/\\/g, '/')
    this.folders.add(relPath)
    
    return { name: safeName, path: relPath }
  }

  public async deleteFolder(relativePath: string): Promise<void> {
    const fullPath = join(this.rootPath, relativePath)
    if (existsSync(fullPath)) {
      await rm(fullPath, { recursive: true, force: true })
      
      const normalizedPath = relativePath.replace(/\\/g, '/')
      this.folders.delete(normalizedPath)
      
      // Cleanup all notes inside this folder from cache
      for (const [id, meta] of this.notes.entries()) {
        if (meta.path?.startsWith(normalizedPath)) {
          this.notes.delete(id)
        }
      }
    }
  }

  public async renameFolder(path: string, newName: string): Promise<{ path: string }> {
    const normalizedPath = path.replace(/\\/g, '/')
    const sourcePath = join(this.rootPath, normalizedPath)
    const parent = dirname(normalizedPath)
    const newRelPath = (parent === '.' || parent === '') ? newName : join(parent, newName)
    const targetPath = join(this.rootPath, newRelPath)
    
    if (existsSync(targetPath)) throw new Error('Folder already exists')
    await rename(sourcePath, targetPath)
    
    const finalRelPath = newRelPath.replace(/\\/g, '/')
    
    // Update cache
    this.folders.delete(normalizedPath)
    this.folders.add(finalRelPath)
    
    // Update all notes inside from cache
    for (const [id, meta] of this.notes.entries()) {
        if (meta.path?.startsWith(normalizedPath)) {
            const relativeToFolder = meta.id.substring(normalizedPath.length)
            const newId = join(finalRelPath, relativeToFolder).replace(/\\/g, '/')
            const newPath = dirname(newId) === '.' ? '' : dirname(newId)
            
            this.notes.delete(id)
            this.notes.set(newId, {
                ...meta,
                id: newId,
                path: newPath
            })
        }
    }
    
    return { path: finalRelPath }
  }

  public async moveFolder(sourcePath: string, targetPath: string): Promise<{ path: string }> {
    const sourceNorm = sourcePath.replace(/\\/g, '/')
    const targetNorm = targetPath.replace(/\\/g, '/')
    
    const sourceFullPath = join(this.rootPath, sourceNorm)
    const targetFullPath = join(this.rootPath, targetNorm)
    const folderName = basename(sourceNorm)
    
    if (targetNorm.startsWith(sourceNorm + '/') || targetNorm === sourceNorm) {
      throw new Error('Cannot move a folder into itself or its descendants')
    }

    let newFolderPath = join(targetFullPath, folderName)
    let safeFolderName = folderName
    let counter = 1
    
    while (existsSync(newFolderPath)) {
      safeFolderName = `${folderName} ${counter}`
      newFolderPath = join(targetFullPath, safeFolderName)
      counter++
    }
    
    await mkdir(targetFullPath, { recursive: true })
    await rename(sourceFullPath, newFolderPath)
    
    const finalPath = join(targetNorm, safeFolderName).replace(/\\/g, '/')
    
    // Update cache
    this.folders.delete(sourceNorm)
    this.folders.add(finalPath)
    
    // Update subfolders and notes
    // (Actually simpler to just trigger a rescan or update prefix)
    for (const folder of Array.from(this.folders)) {
        if (folder.startsWith(sourceNorm + '/')) {
            this.folders.delete(folder)
            this.folders.add(folder.replace(sourceNorm, finalPath))
        }
    }
    
    for (const [id, meta] of this.notes.entries()) {
        if (id.startsWith(sourceNorm + '/')) {
            const newId = id.replace(sourceNorm, finalPath)
            this.notes.delete(id)
            this.notes.set(newId, {
                ...meta,
                id: newId,
                path: dirname(newId) === '.' ? '' : dirname(newId)
            })
        }
    }
    
    return { path: finalPath }
  }

  public async search(query: string): Promise<NoteMeta[]> {
    const lower = query.toLowerCase()
    const matches: NoteMeta[] = []
    
    for (const meta of this.notes.values()) {
        if (meta.title.toLowerCase().includes(lower)) {
            matches.push(meta)
            continue
        }
        
        try {
            if (!meta.path) continue
            const fullPath = join(this.rootPath, meta.path)
            const content = await readFile(fullPath, 'utf-8')
            if (content.toLowerCase().includes(lower)) {
                matches.push(meta)
            }
        } catch (e) {
            // ignore read error
        }
    }
    return matches
  }

  public getBacklinks(targetId: string): string[] {
      const sources: string[] = []
      for (const [sourceId, targets] of this.links.entries()) {
          if (targets.has(targetId)) {
              sources.push(sourceId)
          }
      }
      return sources
  }
  
  public getAllLinks(): { source: string; target: string }[] {
      const links: { source: string; target: string }[] = []
      for (const [source, targets] of this.links.entries()) {
          for (const target of targets) {
              links.push({ source, target })
          }
      }
      return links
  }
}

export const vault = new VaultManager()
