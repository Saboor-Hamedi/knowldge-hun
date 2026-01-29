import { state } from '../core/state'
import type { TreeItem, NoteMeta, AppSettings } from '../core/types'
import { sortNotes } from '../utils/helpers'
import { sortTreeRecursive } from '../utils/tree-utils'
import { vaultService } from '../services/vaultService'
import { tabService } from '../services/tabService'
import { ragService } from '../services/rag/ragService'
import { aiStatusManager } from '../core/aiStatusManager'
import { notificationManager } from '../components/notification/notification'

export class VaultHandler {
  constructor(
    public components: {
      sidebar: {
        renderTree: (filter?: string) => void
        updateSelection: (id: string) => void
        updateDirtyState: () => void
        scrollToActive: (focus: boolean) => void
        setVisible: (visible: boolean) => void
      }
      tabBar: { render: () => void }
      statusBar: { setStatus: (msg: string) => void; setMeta: (msg: string) => void }
      editor: {
        loadNote: (note: any) => Promise<void>
        showEmpty: () => void
        layout: () => void
        isPreviewMode: boolean
        [key: string]: any
      }
      breadcrumbs: { render: () => void }
      activityBar: { setActiveView: (view: 'notes' | 'search' | 'settings') => void }
      welcomePage: { show: () => void; hide: () => void; isVisible: () => boolean }
    },
    private callbacks: {
      updateViewVisibility: () => void
      showWelcomePage: () => void
      onNoteOpened?: (id: string, path?: string) => void
    }
  ) {}

  public async init(): Promise<void> {
    this.components.statusBar.setStatus('Initializing...')
    // Initialize settings and vault
    await this.initVault()
    await this.refreshNotes()

    if (state.activeId) {
      const activeTab = state.openTabs.find((t) => t.id === state.activeId)
      if (activeTab) {
        await this.openNote(activeTab.id, activeTab.path)
      }
    } else if (state.openTabs.length > 0) {
      await this.openNote(state.openTabs[0].id, state.openTabs[0].path)
    } else {
      this.callbacks.showWelcomePage()
    }

    this.callbacks.updateViewVisibility()

    // Initialize AI in background
    this.backgroundIndexVault().catch((err) => console.error('Background indexing failed:', err))

    state.isLoading = false
  }

  public async chooseVault(): Promise<void> {
    const vaultInfo = await window.api.chooseVault()
    if (vaultInfo && vaultInfo.path) {
      await this.handleVaultSelected(vaultInfo.path)
    }
  }

  public async handleVaultLocated(_originalPath: string, newPath: string): Promise<void> {
    await this.handleVaultSelected(newPath)
    this.components.statusBar.setStatus('Vault location updated')
  }

  public async initVault(): Promise<void> {
    try {
      const info = await window.api.getVault()
      state.vaultPath = info.path
      state.projectName = info.name
      this.components.statusBar.setMeta(`📁 ${info.path}`)
    } catch (error) {
      console.error('Failed to init vault', error)
    }
  }

  public async refreshNotes(): Promise<void> {
    const rawNotes = await window.api.listNotes()

    // Build tree
    state.tree = this.buildTree(rawNotes)
    state.notes = rawNotes.filter((n) => n.type !== 'folder')
    sortNotes(state.notes)

    // Clean up expandedFolders
    const allFolderIds = new Set<string>()
    const collectFolderIds = (items: TreeItem[]): void => {
      items.forEach((item) => {
        if (item.type === 'folder') {
          allFolderIds.add(item.id)
          if (item.children) collectFolderIds(item.children)
        }
      })
    }
    collectFolderIds(state.tree)

    let expandedChanged = false
    state.expandedFolders.forEach((id) => {
      if (!allFolderIds.has(id)) {
        state.expandedFolders.delete(id)
        expandedChanged = true
      }
    })

    if (expandedChanged) {
      void this.saveExpandedFolders()
    }

    tabService.syncTabs()
    this.components.sidebar.renderTree()
    this.components.tabBar.render()
  }

