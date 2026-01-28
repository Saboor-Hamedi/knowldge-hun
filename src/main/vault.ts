import { join, basename, relative, dirname, normalize } from 'path'
import { readFile, writeFile, rm, rename, stat, readdir, mkdir, copyFile } from 'fs/promises'
import { existsSync } from 'fs'
import { watch } from 'chokidar'
import type { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
// import { version } from './package.json'
export type NoteMeta = {
  id: string
  title: string
  updatedAt: number
  createdAt?: number
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

const TEXT_EXTENSIONS = [
  '.md',
  '.txt',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.c',
  '.cpp',
  '.cs',
  '.h',
  '.hpp',
  '.css',
  '.scss',
  '.html',
  '.json',
  '.yaml',
  '.yml',
  '.sh',
  '.bash',
  '.sql',
  '.rs',
  '.go',
  '.java',
  '.php',
  '.rb',
  '.xml',
  '.toml',
  '.ini',
  '.csv',
  '.tsv',
  '.log',
  '.lock',
  '.env',
  '.babelrc',
  '.eslintrc',
  '.prettierrc',
  '.stylelintrc',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.npmrc',
  '.nvmrc',
  '.dockerignore',
  '.env.example',
  '.env.local',
  '.twig',
  '.blade.php',
  '.less',
  '.sass',
  '.mdx',
  'dockerfile',
  'makefile',
  '.ipynb'
]

const IGNORED_NAMES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.cache',
  'vendor',
  '.idea',
  '.vscode',
  'storage',
  'bin',
  'obj'
]

export class VaultManager {
  private rootPath: string = ''
  private watcher: FSWatcher | null = null
  private mainWindow: BrowserWindow | null = null

  // In-memory cache
  private notes = new Map<string, NoteMeta>()
  private folders = new Set<string>()
  private links = new Map<string, Set<string>>() // Source -> Targets
  private backlinks = new Map<string, Set<string>>() // Target -> Sources

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  public getRootPath(): string {
    return this.rootPath
  }

  public async setVaultPath(path: string): Promise<void> {
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

  private async initialScan(): Promise<void> {
    await this.scanDirectory(this.rootPath)
  }

  private async scanDirectory(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const entryName = entry.name.toLowerCase()

      // Skip hidden directories and bulky code folders (Shadow Folders)
      if (
        entry.isDirectory() &&
        (entry.name.startsWith('.') || IGNORED_NAMES.includes(entryName))
      ) {
        continue
      }

      if (entry.isDirectory()) {
        const relPath = relative(this.rootPath, fullPath)
        const normalizedPath = relPath.replace(/\\/g, '/')
        this.folders.add(normalizedPath)
        await this.scanDirectory(fullPath)
      } else if (entry.isFile() && this.isSupportedFile(entry.name)) {
        await this.indexFile(fullPath)
      }
    }
  }
  private isSupportedFile(filename: string): boolean {
    const lower = filename.toLowerCase()
    return TEXT_EXTENSIONS.some((ext) => {
      if (ext.startsWith('.')) return lower.endsWith(ext)
      return lower === ext // Exact match for things like 'makefile' or 'dockerfile'
    })
  }

  private async indexFile(fullPath: string): Promise<void> {
    try {
      const stats = await stat(fullPath)
      const relPath = relative(this.rootPath, fullPath)
      const normalizedPath = relPath.replace(/\\/g, '/')
      const id = this.getIdFromPath(normalizedPath)

      // Only read content if it's a text-based file for indexing
      const content = await readFile(fullPath, 'utf-8')

      // Extract directory path (without filename)
      const dirPath = dirname(normalizedPath)
      const relativeDir = dirPath === '.' ? '' : dirPath

      const existingMeta = this.notes.get(id)
      // Use the earliest reasonable timestamp as createdAt
      const birthtime = stats.birthtimeMs
      const mtime = stats.mtimeMs
      const existingCreatedAt = existingMeta?.createdAt

      // Preserve existing createdAt if it exists and is reasonable
      let createdAt: number
      if (
        existingCreatedAt &&
        existingCreatedAt > 0 &&
        existingCreatedAt < Date.now() &&
        existingCreatedAt < mtime + 1000
      ) {
        // Existing createdAt is valid and not newer than mtime (with 1s tolerance)
        createdAt = existingCreatedAt
      } else {
        // Use birthtime if it's reasonable, otherwise use mtime
        const now = Date.now()
        const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000
        createdAt =
          birthtime > oneYearAgo && birthtime <= now && birthtime <= mtime ? birthtime : mtime
      }

      const extractedTitle = this.extractTitle(content, id)
      const meta: NoteMeta = {
        id,
        title: extractedTitle || basename(id) || 'Untitled', // Ensure title is never empty
        updatedAt: mtime,
        createdAt: createdAt,
        path: relativeDir,
        type: 'note'
      }

      this.notes.set(id, meta)
      this.updateLinks(id, content)
    } catch (err) {
      console.error(`[Vault] Failed to index ${fullPath}`, err)
    }
  }

  private async startWatcher(): Promise<void> {
    if (this.watcher) await this.watcher.close()

    this.watcher = watch(this.rootPath, {
      ignored: (path: string) => {
        const parts = path.split(/[\\/]/)
        const name = parts[parts.length - 1].toLowerCase()
        // Ignore hidden folders and ignored code folders
        if (
          name.startsWith('.') &&
          !parts.some((p) => TEXT_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext)))
        )
          return true
        if (IGNORED_NAMES.includes(name)) return true
        return false
      },
      persistent: true,
      ignoreInitial: true
    })

    this.watcher.on('add', (path) => void this.handleFileChange('add', path))
    this.watcher.on('change', (path) => void this.handleFileChange('change', path))
    this.watcher.on('unlink', (path) => void this.handleFileChange('unlink', path))
    this.watcher.on('addDir', (path) => void this.handleDirChange('add', path))
    this.watcher.on('unlinkDir', (path) => void this.handleDirChange('unlink', path))
  }

  private async handleFileChange(
    event: 'add' | 'change' | 'unlink',
    fullPath: string
  ): Promise<void> {
    if (!this.isSupportedFile(fullPath)) return
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

  private async handleDirChange(event: 'add' | 'unlink', fullPath: string): Promise<void> {
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
    // UNIFIED ID: The ID is now the full relative path including extension.
    // This allows unique selection and editing of any file in the workspace.
    return relPath.replace(/\\/g, '/')
  }

  private extractTitle(_content: string, id: string): string {
    // Title is ALWAYS the filename (basename of id)
    return basename(id)
  }

  private updateLinks(sourceId: string, content: string): void {
    const links = new Set<string>()
    const regex = /\[\[(.*?)\]\]/g
    let match
    while ((match = regex.exec(content)) !== null) {
      const [target] = match[1].split('|')
      links.add(target.trim())
    }

    this.links.set(sourceId, links)
  }

  private removeLinks(sourceId: string): void {
    this.links.delete(sourceId)
  }

  // --- Public API for Renderer ---

  public getNotes(): NoteMeta[] {
    const notes = Array.from(this.notes.values())
    const folderMetas = Array.from(this.folders).map((path) => {
      const dir = dirname(path)
      const parentPath = dir === '.' ? '' : dir.replace(/\\/g, '/')
      return {
        id: path, // Use full path for folder ID to ensure uniqueness
        title: basename(path),
        updatedAt: 0,
        path: parentPath,
        type: 'folder'
      } as NoteMeta
    })
    return [...notes, ...folderMetas]
  }

  public async getNote(id: string): Promise<NotePayload | null> {
    const meta = this.notes.get(id)
    if (!meta) return null

    // Ensure title is set (safety check)
    if (!meta.title) {
      meta.title = basename(id) || 'Untitled'
    }

    // Dynamic extension loading: joined id is the full workspace path
    const fullPath = join(this.rootPath, id)

    try {
      let content = await readFile(fullPath, 'utf-8')

      // MIGRATION: Auto-strip old <!-- Title --> comments only for markdown
      if (id.toLowerCase().endsWith('.md') && content.startsWith('<!--')) {
        content = content.replace(/^<!--\s*(.+?)\s*-->\r?\n?/, '')
      }

      return {
        id,
        content,
        title: meta.title || basename(id) || 'Untitled',
        path: meta.path,
        updatedAt: meta.updatedAt,
        createdAt: meta.createdAt
      }
    } catch (e) {
      console.error(`[Vault] Failed to load file ${id} at ${fullPath}`, e)
      return null
    }
  }

  /**
   * Export all notes with their content for backup
   */
  public async exportAllNotes(): Promise<NotePayload[]> {
    const notes = Array.from(this.notes.values())
    const exported: NotePayload[] = []

    for (const meta of notes) {
      try {
        const note = await this.getNote(meta.id)
        if (note) {
          exported.push(note)
        }
      } catch (e) {
        console.error(`[Vault] Failed to export note ${meta.id}`, e)
      }
    }

    return exported
  }

  public async saveNote(id: string, content: string, _title?: string): Promise<NoteMeta> {
    void _title // Suppress unused parameter warning
    let meta = this.notes.get(id)
    if (!meta) {
      // Direct path access
      const fullPath = join(this.rootPath, id)
      if (existsSync(fullPath)) {
        await this.indexFile(fullPath)
        meta = this.notes.get(id)
      }
      if (!meta) {
        throw new Error(`File not found: ${id}`)
      }
    }

    const fullPath = join(this.rootPath, id)
    await writeFile(fullPath, content, 'utf-8')
    await this.indexFile(fullPath)

    return this.notes.get(id)!
  }

  public async createNote(title: string, folderPath?: string): Promise<NoteMeta> {
    const safeTitle = title.trim() || 'Untitled'
    const targetDir = folderPath ? join(this.rootPath, folderPath) : this.rootPath

    // Ensure target directory exists
    await mkdir(targetDir, { recursive: true })

    // If title doesn't have an extension, default to .md
    let filename = safeTitle.includes('.') ? safeTitle : `${safeTitle}.md`
    let fullPath = join(targetDir, filename)
    let counter = 1

    const nameParts = filename.split('.')
    const ext = nameParts.length > 1 ? `.${nameParts.pop()}` : '.md'
    const baseName = nameParts.join('.')

    while (existsSync(fullPath)) {
      filename = `${baseName} ${counter}${ext}`
      fullPath = join(targetDir, filename)
      counter++
    }

    const content = `\n`
    await writeFile(fullPath, content, 'utf-8')
    await this.indexFile(fullPath)

    const relPath = relative(this.rootPath, fullPath).replace(/\\/g, '/')
    return this.notes.get(relPath)!
  }

  public async deleteNote(id: string): Promise<void> {
    const fullPath = join(this.rootPath, id)
    if (existsSync(fullPath)) {
      await rm(fullPath)
    }

    this.notes.delete(id)
    this.removeLinks(id)
  }

  public async renameNote(id: string, newTitle: string): Promise<string> {
    const meta = this.notes.get(id)
    if (!meta) throw new Error('File not found')

    const currentPath = join(this.rootPath, id)
    const dir = dirname(id)

    // Ensure extension remains or is added
    const oldExt = id.split('.').pop()
    let newFilename = newTitle
    if (!newFilename.includes('.') && oldExt) {
      newFilename = `${newTitle}.${oldExt}`
    }

    const newId = dir === '.' || dir === '' ? newFilename : `${dir}/${newFilename}`
    const newPath = join(this.rootPath, newId)

    if (existsSync(newPath)) throw new Error('File already exists')

    await rename(currentPath, newPath)

    this.notes.delete(id)
    await this.indexFile(newPath)
    return newId
  }

  public async moveNote(id: string, fromPath?: string, toPath?: string): Promise<NoteMeta> {
    const oldDir = fromPath ? join(this.rootPath, fromPath.replace(/\\/g, '/')) : this.rootPath
    const newDir = toPath ? join(this.rootPath, toPath.replace(/\\/g, '/')) : this.rootPath

    const filename = `${basename(id)}.md`
    const oldFullPath = join(oldDir, filename)
    const newFullPath = join(newDir, filename)

    if (oldFullPath === newFullPath) {
      const existing = this.notes.get(id)
      if (!existing) throw new Error(`Note ${id} not found`)
      return existing
    }

    await mkdir(newDir, { recursive: true })
    await rename(oldFullPath, newFullPath)

    // Update cache
    this.notes.delete(id)
    await this.indexFile(newFullPath)

    const newRelPath = relative(this.rootPath, newFullPath).replace(/\\/g, '/')
    const newId = this.getIdFromPath(newRelPath)
    const newMeta = this.notes.get(newId)

    if (!newMeta) {
      throw new Error(`Failed to index moved note: ${newId}`)
    }

    // Ensure title is set (should be set by indexFile, but add safety check)
    if (!newMeta.title) {
      newMeta.title = basename(newId)
    }

    return newMeta
  }

  public async importNote(externalFilePath: string, folderPath?: string): Promise<NoteMeta> {
    const normalizedPath = normalize(externalFilePath)
    if (!existsSync(normalizedPath)) throw new Error(`File not found: ${normalizedPath}`)

    const content = await readFile(normalizedPath, 'utf-8')
    const fileName = basename(externalFilePath)
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')
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

  public async createFolder(
    name: string,
    parentPath = ''
  ): Promise<{ name: string; path: string }> {
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
    const sourceDir = join(this.rootPath, normalizedPath)
    const parent = dirname(normalizedPath)
    const parentDir = parent === '.' || parent === '' ? '' : parent
    const newRelPath = parentDir === '' ? newName : `${parentDir}/${newName}`
    const targetDir = join(this.rootPath, newRelPath)

    if (existsSync(targetDir)) throw new Error('Folder already exists')

    // Temporarily stop watcher to prevent EPERM locks on Windows
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }

    try {
      await rename(sourceDir, targetDir)
    } finally {
      // Always restart watcher
      await this.startWatcher()
    }

    const finalRelPath = newRelPath.replace(/\\/g, '/')

    // Update cache
    this.folders.delete(normalizedPath)
    this.folders.add(finalRelPath)

    // Update all notes inside from cache
    for (const [id, meta] of this.notes.entries()) {
      if (meta.path?.startsWith(normalizedPath)) {
        // Care with substring logic - ensure boundary
        const prefix = normalizedPath === '' ? '' : normalizedPath + '/'
        if (id.startsWith(prefix) || meta.path === normalizedPath) {
          // Wait, if meta.path starts with it.
          // Re-calculate new ID properly
          const suffix = id.substring(normalizedPath.length)
          // suffix starts with / usually
          const newId = join(finalRelPath, suffix).replace(/\\/g, '/')
          const newPath = dirname(newId) === '.' ? '' : dirname(newId)

          this.notes.delete(id)
          this.notes.set(newId, {
            ...meta,
            id: newId,
            path: newPath
          })
        }
      }
    }

    // Recursive folder cache update for subfolders
    for (const folder of Array.from(this.folders)) {
      if (folder !== finalRelPath && folder.startsWith(normalizedPath + '/')) {
        this.folders.delete(folder)
        const suffix = folder.substring(normalizedPath.length)
        this.folders.add(finalRelPath + suffix)
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

    // Ensure target directory exists
    await mkdir(targetFullPath, { recursive: true })

    try {
      // Try rename first (fastest for simple moves)
      await rename(sourceFullPath, newFolderPath)
    } catch {
      // Fallback: copy the entire folder recursively, then delete source
      try {
        await this.copyFolderRecursive(sourceFullPath, newFolderPath)
        await rm(sourceFullPath, { recursive: true, force: true })
      } catch (copyError) {
        throw new Error(`Failed to move folder: ${(copyError as Error).message}`)
      }
    }

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
      } catch {
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

  private async copyFolderRecursive(source: string, destination: string): Promise<void> {
    // Ensure destination directory exists
    await mkdir(destination, { recursive: true })

    const entries = await readdir(source, { withFileTypes: true })

    for (const entry of entries) {
      const sourcePath = join(source, entry.name)
      const destPath = join(destination, entry.name)

      if (entry.isDirectory()) {
        await this.copyFolderRecursive(sourcePath, destPath)
      } else if (entry.isFile()) {
        await copyFile(sourcePath, destPath)
      }
      // Skip other types (symlinks, etc.) for safety
    }
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