  private buildTree(items: NoteMeta[]): TreeItem[] {
    const root: TreeItem[] = []
    const folderMap = new Map<string, TreeItem>()

    items.forEach((item) => {
      if (item.type === 'folder') {
        folderMap.set(item.id, { ...item, children: [] })
      }
    })

    items.forEach((item) => {
      const type = item.type || 'note'
      const treeItem = type === 'folder' ? folderMap.get(item.id)! : { ...item, type, children: [] }
      const parentPath = (item.path || '').replace(/\\/g, '/')

      if (parentPath === '') {
        root.push(treeItem)
      } else if (folderMap.has(parentPath)) {
        folderMap.get(parentPath)!.children?.push(treeItem)
      } else {
        root.push(treeItem)
      }
    })

    sortTreeRecursive(root)
    return root
  }

  public async openNote(
    id: string,
    path?: string,
    focusTarget: 'editor' | 'sidebar' | 'none' = 'editor'
  ): Promise<void> {
    this.callbacks.updateViewVisibility()
    if (this.components.welcomePage.isVisible()) {
      this.components.welcomePage.hide()
    }

    const shell = document.querySelector('.vscode-shell')
    const isSidebarVisible = shell && !shell.classList.contains('sidebar-hidden')
    if (isSidebarVisible) {
      this.components.activityBar.setActiveView('notes')
    }

    const note = await window.api.loadNote(id, path)
    if (!note) {
      await this.refreshNotes()
      const refreshed = state.notes.find((n) => n.id === id || n.path === path)
      if (refreshed) {
        return this.openNote(refreshed.id, refreshed.path, focusTarget)
      }

      notificationManager.show(`Note "${id}" could not be found.`, 'warning', {
        title: 'Note Not Found'
      })
      this.components.statusBar.setStatus('Note missing on disk')
      if (state.activeId === id || !state.activeId) {
        this.components.editor.showEmpty()
      }
      return
    }

    state.activeId = id
    state.lastSavedAt = note.updatedAt

    if (focusTarget !== 'none') {
      tabService.ensureTab(note)
    }

    if (this.components.editor.isPreviewMode) {
      this.components.editor.isPreviewMode = false
      const editorHost = this.components.editor['editorHost'] as HTMLElement
      const previewHost = this.components.editor['previewHost'] as HTMLElement
      if (editorHost) editorHost.style.display = 'block'
      if (previewHost) previewHost.style.display = 'none'
    }

    await this.components.editor.loadNote(note)
    this.callbacks.updateViewVisibility()
    this.components.statusBar.setStatus('Ready')
    this.components.statusBar.setMeta(`📁 ${state.vaultPath || ''}`)

    if (note.path) {
      this.revealPathInSidebar(note.path)
    }

    this.components.sidebar.updateSelection(id)
    this.components.sidebar.updateDirtyState()

    if (focusTarget === 'sidebar') {
      this.components.sidebar.scrollToActive(true)
    } else {
      this.components.sidebar.scrollToActive(false)
      if (focusTarget === 'editor') {
        this.components.editor.focus?.()
      }
    }

    this.components.breadcrumbs.render()
    this.components.tabBar.render()
    void this.persistWorkspace()

    this.callbacks.onNoteOpened?.(id, path)
  }

  public revealPathInSidebar(path?: string, isFolder = false): boolean {
    if (!path) return false
    const parts = path.split(/[\\/]/)
    let currentPath = ''
    let changed = false

    parts.forEach((part, index) => {
      if (!part) return
      currentPath = currentPath ? `${currentPath}/${part}` : part
      if (index < parts.length - 1 || isFolder) {
        if (!state.expandedFolders.has(currentPath)) {
          state.expandedFolders.add(currentPath)
          changed = true
        }
      }
    })

    if (changed) {
      void this.saveExpandedFolders()
      this.components.sidebar.renderTree()
      return true
    }
    return false
  }

  public async saveExpandedFolders(): Promise<void> {
    try {
      await window.api.updateSettings({
        expandedFolders: Array.from(state.expandedFolders)
      })
    } catch (error) {
      console.error('Failed to save expanded folders', error)
    }
  }

  public async persistWorkspace(): Promise<void> {
    try {
      if (state.isLoading) return
      if (state.openTabs.length === 0 && !state.vaultPath) return

      await window.api.updateSettings({
        openTabs: state.openTabs.map((t) => ({ id: t.id, path: t.path, title: t.title })),
        activeId: state.activeId,
        pinnedTabs: Array.from(state.pinnedTabs),
        cursorPositions: Object.fromEntries(state.cursorPositions)
      } as Partial<AppSettings>)
    } catch (e) {
      console.error('Failed to persist workspace', e)
    }
  }

  public async backgroundIndexVault(): Promise<void> {
    const notesToIndex = state.notes
    let indexedCount = 0
    let isInitialized = false

    aiStatusManager.show('AI Brain: Checking...')
    let existingMetadata: Record<string, number> = {}
    try {
      existingMetadata = await ragService.getAllMetadata()
    } catch (e) {
      console.warn('[RAG] Failed to fetch existing metadata:', e)
    }

    const noteIdsInVault = new Set(notesToIndex.map((n) => n.id))
    for (const indexedId in existingMetadata) {
      if (!noteIdsInVault.has(indexedId)) {
        void ragService.deleteNote(indexedId)
      }
    }

    const potentiallyChanged = notesToIndex.filter((note) => {
      const indexedTime = existingMetadata[note.id]
      return !indexedTime || note.updatedAt > indexedTime
    })

    if (potentiallyChanged.length === 0) {
      aiStatusManager.setReady('AI Brain: Up to date')
      return
    }

    for (const note of potentiallyChanged) {
      try {
        const content = await window.api.loadNote(note.id, note.path)
        if (!content || !content.content.trim() || content.content.length > 1024 * 1024) continue

        if (!isInitialized) {
          aiStatusManager.show('AI Brain: Loading models...')
          await ragService.init()
          isInitialized = true
        }

        await ragService.indexNote(note.id, content.content, {
          title: note.title,
          path: note.path
        })
        indexedCount++
        aiStatusManager.updateProgress(indexedCount, potentiallyChanged.length)
      } catch (e) {
        console.warn(`[RAG] Failed to index note ${note.title}:`, e)
      }
    }

    if (indexedCount > 0) {
      aiStatusManager.setReady(`AI Ready (${indexedCount} notes indexed)`)
    } else {
      aiStatusManager.setReady('AI Brain: Up to date')
    }
  }

  public async handleVaultSelected(path: string): Promise<void> {
    const result = await vaultService.openVault(path)
    if (!result.success) {
      this.components.statusBar.setStatus(`⚠️ ${result.error || 'Failed to open vault'}`)
      return
    }

    state.vaultPath = path
    state.projectName = vaultService.getVaultName(path) || 'Vault'

    const name = state.projectName
    const filtered = (state.recentProjects || []).filter((p) => p.path !== path)
    state.recentProjects = [{ name, path }, ...filtered].slice(0, 10)

    state.openTabs = []
    state.activeId = ''
    state.pinnedTabs.clear()
    state.newlyCreatedIds.clear()
    this.components.tabBar.render()

    this.components.statusBar.setStatus('Loading vault...')
    await this.refreshNotes()

    if (state.openTabs.length > 0) {
      const activeTab = state.openTabs.find((t) => t.id === state.activeId) || state.openTabs[0]
      await this.openNote(activeTab.id, activeTab.path)
    } else if (state.notes.length > 0) {
      this.callbacks.showWelcomePage()
    } else {
      state.activeId = ''
      this.callbacks.showWelcomePage()
      this.components.statusBar.setStatus('Empty vault')
    }

    this.callbacks.updateViewVisibility()
    this.components.statusBar.setMeta(`📁 ${path}`)

    this.components.statusBar.setStatus('Initializing AI...')
    await ragService.init()
    this.backgroundIndexVault().catch((err) => console.error('Background indexing failed:', err))
  }
}
