import { state } from './core/state'
import type { NotePayload, NoteMeta, TreeItem, AppSettings } from './core/types'
import {
  sortNotes,
  timeAgo,
  extractWikiLinks,
  extractTags,
  estimateReadTime
} from './utils/helpers'
import { sortTreeRecursive } from './utils/tree-utils'
import { keyboardManager } from './core/keyboardManager'
import { modalManager } from './components/modal/modal'
import { ActivityBar } from './components/activitybar/activitybar'
import { SidebarTree } from './components/sidebar/sidebar-tree'
import { TabBar } from './components/tabbar/tabbar'
import { EditorComponent } from './components/editor/editor'
import { StatusBar } from './components/statusbar/statusbar'
import { RightBar } from './components/rightbar/rightbar'
import { detailsModal } from './components/details-modal/details-modal'
import { SettingsView } from './components/settings/settings-view'
import { contextMenu } from './components/contextmenu/contextmenu'

import { ThemeModal } from './components/theme-modal/theme-modal'
import { FuzzyFinder } from './components/fuzzy-finder/fuzzy-finder'
import { GraphView } from './components/graph/graph'
import { themeManager } from './core/themeManager'
import { ErrorHandler } from './utils/error-handler'
import { notificationManager } from './components/notification/notification'
import { noteService } from './services/noteService'
import { tabService } from './services/tabService'
import { aiService } from './services/aiService'
import { TabHandlersImpl } from './handlers/tabHandlers'
import { WikiLinkService } from './components/wikilink/wikilinkService'
import { PreviewHandlers } from './handlers/previewHandlers'
import { vaultService } from './services/vaultService'
import { VaultPicker } from './components/vault-picker/vault-picker'

function buildTree(items: NoteMeta[]): TreeItem[] {
  const root: TreeItem[] = []
  const folderMap = new Map<string, TreeItem>()

  // 1. Create a map of all folders first
  items.forEach((item) => {
    if (item.type === 'folder') {
      const folderItem: TreeItem = {
        ...item,
        children: []
      }
      folderMap.set(folderItem.id, folderItem)
    }
  })

  // 2. Process all items and attach to parents
  items.forEach((item) => {
    const type = item.type || 'note'
    const treeItem: TreeItem =
      type === 'folder' ? folderMap.get(item.id)! : { ...item, type, children: [] }

    const parentPath = (item.path || '').replace(/\\/g, '/')

    if (parentPath === '') {
      root.push(treeItem)
    } else if (folderMap.has(parentPath)) {
      folderMap.get(parentPath)!.children?.push(treeItem)
    } else {
      root.push(treeItem)
    }
  })

  // 3. Sort recursively
  sortTreeRecursive(root)
  return root
}

class App {
  private wireUpdateEvents(): void {
    window.electron?.ipcRenderer?.on?.('update:available', () => {
      this.statusBar.setStatus('Update available. Downloading...')
    })
    window.electron?.ipcRenderer?.on?.('update:not-available', () => {
      this.statusBar.setStatus('No update available.')
    })
    window.electron?.ipcRenderer?.on?.('update:progress', (_event, progressObj) => {
      const percent = progressObj.percent ? progressObj.percent.toFixed(1) : ''
      this.statusBar.setStatus(`Downloading update... ${percent}%`)
    })
    window.electron?.ipcRenderer?.on?.('update:downloaded', () => {
      this.statusBar.setStatus('Update downloaded. Restarting...')
    })
    window.electron?.ipcRenderer?.on?.('update:error', (_event, errMsg) => {
      this.statusBar.setStatus(`Update error: ${errMsg}`)
    })
  }

  public showDetailsModal(): void {
    const content = this.editor.getValue()
    const words = content.trim()
      ? content
          .trim()
          .split(/\s+/)
          .filter((w: string) => w).length
      : 0
    const chars = content.length
    const lines = content.split('\n').length
    const readTime = estimateReadTime(content)
    const wikiLinks = extractWikiLinks(content).length
    const tags = extractTags(content).length
    const currentNoteId = state.activeId
    if (currentNoteId) {
      const note = state.notes.find((n) => n.id === currentNoteId)
      if (note) {
        const created = note.createdAt && note.createdAt > 0 ? timeAgo(note.createdAt) : '-'
        const modified = timeAgo(note.updatedAt)
        detailsModal.show({
          words,
          chars,
          lines,
          readTime: `${readTime} min`,
          wikiLinks,
          tags,
          created,
          modified
        })
      }
    } else {
      detailsModal.show({
        words: 0,
        chars: 0,
        lines: 0,
        readTime: '-',
        wikiLinks: 0,
        tags: 0,
        created: '-',
        modified: '-'
      })
    }
  }

  private async toggleRightSidebar(): Promise<void> {
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    const rightPanel = document.getElementById('rightPanel') as HTMLElement
    if (!rightPanel || !shell) return

    const isVisible = rightPanel.style.display !== 'none'
    if (isVisible) {
      // Before closing, save the current width if it's > 0 and save visibility state
      const currentWidth = parseInt(
        getComputedStyle(shell).getPropertyValue('--right-panel-width') || '270',
        10
      )
      if (currentWidth > 0) {
        void window.api.updateSettings({ rightPanelWidth: currentWidth, rightPanelVisible: false })
      } else {
        void window.api.updateSettings({ rightPanelVisible: false })
      }
      rightPanel.style.display = 'none'
      shell.style.setProperty('--right-panel-width', '0px')
    } else {
      // When opening, use saved width from settings and save visibility state
      const s = await window.api.getSettings()
      const w = (s as { rightPanelWidth?: number }).rightPanelWidth ?? 270
      rightPanel.style.display = 'block'
      shell.style.setProperty('--right-panel-width', `${Math.max(200, Math.min(800, w))}px`)
      void window.api.updateSettings({ rightPanelVisible: true })
    }
  }

  private activityBar: ActivityBar
  private sidebar: SidebarTree
  private tabBar: TabBar
  private editor: EditorComponent
  private statusBar: StatusBar
  private settingsView: SettingsView
  private rightBar: RightBar
  private themeModal: ThemeModal
  private fuzzyFinder: FuzzyFinder
  private graphView: GraphView
  private tabHandlers!: TabHandlersImpl
  private wikiLinkService!: WikiLinkService
  private previewHandlers!: PreviewHandlers
  private vaultPicker!: VaultPicker

  constructor() {
    this.activityBar = new ActivityBar('activityBar')
    this.sidebar = new SidebarTree('sidebar')
    this.tabBar = new TabBar('tabBar')
    this.editor = new EditorComponent('editorContainer')
    this.statusBar = new StatusBar('statusBar')
    this.attachSyncEvents()
    this.settingsView = new SettingsView('settingsHost')
    this.rightBar = new RightBar('rightPanel')
    this.themeModal = new ThemeModal('app') // Mount to app container
    this.fuzzyFinder = new FuzzyFinder('app')
    this.graphView = new GraphView() // Mount to app container
    this.tabHandlers = new TabHandlersImpl(
      this.tabBar,
      this.statusBar,
      this.editor,
      () => this.persistWorkspace(),
      () => this.updateViewVisibility()
    )
    this.wikiLinkService = new WikiLinkService({
      openNote: (id, path) => this.openNote(id, path),
      createNote: (title, path) => this.createNote(title, path),
      getEditorValue: () => this.editor.getValue(),
      setStatus: (message) => this.statusBar.setStatus(message)
    })
    this.previewHandlers = new PreviewHandlers({
      showPreview: (content) => this.editor.showPreview(content),
      updateViewVisibility: () => this.updateViewVisibility(),
      setStatus: (message) => this.statusBar.setStatus(message),
      setMeta: (message) => this.statusBar.setMeta(message),
      updateSidebarSelection: (noteId) => this.sidebar.updateSelection(noteId),
      renderTabBar: () => this.tabBar.render(),
      persistWorkspace: () => this.persistWorkspace()
    })
    this.vaultPicker = new VaultPicker('app')
    this.vaultPicker.setCallbacks({
      onVaultSelected: (path) => this.handleVaultSelected(path),
      onVaultLocated: (originalPath, newPath) => this.handleVaultLocated(originalPath, newPath),
      onChooseNew: () => this.chooseVault()
    })
    this.wireComponents()
    this.registerGlobalShortcuts()
    this.registerVaultChangeListener()
    this.setupMobileEvents()
    this.wireUpdateEvents()
    // Ensure editor resizes correctly when window size changes
    window.addEventListener('resize', () => {
      this.editor.layout()
    })

    // Listen for delete active note event from editor
    window.addEventListener('delete-active-note', () => {
      const activeId = state.activeId
      if (!activeId) return
      const note = state.notes.find((n) => n.id === activeId)
      if (!note) return
      void this.deleteItems([{ id: activeId, type: 'note', path: note.path }])
    })

    // Listen for toggle right sidebar event from editor
    window.addEventListener('toggle-right-sidebar', () => {
      void this.toggleRightSidebar()
    })
  }

  private setupMobileEvents(): void {
    // Disabled mobile-specific behavior (floating sidebar, auto-close) as per user request to keep sidebar attached
    /*
    const handleCheck = (): void => {
      const isSmall = window.matchMedia('(max-width: 800px)').matches
      const shell = document.querySelector('.vscode-shell')

      if (!shell) return

      if (isSmall) {
        shell.classList.add('sidebar-hidden')
      }
      // Do NOT auto-open on large screens. Let the user decide.
    }

    // Run once on init
    handleCheck()

    // Check on resize
    window.addEventListener('resize', handleCheck)

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      // Only run on mobile/small screens
      if (!window.matchMedia('(max-width: 800px)').matches) return

      const target = e.target as HTMLElement
      // Do not close if clicking inside sidebar, activity bar, modal, or context menu
      if (target.closest('.sidebar') || target.closest('.activitybar') || target.closest('.graph-modal') || target.closest('.context-menu')) return

      // Do not close if clicking the specific toggle button (usually in activity bar, but just in case)
      if (target.closest('[data-action="toggle-sidebar"]')) return

      const shell = document.querySelector('.vscode-shell')
      // If sidebar is visible (shell does NOT have .sidebar-hidden), hide it
      if (shell && !shell.classList.contains('sidebar-hidden')) {
        this.sidebar.hide()
      }
    })
    */
  }

  private wireComponents(): void {
    // Activity bar handlers
    this.activityBar.setViewChangeHandler((view) => {
      if (view === 'settings') {
        void this.openSettings()
        return
      }
      if (view === 'theme') {
        this.themeModal.open()
        return
      }
      if (view === 'graph') {
        this.graphView.open()
        return
      }

      const isSidebarView = view === 'notes' || view === 'search'
      this.sidebar.setVisible(isSidebarView)

      if (view === 'search') {
        this.sidebar.setMode('search')
      } else if (view === 'notes') {
        this.sidebar.setMode('explorer')
      }

      // Trigger editor layout to follow the sidebar transition
      // We do this multiple times over the 200ms transition for smoothness
      const startTime = Date.now()
      const duration = 250 // slightly longer than 200ms transition
      const layoutLoop = (): void => {
        this.editor.layout()
        if (Date.now() - startTime < duration) {
          requestAnimationFrame(layoutLoop)
        }
      }
      requestAnimationFrame(layoutLoop)

      // TODO: Handle search view if different pane
    })

    // Sidebar handlers
    // this.sidebar.setNoteSelectHandler((id, path) => void this.openNote(id, path, 'sidebar'))
    this.sidebar.setNoteSelectHandler((id, path) => void this.openNote(id, path, 'editor'))
    this.sidebar.setNoteCreateHandler((path) => void this.createNote(undefined, path))
    this.sidebar.setNoteDeleteHandler((id, path) => void this.deleteNote(id, path))
    this.sidebar.setItemsDeleteHandler((items) => void this.deleteItems(items))
    this.sidebar.setNoteMoveHandler((id, from, to) => this.handleNoteMove(id, from, to))
    this.sidebar.setFolderMoveHandler((source, target) => this.handleFolderMove(source, target))
    this.sidebar.setFolderCreateHandler((parentPath) => void this.createFolder(parentPath))
    this.sidebar.setVisibilityChangeHandler((visible) => {
      void window.api.updateSettings({ sidebarVisible: visible } as Partial<AppSettings>)
    })
    this.sidebar.setGraphClickHandler(() => this.graphView.open())

    // Note: Handler is registered below at line 201 via handleEditorContextMenu

    // Graph Navigation
    window.addEventListener('knowledge-hub:open-note', ((e: CustomEvent) => {
      const { id, path } = e.detail
      this.openNote(id, path)
    }) as EventListener)

    window.addEventListener('knowledge-hub:toggle-right-sidebar', () => {
      void this.toggleRightSidebar()
    })

    // Fuzzy Finder
    this.fuzzyFinder.setSelectHandler(async (id, path, type, isFinal) => {
      if (type === 'folder') {
        void this.revealPathInSidebar(path, true)
        this.statusBar.setStatus(`Revealed folder: ${id}`)
      } else {
        // Only focus editor if it's the final selection (Enter or click)
        await this.openNote(id, path, isFinal ? 'editor' : 'none')
      }
    })

    // Register commands in fuzzy finder
    this.fuzzyFinder.registerCommands([
      {
        id: 'reload-vault',
        label: 'Reload Vault',
        description: 'Reload the vault from disk',
        handler: () => this.reloadVault()
      },
      {
        id: 'reload-window',
        label: 'Reload Window',
        description: 'Reload the application window',
        handler: () => window.location.reload()
      },
      {
        id: 'backup-gist',
        label: 'Backup to Gist',
        description: 'Backup vault to GitHub Gist',
        handler: async () => {
          const settings = await window.api.getSettings()
          const token = (settings as any)?.gistToken
          if (!token) {
            notificationManager.show('Please configure GitHub token in Settings > Sync', 'warning')
            return
          }
          const statusBarEl = document.getElementById('statusBar')
          if (statusBarEl) {
            statusBarEl.dispatchEvent(
              new CustomEvent('sync-action', { detail: { action: 'backup' }, bubbles: true })
            )
          }
        }
      },
      {
        id: 'restore-gist',
        label: 'Restore from Gist',
        description: 'Restore vault from GitHub Gist',
        handler: async () => {
          const settings = await window.api.getSettings()
          const token = (settings as any)?.gistToken
          const gistId = (settings as any)?.gistId
          if (!token) {
            notificationManager.show('Please configure GitHub token in Settings > Sync', 'warning')
            return
          }
          if (!gistId) {
            notificationManager.show('No Gist ID configured. Please backup first.', 'warning')
            return
          }
          const statusBarEl = document.getElementById('statusBar')
          if (statusBarEl) {
            statusBarEl.dispatchEvent(
              new CustomEvent('sync-action', { detail: { action: 'restore' }, bubbles: true })
            )
          }
        }
      }
    ])

    // Tab handlers
    this.tabBar.setTabSelectHandler(async (id) => {
      // Close any preview tabs when switching to a different tab
      this.previewHandlers.closePreviewTabs(id)

      if (id === 'settings') {
        await this.openSettings()
      } else if (this.previewHandlers.isPreviewTab(id)) {
        // Handle preview tab
        const noteId = this.previewHandlers.getNoteIdFromPreviewTab(id)
        const tab = state.openTabs.find((t) => t.id === id)
        if (tab) {
          await this.previewHandlers.showPreviewTab(noteId, tab.path)
        }
      } else {
        const tab = state.openTabs.find((t) => t.id === id)
        if (tab) await this.openNote(tab.id, tab.path)
      }
    })
    this.tabBar.setTabCloseHandler(
      (id) =>
        void this.tabHandlers.closeTab(
          id,
          false,
          async (id, path) => {
            await window.api.deleteNote(id, path)
          },
          () => this.refreshNotes(),
          (id, path) => this.openNote(id, path),
          () => this.editor.showEmpty()
        )
    )
    this.tabBar.setTabContextMenuHandler((id, e) => {
      this.tabHandlers.handleTabContextMenu(
        id,
        e,
        (id, force) => this.closeTab(id, force),
        (id) => this.closeOtherTabs(id),
        () => this.closeAllTabs()
      )
    })

    this.settingsView.setVaultCallbacks({
      onVaultChange: () => this.chooseVault(),
      onVaultReveal: async () => {
        await window.api.revealVault()
      },
      onVaultSelected: (path) => this.handleVaultSelected(path),
      onVaultLocated: (originalPath, newPath) => this.handleVaultLocated(originalPath, newPath)
    })
    this.settingsView.setSettingChangeHandler(async (newSettings) => {
      if (state.settings) {
        state.settings = { ...state.settings, ...newSettings }
        if (state.settings) {
          this.editor.applySettings(state.settings)
        }
        void window.api.updateSettings(newSettings as Partial<AppSettings>)
        this.statusBar.setStatus('Settings auto-saved')

        // Refresh API key in rightbar if it was updated
        if (newSettings.deepseekApiKey !== undefined) {
          await aiService.loadApiKey()
          await this.rightBar.refreshApiKey()
        }
      }
    })

    // Editor handlers
    this.editor.setContentChangeHandler(() => {
      this.statusBar.setStatus('Unsaved changes')
      this.tabBar.render()
    })

    this.editor.setSaveHandler((payload) => void this.saveNote(payload))
    this.editor.setDropHandler((path, isFile) => this.handleDrop(path, isFile))
    this.editor.setLinkClickHandler((target) => void this.wikiLinkService.openWikiLink(target))
    this.editor.setHoverContentHandler((target) => this.wikiLinkService.getNotePreview(target))
    this.editor.setContextMenuHandler((e) => this.handleEditorContextMenu(e))
    this.editor.setTabCloseHandler(() => {
      if (state.activeId) {
        if (state.pinnedTabs.has(state.activeId)) {
          this.statusBar.setStatus('Pinned tab cannot be closed')
          return
        }
        void this.closeTab(state.activeId)
      }
    })
    this.editor.attachKeyboardShortcuts()

    this.themeModal.setThemeChangeHandler((themeId) => {
      this.editor.applySettings({ ...state.settings, theme: themeId })
    })

    // Set editor context for AI chat
    this.rightBar.setEditorContext(
      () => this.editor.getValue(),
      () => {
        if (state.activeId && state.activeId !== 'settings') {
          const note = state.notes.find((n) => n.id === state.activeId)
          if (note) {
            return { title: note.title, id: note.id }
          }
        }
        return null
      }
    )
  }

  // ... registerGlobalShortcuts, registerVaultChangeListener ...

  private async closeOtherTabs(id: string): Promise<void> {
    await this.tabHandlers.closeOtherTabs(id, (id, force) => this.closeTab(id, force))
  }

  private async closeAllTabs(): Promise<void> {
    await this.tabHandlers.closeAllTabs((id, force) => this.closeTab(id, force))
  }

  // ...

  // Updated persistWorkspace
  private async persistWorkspace(): Promise<void> {
    try {
      await window.api.updateSettings({
        openTabs: state.openTabs.map((t) => ({ id: t.id, path: t.path })),
        activeId: state.activeId,
        pinnedTabs: Array.from(state.pinnedTabs)
      } as any)
    } catch (e) {
      console.error('Failed to persist workspace', e)
    }
  }

  // Updated initSettings
  private async initSettings(): Promise<void> {
    try {
      state.settings = await window.api.getSettings()

      if (state.settings.expandedFolders) {
        state.expandedFolders = new Set(state.settings.expandedFolders)
      }

      if (state.settings.pinnedTabs) {
        state.pinnedTabs = new Set(state.settings.pinnedTabs)
      }

      if (state.settings.theme) {
        themeManager.setTheme(state.settings.theme)
      }

      // Restore active view first
      if (
        state.settings?.activeView &&
        ['notes', 'search', 'settings'].includes(state.settings.activeView)
      ) {
        setTimeout(() => {
          this.activityBar.setActiveView(
            state.settings!.activeView as 'notes' | 'search' | 'settings'
          )
          // Restore sidebar visibility AFTER active view is set (with additional delay to ensure view change handler completes)
          setTimeout(() => {
            const settings = state.settings
            if (settings && typeof settings.sidebarVisible !== 'undefined') {
              this.sidebar.setVisible(settings.sidebarVisible)
            }
          }, 50)
        }, 200)
      } else {
        // If no active view to restore, just restore sidebar visibility
        if (typeof state.settings.sidebarVisible !== 'undefined') {
          this.sidebar.setVisible(state.settings.sidebarVisible)
        }
      }

      if (state.settings) {
        this.editor.applySettings(state.settings)
      }

      // Restore right panel visibility and width
      if (state.settings) {
        const rightPanel = document.getElementById('rightPanel') as HTMLElement
        const shell = document.querySelector('.vscode-shell') as HTMLElement

        if (rightPanel && shell) {
          const rpw = state.settings.rightPanelWidth
          const isVisible = state.settings.rightPanelVisible !== false // Default to true if not set (for backward compatibility)

          if (isVisible) {
            // Restore width and show panel
            const w = typeof rpw === 'number' && rpw > 0 ? Math.max(200, Math.min(800, rpw)) : 270
            rightPanel.style.display = 'block'
            shell.style.setProperty('--right-panel-width', `${w}px`)
          } else {
            // Hide panel
            rightPanel.style.display = 'none'
            shell.style.setProperty('--right-panel-width', '0px')
          }
        }
      }
    } catch (error) {
      console.error('Failed to load settings', error)
    }
  }

  // ...

  // closeTab delegated to tabHandlers
  private async closeTab(id: string, force = false): Promise<void> {
    await this.tabHandlers.closeTab(
      id,
      force,
      async (id, path) => {
        await window.api.deleteNote(id, path)
      },
      () => this.refreshNotes(),
      (id, path) => this.openNote(id, path),
      () => this.editor.showEmpty()
    )
  }
  private registerVaultChangeListener(): void {
    window.addEventListener('vault-changed', () => {
      void this.refreshNotes()
      void this.saveExpandedFolders()
    })

    window.addEventListener('status', ((event: CustomEvent) => {
      const message = (event.detail && (event.detail.message as string)) || ''
      if (message) this.statusBar.setStatus(message)
    }) as EventListener)

    window.addEventListener('item-rename', (async (event: CustomEvent) => {
      const { id, type, newTitle } = event.detail

      // Remove from newly created list once user interacts
      state.newlyCreatedIds.delete(id)

      if (id === newTitle || !newTitle.trim()) {
        this.statusBar.setStatus('Rename finished')
        await this.refreshNotes()
        return
      }

      try {
        // If the folder/note with same name already exists, show error clearly
        if (type === 'folder') {
          await this.renameFolder(id, newTitle)
        } else {
          await this.renameNote(id, newTitle)
        }
      } catch (err: any) {
        let message = (err as Error).message || ''

        if (message.includes('already exists') || message.includes('EEXIST')) {
          message = `Name "${newTitle}" already taken`
          notificationManager.show(message, 'error', { title: 'Duplicate Name' })
        } else if (message.includes('EPERM')) {
          message = 'Permission denied (file in use?)'
          notificationManager.show(message, 'error', { title: 'Rename Failed' })
        } else {
          notificationManager.show(message, 'error', { title: 'Error' })
        }

        this.statusBar.setStatus(`⚠️ ${message}`)

        // Vital: Refresh to revert the UI change (the optimistic rename)
        await this.refreshNotes()
      }
    }) as unknown as EventListener)
  }

  private async renameFolder(id: string, newName: string): Promise<void> {
    const oldPath = id

    const result = await window.api.renameFolder(oldPath, newName)
    const actualNewPath = result.path

    // Update expandedFolders to prevent collapse
    if (state.expandedFolders.has(oldPath)) {
      state.expandedFolders.delete(oldPath)
      state.expandedFolders.add(actualNewPath)
    }

    // Update any open tabs that might be inside this folder
    let activeChanged = false
    state.openTabs = state.openTabs.map((tab) => {
      if (tab.path === oldPath || tab.path?.startsWith(oldPath + '/')) {
        const newTabPath = tab.path.replace(oldPath, actualNewPath)
        // Note IDs are path-based, so they also need updating
        const newId = tab.id.startsWith(oldPath) ? tab.id.replace(oldPath, actualNewPath) : tab.id

        if (state.activeId === tab.id) {
          state.activeId = newId
          activeChanged = true
        }

        if (state.pinnedTabs.has(tab.id)) {
          state.pinnedTabs.delete(tab.id)
          state.pinnedTabs.add(newId)
        }

        return { ...tab, id: newId, path: newTabPath }
      }
      return tab
    })

    this.statusBar.setStatus(`Renamed folder to ${newName}`)
    await this.saveExpandedFolders()

    // If active note was in the renamed folder, we might need to re-open or update editor state
    if (activeChanged) {
      // Force update editor? usually openNote handles it if we called it,
      // but here we just updated state.
      // We relies on refreshNotes to re-render tree, but editor content is fine (same file).
    }

    await this.refreshNotes()
  }

  private async saveExpandedFolders(): Promise<void> {
    try {
      await window.api.updateSettings({
        expandedFolders: Array.from(state.expandedFolders)
      })
    } catch (error) {
      console.error('Failed to save expanded folders', error)
    }
  }

  private handleEditorContextMenu(e: MouseEvent): void {
    e.preventDefault()

    contextMenu.show(e.clientX, e.clientY, [
      {
        label: 'Cut',
        keybinding: 'Ctrl+X',
        onClick: () => {
          this.editor.focus()
          this.editor.triggerAction('editor.action.clipboardCutAction')
        }
      },
      {
        label: 'Copy',
        keybinding: 'Ctrl+C',
        onClick: () => {
          this.editor.focus()
          this.editor.triggerAction('editor.action.clipboardCopyAction')
        }
      },
      {
        label: 'Paste',
        keybinding: 'Ctrl+V',
        onClick: () => {
          this.editor.focus()
          this.editor.triggerAction('editor.action.clipboardPasteAction')
        }
      },
      { separator: true },
      {
        label: 'Smart Paste',
        onClick: () => {
          this.editor.focus()
          // Logic for smart paste: this is a placeholder for future AI/Sanitize features
          this.editor.triggerAction('editor.action.clipboardPasteAction')
        }
      },
      {
        label: 'Insert Data',
        onClick: () => {
          const date = new Date().toLocaleDateString()
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          this.editor.insertAtCursor(`${date} ${time}`)
        }
      },
      { separator: true },
      {
        label: 'Delete',
        onClick: () => {
          this.editor.focus()
          this.editor.triggerAction('editor.action.deleteLines')
        }
      },
      {
        label: 'Select All',
        keybinding: 'Ctrl+A',
        onClick: () => {
          this.editor.focus()
          this.editor.triggerAction('editor.action.selectAll')
        }
      },
      { separator: true },
      {
        label: 'Open Preview',
        keybinding: 'Ctrl+\\',
        onClick: () => {
          void this.previewHandlers.openPreviewTab()
        }
      },
      {
        label: 'Details',
        keybinding: 'Ctrl+I',
        onClick: () => {
          this.showDetailsModal()
        }
      },
      { separator: true },
      {
        label: 'Knowledge Graph',
        keybinding: 'Alt+G',
        onClick: () => this.graphView.open()
      }
    ])
  }

  private registerGlobalShortcuts(): void {
    keyboardManager.register({
      key: 'Alt+g',
      scope: 'global',
      description: 'Open Knowledge Graph',
      handler: () => {
        this.graphView.open()
      }
    })

    keyboardManager.register({
      key: 'Control+p',
      scope: 'global',
      description: 'Quick Open',
      handler: () => {
        this.fuzzyFinder.toggle('notes')
      }
    })

    keyboardManager.register({
      key: 'Control+Shift+p',
      scope: 'global',
      description: 'Command Palette',
      handler: () => {
        this.fuzzyFinder.toggle('commands')
      }
    })

    keyboardManager.register({
      key: 'Control+i',
      scope: 'global',
      description: 'Toggle Right Sidebar',
      handler: () => {
        void this.toggleRightSidebar()
      }
    })

    keyboardManager.register({
      key: 'Control+Shift+r',
      scope: 'global',
      description: 'Reload vault',
      handler: () => {
        void this.reloadVault()
      }
    })

    keyboardManager.register({
      key: 'Control+Shift+v',
      scope: 'global',
      description: 'Choose vault folder',
      handler: () => {
        void this.chooseVault()
      }
    })

    keyboardManager.register({
      key: 'Control+n',
      scope: 'global',
      description: 'Create new note',
      handler: () => {
        void this.createNote()
      }
    })

    keyboardManager.register({
      key: 'Control+s',
      scope: 'global',
      description: 'Save current note',
      handler: () => {
        this.editor.manualSave()

        // If the note is new/untitled, prompt for rename after saving content
        const note = state.notes.find((n) => n.id === state.activeId)
        if (note && note.title === 'Untitled note') {
          void this.promptRenameActiveNote()
        }
      }
    })

    keyboardManager.register({
      key: 'Control+r',
      scope: 'global',
      description: 'Rename active note',
      handler: () => {
        void this.promptRenameActiveNote()
      }
    })

    keyboardManager.register({
      key: 'Control+b',
      scope: 'global',
      description: 'Toggle sidebar',
      handler: () => {
        this.sidebar.toggle()
      }
    })

    keyboardManager.register({
      key: 'Control+d',
      scope: 'global',
      description: 'Delete active note',
      handler: () => {
        const activeId = state.activeId
        if (!activeId) return
        const note = state.notes.find((n) => n.id === activeId)
        if (!note) return
        void this.deleteItems([{ id: activeId, type: 'note', path: note.path }])
      }
    })

    keyboardManager.register({
      key: 'Control+,',
      scope: 'global',
      description: 'Open settings',
      handler: () => {
        void this.openSettings()
      }
    })
  }

  async init(): Promise<void> {
    this.statusBar.setStatus('Initializing...')
    await this.initSettings()
    await this.initVault()

    if (state.settings?.openTabs && state.settings.openTabs.length > 0) {
      state.openTabs = [...state.settings.openTabs] as any
    }

    await this.refreshNotes()

    if (state.openTabs.length > 0) {
      this.statusBar.setStatus('Restoring workspace...')
      const toOpen = state.settings?.activeId || state.openTabs[0].id
      const noteToOpen =
        state.notes.find((n) => n.id === toOpen) ||
        state.notes.find((n) => n.id === state.openTabs[0].id)

      if (noteToOpen) {
        await this.openNote(noteToOpen.id, noteToOpen.path)
      } else if (toOpen === 'settings') {
        // Handle settings tab restore
        await this.openSettings()
      } else {
        if (state.notes.length > 0) await this.openNote(state.notes[0].id)
        else this.editor.showEmpty()
      }
    } else if (state.notes.length > 0) {
      await this.openNote(state.notes[0].id)
    } else {
      this.editor.showEmpty()
      this.statusBar.setStatus('No notes yet')
      this.statusBar.setMeta('Create a note to begin')
    }

    this.tabBar.render()
    this.updateViewVisibility()
    document.body.classList.remove('is-loading')

    // Global context menu suppression to prevent browser default appearing over custom menus
    window.addEventListener(
      'contextmenu',
      (e) => {
        const target = e.target as HTMLElement
        if (target.closest('.vscode-shell')) {
          // If we don't handle it specifically, we still want to block the browser's ugly menu
          // Our components (sidebar, editor, tabs) handle their own and call e.preventDefault()
          // This is a safety net.
        }
      },
      true
    )
  }

  private async initVault(): Promise<void> {
    try {
      const settings = await window.api.getSettings()
      const savedVaultPath = (settings as { vaultPath?: string }).vaultPath

      // Phase 1: Validate vault path
      if (savedVaultPath) {
        const validation = await vaultService.validateVaultPath(savedVaultPath)

        if (validation.isValid) {
          // Vault exists, proceed normally
          const info = await window.api.getVault()
          state.vaultPath = info.path
          state.projectName = info.name || 'Vault'
          this.statusBar.setMeta(`📁 ${info.path}`)
          return
        } else {
          // Phase 3: Try to locate moved vault
          const foundPath = await vaultService.locateMovedVault(savedVaultPath)
          if (foundPath) {
            // Found it! Update and continue
            await vaultService.openVault(foundPath)
            const info = await window.api.getVault()
            state.vaultPath = info.path
            state.projectName = info.name || 'Vault'
            this.statusBar.setStatus('Vault location updated')
            this.statusBar.setMeta(`📁 ${info.path}`)
            return
          }

          // Phase 2: Show vault picker with error
          await this.vaultPicker.show({
            path: savedVaultPath,
            error: validation.error || 'Vault path does not exist',
            suggestion: validation.suggestion
          })
          return
        }
      }

      // No saved vault, show picker
      await this.vaultPicker.show()
    } catch (error) {
      console.error('Failed to load vault info', error)
      this.statusBar.setStatus('⚠️ Vault unavailable')
      this.statusBar.setMeta('Press Ctrl+Shift+V to select a vault')
      await this.vaultPicker.show()
    }
  }

  private async chooseVault(): Promise<void> {
    try {
      this.statusBar.setStatus('Selecting vault folder...')
      const info = await vaultService.chooseVault()

      if (!info.changed) {
        this.statusBar.setStatus('Ready')
        this.vaultPicker.hide()
        return
      }

      await this.handleVaultSelected(info.path)
      this.vaultPicker.hide()
    } catch (error) {
      const message = (error as Error).message || 'Unknown error'
      console.error('Vault selection failed', error)
      this.statusBar.setStatus(`⚠️ ${message}`)
      this.statusBar.setMeta('Press Ctrl+Shift+V to try again')
    }
  }

  private async handleVaultSelected(path: string): Promise<void> {
    const result = await vaultService.openVault(path)
    if (!result.success) {
      this.statusBar.setStatus(`⚠️ ${result.error || 'Failed to open vault'}`)
      return
    }

    state.vaultPath = path
    state.projectName = vaultService.getVaultName(path) || 'Vault'

    // Clear all tabs from the previous vault - they won't exist in the new vault
    state.openTabs = []
    state.activeId = ''
    state.pinnedTabs.clear()
    state.newlyCreatedIds.clear()
    this.tabBar.render()

    this.statusBar.setStatus('Loading vault...')
    await this.refreshNotes()

    if (state.notes.length > 0) {
      await this.openNote(state.notes[0].id)
      this.statusBar.setStatus(
        `Loaded ${state.notes.length} note${state.notes.length === 1 ? '' : 's'}`
      )
    } else {
      state.activeId = ''
      this.editor.showEmpty()
      this.statusBar.setStatus('Empty vault')
      this.statusBar.setMeta('Create a note to begin')
    }
    this.updateViewVisibility()
    this.statusBar.setMeta(`📁 ${path}`)

    // Update settings view if it's open
    this.settingsView.updateVaultPath()
  }

  private async handleVaultLocated(_originalPath: string, newPath: string): Promise<void> {
    await this.handleVaultSelected(newPath)
    this.statusBar.setStatus('Vault location updated')
  }

  private async openSettings(): Promise<void> {
    state.activeId = 'settings'

    // Ensure "Settings" tab exists
    tabService.ensureTab({
      id: 'settings',
      title: 'Settings',
      updatedAt: 0,
      path: undefined,
      type: undefined
    })

    this.tabBar.render()
    this.updateViewVisibility()
    this.settingsView.update()
    this.statusBar.setStatus('Settings Editor')
  }

  private updateViewVisibility(): void {
    const editorCont = document.getElementById('editorContainer')
    const settingsHost = document.getElementById('settingsHost')

    if (state.activeId === 'settings') {
      if (editorCont) editorCont.style.display = 'none'
      if (settingsHost) settingsHost.style.display = 'flex'
    } else {
      if (editorCont) editorCont.style.display = 'flex'
      if (settingsHost) settingsHost.style.display = 'none'
      this.editor.layout() // Recalculate layout when coming back
    }
  }

  private async refreshNotes(): Promise<void> {
    const rawNotes = await window.api.listNotes()
    state.tree = buildTree(rawNotes)
    // Keep state.notes as flat list of notes (excluding folders) for search/fuzz
    state.notes = rawNotes.filter((n) => n.type !== 'folder')

    sortNotes(state.notes)

    // Clean up expandedFolders - remove folders that no longer exist
    const allFolderIds = new Set<string>()
    const collectFolderIds = (items: TreeItem[]): void => {
      items.forEach((item) => {
        if (item.type === 'folder') {
          allFolderIds.add(item.id)
          if (item.children) {
            collectFolderIds(item.children)
          }
        }
      })
    }
    collectFolderIds(state.tree)

    // Remove deleted folders from expandedFolders
    const beforeSize = state.expandedFolders.size
    state.expandedFolders.forEach((id) => {
      if (!allFolderIds.has(id)) {
        state.expandedFolders.delete(id)
      }
    })

    // Save if we removed any
    if (state.expandedFolders.size !== beforeSize) {
      await this.saveExpandedFolders()
    }

    // Ensure active note metadata is fresh
    if (state.activeId && state.activeId !== 'settings') {
      const found = state.notes.find((n) => n.id === state.activeId)
      if (!found) {
        // Note might have been deleted or moved outside?
      }
    }

    // Sync tabs
    tabService.syncTabs()

    this.sidebar.renderTree(this.sidebar.getSearchValue())
    this.tabBar.render()
  }

  private async createNote(title?: string, path?: string): Promise<void> {
    const meta = await window.api.createNote(title || '', path)
    state.newlyCreatedIds.add(meta.id)

    // Ensure parent folder is expanded
    if (path) {
      state.expandedFolders.add(path)
    }

    await this.refreshNotes()

    this.statusBar.setStatus(`Created note "${meta.title}"`)
    void this.persistWorkspace()

    // Start rename in sidebar
    setTimeout(() => {
      this.sidebar.startRename(meta.id)
    }, 100)
  }

  private async openNote(
    id: string,
    path?: string,
    focusTarget: 'editor' | 'sidebar' | 'none' = 'editor'
  ): Promise<void> {
    // Switch to notes view when opening a note from fuzzy finder
    this.activityBar.setActiveView('notes')
    // We no longer automatically hide the sidebar on mobile here.
    // The user can explicitly close it or we can close it when they focus the editor.

    const note = await window.api.loadNote(id, path)
    if (!note) {
      // Try to refresh notes and check again before warning
      await this.refreshNotes()
      // Check for both id and path match
      const refreshed = state.notes.find((n) => n.id === id || n.path === path)
      if (refreshed) {
        // Note is now found after refresh, open it
        await this.openNote(refreshed.id, refreshed.path, focusTarget)
        return
      }
      // Only show notification if truly missing
      console.warn(`[App] Note "${id}" not found at path "${path || 'root'}". Refreshing...`)
      notificationManager.show(
        `Note "${id}" could not be found. It may have been renamed, moved, or deleted.`,
        'warning',
        { title: 'Note Not Found' }
      )
      this.statusBar.setStatus('Note missing on disk')
      if (state.activeId === id || !state.activeId) {
        this.editor.showEmpty()
      }
      return
    }

    state.activeId = id
    state.lastSavedAt = note.updatedAt

    if (focusTarget !== 'none') {
      tabService.ensureTab(note)
    }

    // If switching from preview tab, make sure editor is visible
    if (this.editor.isPreviewMode) {
      this.editor.isPreviewMode = false
      const editorHost = this.editor['editorHost'] as HTMLElement
      const previewHost = this.editor['previewHost'] as HTMLElement
      if (editorHost) editorHost.style.display = 'block'
      if (previewHost) previewHost.style.display = 'none'
    }

    await this.editor.loadNote(note)
    this.updateViewVisibility()
    this.statusBar.setStatus('Ready')
    this.statusBar.setMeta(`📁 ${state.vaultPath || ''}`)

    // Details modal can be opened via keyboard shortcut

    // Always update sidebar selection to match active note
    this.sidebar.updateSelection(id)

    if (focusTarget === 'sidebar') {
      this.sidebar.scrollToActive(true)
    } else {
      this.sidebar.scrollToActive(false)
      if (focusTarget === 'editor') {
        this.editor.focus()
      }
    }

    this.tabBar.render()
    void this.persistWorkspace()
  }

  private revealPathInSidebar(path?: string, isFolder = false): boolean {
    if (!path) return false

    const parts = path.split(/[\\/]/)
    let currentPath = ''
    let changed = false

    parts.forEach((part, index) => {
      if (!part) return
      currentPath = currentPath ? `${currentPath}-${part}` : part

      if (index < parts.length - 1 || isFolder) {
        const folderId = currentPath
        if (!state.expandedFolders.has(folderId)) {
          state.expandedFolders.add(folderId)
          changed = true
        }
      }
    })

    if (changed) {
      void this.saveExpandedFolders()
      this.sidebar.renderTree(this.sidebar.getSearchValue())
      return true
    }

    return false
  }
  private async saveNote(payload: NotePayload): Promise<void> {
    if (!state.activeId) return

    const meta = await window.api.saveNote(payload)
    state.newlyCreatedIds.delete(payload.id) // It's no longer "untouched"
    state.lastSavedAt = meta.updatedAt
    state.isDirty = false

    const idx = state.notes.findIndex((n) => n.id === meta.id)
    if (idx >= 0) {
      state.notes[idx] = { ...meta }
    } else {
      state.notes.unshift(meta)
    }

    sortNotes(state.notes)
    tabService.ensureTab(meta)
    // Update existing tab if it exists
    const tabIndex = state.openTabs.findIndex((t) => t.id === meta.id)
    if (tabIndex >= 0) {
      state.openTabs[tabIndex] = meta
    }
    tabService.syncTabs()

    this.sidebar.renderTree(this.sidebar.getSearchValue())
    this.tabBar.render()
    this.statusBar.setStatus('Autosaved')
    this.statusBar.setMeta(`📁 ${state.vaultPath || ''}`)
  }
  private showDeleteConfirmationModal(
    items: { id: string; type: 'note' | 'folder'; path?: string }[],
    onConfirm: () => Promise<void>
  ): void {
    if (items.length === 0) return

    const count = items.length
    const label = count === 1 ? (items[0].type === 'note' ? 'note' : 'folder') : 'items'

    modalManager.open({
      title: `Delete ${count > 1 ? count + ' ' : ''}${label}`,
      content: `Are you sure you want to delete ${count === 1 ? 'this ' + label : 'these ' + count + ' items'}? This action cannot be undone.`,
      size: 'md',
      buttons: [
        {
          label: 'Delete',
          variant: 'danger',
          onClick: async (m) => {
            m.close()
            await onConfirm()
          }
        },
        { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() }
      ]
    })
  }

  private async deleteItems(
    items: { id: string; type: 'note' | 'folder'; path?: string }[]
  ): Promise<void> {
    this.showDeleteConfirmationModal(items, async () => {
      this.statusBar.setStatus(`Deleting ${items.length} items...`)

      try {
        const result = await noteService.deleteItems(items)

        if (result.success) {
          this.statusBar.setStatus(`${items.length} items deleted`)
          window.dispatchEvent(new CustomEvent('vault-changed'))

          // If the active note was deleted, switch
          const ancoraActive = state.openTabs.find((t) => t.id === state.activeId)
          if (!ancoraActive) {
            const nextTab = tabService.findNextTabToOpen()
            if (nextTab) {
              await this.openNote(nextTab.id, nextTab.path)
            } else {
              state.activeId = ''
              this.editor.showEmpty()
            }
          }
        } else {
          this.statusBar.setStatus('Some items could not be deleted')
          if (result.errors.length > 0) {
            console.error('Delete errors:', result.errors)
          }
        }

        await this.refreshNotes()
      } catch (error) {
        console.error('Bulk delete failed', error)
        this.statusBar.setStatus('Some items could not be deleted')
        await this.refreshNotes()
      }
    })
  }

  private async deleteNote(id: string, path?: string): Promise<void> {
    await this.deleteItems([{ id, type: 'note', path }])
  }

  private async handleNoteMove(id: string, fromPath?: string, toPath?: string): Promise<void> {
    try {
      const newMeta = await window.api.moveNote(id, fromPath, toPath)

      // Update tabs and active state
      let updatedTabs = false
      state.openTabs = state.openTabs.map((tab) => {
        if (tab.id === id) {
          updatedTabs = true
          return { ...newMeta }
        }
        return tab
      })

      if (state.activeId === id) {
        state.activeId = newMeta.id
      }

      if (state.pinnedTabs.has(id)) {
        state.pinnedTabs.delete(id)
        state.pinnedTabs.add(newMeta.id)
      }

      if (updatedTabs) {
        this.tabBar.render()
      }

      await this.refreshNotes()
    } catch (error) {
      console.error('Note move failed:', error)
      this.statusBar.setStatus('Move failed')
    }
  }

  private async handleFolderMove(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await noteService.moveFolder(sourcePath, targetPath)
      this.tabBar.render()
      await this.refreshNotes()
    } catch (error) {
      console.error('Folder move failed:', error)
      this.statusBar.setStatus('Move failed')
    }
  }

  private async createFolder(parentPath?: string): Promise<void> {
    try {
      const result = await window.api.createFolder('New Folder', parentPath)
      state.newlyCreatedIds.add(result.path)

      if (parentPath) {
        state.expandedFolders.add(parentPath)
      }

      await this.refreshNotes()
      this.statusBar.setStatus(`Created folder "${result.name}"`)

      // Start rename in sidebar
      setTimeout(() => {
        this.sidebar.startRename(result.path)
      }, 100)
    } catch (error) {
      const message = (error as Error).message || 'Unknown error'
      this.statusBar.setStatus(`Failed: ${message}`)
      console.error('Folder creation failed:', error)
    }
  }

  private async promptRenameActiveNote(): Promise<void> {
    const activeId = state.activeId
    if (!activeId) return

    const note = state.notes.find((n) => n.id === activeId)
    if (!note) return

    const header = this.createModalHeader('Rename Note')
    modalManager.open({
      customHeader: header,
      size: 'sm',
      inputs: [
        {
          name: 'noteTitle',
          label: 'Note Title',
          value: note.title,
          required: true
        }
      ],
      buttons: [
        { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() },
        {
          label: 'Rename',
          variant: 'primary',
          onClick: async (m) => {
            const values = m.getValues()
            const newTitle = (values.noteTitle as string)?.trim()
            if (!newTitle) {
              m.close()
              return
            }
            await this.renameNote(activeId, newTitle)
            m.close()
          }
        }
      ]
    })
  }

  private createModalHeader(title: string): HTMLElement {
    const header = document.createElement('div')
    header.style.cssText = 'display: flex; align-items: center; gap: 8px; flex: 1;'
    const titleEl = document.createElement('span')
    titleEl.style.cssText = 'font-size: 16px; font-weight: 700; color: var(--text-strong);'
    titleEl.textContent = title
    header.appendChild(titleEl)
    return header
  }

  private async renameNote(noteId: string, newTitle: string): Promise<void> {
    const isActive = state.activeId === noteId
    let notePath: string | undefined

    // Try to find the note in state.notes first
    let existing = state.notes.find((n) => n.id === noteId)

    // If not found in state, try to find in openTabs (newly created notes might not be in state.notes yet)
    if (!existing) {
      const tabNote = state.openTabs.find((t) => t.id === noteId)
      if (tabNote) {
        existing = tabNote as any
      }
    }

    // If still not found, try refreshing notes first
    if (!existing) {
      await this.refreshNotes()
      existing = state.notes.find((n) => n.id === noteId)
    }

    if (existing) {
      notePath = existing.path
    }

    const newId = newTitle.trim().replace(/[<>:"/\\|?*]/g, '-')
    if (noteId === newId) return

    state.newlyCreatedIds.delete(noteId) // Rename counts as interacting

    try {
      // 1. Rename on disk (changes ID) - noteService handles tab/state updates
      const newMeta = await noteService.renameNote(noteId, newId, notePath)
      const actualNewId = newMeta.id

      // 4. Update activeId if needed (noteService already updated tabs)
      if (isActive) {
        tabService.setActiveTab(actualNewId)
      }

      // 5. Refresh from disk
      await this.refreshNotes()

      // 6. Re-open to ensure editor is synced with new ID
      if (isActive) {
        state.isDirty = false
        // Verify note exists before opening
        const refreshedNote = state.notes.find((n) => n.id === actualNewId)
        if (refreshedNote) {
          await this.openNote(actualNewId, refreshedNote.path)
        } else {
          // If still not found, try loading directly
          const loadedNote = await window.api.loadNote(actualNewId, newMeta.path)
          if (loadedNote) {
            await this.openNote(actualNewId, loadedNote.path)
          } else {
            console.error(`[App] Failed to open renamed note: ${actualNewId}`)
            this.statusBar.setStatus('Note renamed but could not be reopened')
          }
        }
      } else {
        this.tabBar.render()
      }

      this.statusBar.setStatus(`Renamed to "${newTitle}"`)
      void this.persistWorkspace()
    } catch (error) {
      // We propagate the error so callers can handle specific UI reverts.
      // We set a status here as a fallback for callers that don't handle it explicitly.
      this.statusBar.setStatus(`Rename failed: ${(error as Error).message}`)
      throw error
    }
  }

  private async openDroppedVault(folderPath: string): Promise<void> {
    try {
      this.statusBar.setStatus('Opening vault...')
      const info = await window.api.setVault(folderPath)

      state.vaultPath = info.path
      state.projectName = info.name || 'Vault'

      this.statusBar.setStatus('Loading vault...')
      await this.refreshNotes()

      if (state.notes.length > 0) {
        await this.openNote(state.notes[0].id)
        this.statusBar.setStatus(
          `Loaded ${state.notes.length} note${state.notes.length === 1 ? '' : 's'}`
        )
      } else {
        state.activeId = ''
        this.editor.showEmpty()
        this.statusBar.setStatus('Empty vault')
        this.statusBar.setMeta('Create a note to begin')
      }

      this.statusBar.setMeta(`📁 ${info.path}`)
    } catch (error) {
      const message = (error as Error).message || 'Unknown error'
      console.error('Vault open failed', error)
      this.statusBar.setStatus(`⚠️ ${message}`)
    }
  }

  private handleDrop(path: string, isFile: boolean): void {
    // Check for internal note drag (from sidebar)
    if (path.startsWith('note:')) {
      const id = path.substring(5)
      const note = state.notes.find((n) => n.id === id)
      if (note) {
        void this.openNote(note.id, note.path)
        return
      }
    }

    // Ignore internal folder drags from sidebar
    // External paths are absolute (C:\... or /...), internal are relative
    if (!isFile && path && !path.match(/^[a-zA-Z]:[\\\/]|^[\\\/]/)) {
      // This is an internal folder drag - ignore it (handled by sidebar)
      return
    }

    if (isFile) {
      void this.openDroppedFile(path)
    } else {
      void this.openDroppedVault(path)
    }
  }

  private async openDroppedFile(filePath: string): Promise<void> {
    // Check if file is already inside the vault
    const isInternal =
      state.vaultPath && filePath.toLowerCase().startsWith(state.vaultPath.toLowerCase())

    // If it's an internal .md file, just open it
    if (isInternal && filePath.toLowerCase().endsWith('.md')) {
      const name = filePath.split(/[/\\]/).pop() || ''
      const id = name.replace(/\.[^.]+$/, '') // Remove extension

      // Try to find exact note
      let note = state.notes.find((n) => n.id === id)

      // If not found, force refresh in case it was just added externally
      if (!note) {
        await this.refreshNotes()
        note = state.notes.find((n) => n.id === id)
      }

      if (note) {
        void this.openNote(note.id, note.path)
        return
      }
    }

    // If it's internal but NOT .md (e.g. .txt), we allow it to proceed to importNote
    // which will convert it to a new .md note.

    // However, if we blindly import an internal file,
    // we must ensure we don't get read errors if the file is locked
    // or weird permission issues (which caused ENOENT before?).
    // Usually reading your own vault file is fine.

    try {
      this.statusBar.setStatus('Importing file...')

      const imported = await window.api.importNote(filePath)

      this.statusBar.setStatus(`✓ Imported "${imported.title}"`)

      // Refresh tree and open the note
      await this.refreshNotes()
      await this.openNote(imported.id, imported.path)
    } catch (error) {
      const message = (error as Error).message || 'Failed to import file'
      console.error('File import failed', error)
      this.statusBar.setStatus(`⚠️ ${message}`)
    }
  }

  private attachSyncEvents(): void {
    const statusBarEl = document.getElementById('statusBar')
    if (!statusBarEl) return

    // Listen for restore from settings
    window.addEventListener('restore-vault', async (e: Event) => {
      const customEvent = e as CustomEvent<{ backupData: any }>
      const { backupData } = customEvent.detail
      try {
        await this.restoreVaultFromBackup(backupData)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Restore failed'
        notificationManager.show(`Restore failed: ${errorMessage}`, 'error')
      }
    })

    statusBarEl.addEventListener('sync-action', async (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string }>
      const { action } = customEvent.detail

      const settings = await window.api.getSettings()
      const token = (settings as any)?.gistToken
      const gistId = (settings as any)?.gistId

      if (!token) {
        notificationManager.show('Please configure GitHub token in Settings > Sync', 'warning')
        return
      }

      if (action === 'backup') {
        try {
          notificationManager.show('Backing up vault...', 'info')
          const vaultData = await window.api.listNotes()
          const notes = await Promise.all(
            vaultData.filter((n) => n.type !== 'folder').map((n) => window.api.loadNote(n.id))
          )
          const allNotes = notes.filter((n) => n !== null)
          const result = await window.api.syncBackup(token, gistId, allNotes)
          if (result.success) {
            notificationManager.show(result.message, 'success')
            if (result.gistId) {
              await window.api.updateSettings({ gistId: result.gistId } as Partial<AppSettings>)
            }
          } else {
            notificationManager.show(result.message, 'error')
          }
        } catch (error) {
          notificationManager.show('Backup failed', 'error')
        }
      } else if (action === 'restore') {
        if (!gistId) {
          notificationManager.show('No Gist ID configured. Please backup first.', 'warning')
          return
        }
        if (!confirm('Restore will replace your current vault. Continue?')) {
          return
        }
        try {
          notificationManager.show('Restoring vault...', 'info')
          const result = await window.api.syncRestore(token, gistId)
          if (result.success && result.data) {
            await this.restoreVaultFromBackup(result.data)
            notificationManager.show('Vault restored successfully', 'success')
          } else {
            notificationManager.show(result.message, 'error')
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Restore failed'
          notificationManager.show(`Restore failed: ${errorMessage}`, 'error')
        }
      }
    })
  }

  private async restoreVaultFromBackup(backupData: any): Promise<void> {
    if (!backupData || !backupData.notes || !Array.isArray(backupData.notes)) {
      throw new Error('Invalid backup data format')
    }

    // Refresh notes first to get current state
    await this.refreshNotes()

    const notes = backupData.notes as NotePayload[]
    const createdFolders = new Set<string>()

    // Process each note from backup
    for (const backupNote of notes) {
      try {
        const folderPath = backupNote.path
          ? backupNote.path.split('/').slice(0, -1).join('/')
          : undefined
        const noteTitle = backupNote.title || backupNote.id

        // Check if note already exists by ID
        const existingNote = state.notes.find((n) => n.id === backupNote.id)

        if (existingNote) {
          // Note exists - always update from backup to restore content
          await window.api.saveNote({
            id: backupNote.id,
            title: noteTitle,
            content: backupNote.content || '',
            path: folderPath,
            updatedAt: backupNote.updatedAt || Date.now(),
            createdAt: backupNote.createdAt || existingNote.createdAt || Date.now()
          })
        } else {
          // Note doesn't exist - create it
          // First ensure folder exists if needed
          if (folderPath && !createdFolders.has(folderPath)) {
            const folderParts = folderPath.split('/')
            let currentPath = ''
            for (const folderName of folderParts) {
              const nextPath = currentPath ? `${currentPath}/${folderName}` : folderName
              if (!createdFolders.has(nextPath)) {
                try {
                  // Check if folder already exists in state
                  const folderExists = state.notes.some(
                    (n) => n.type === 'folder' && n.path === nextPath
                  )
                  if (!folderExists) {
                    await window.api.createFolder(folderName, currentPath || undefined)
                  }
                  createdFolders.add(nextPath)
                } catch (error) {
                  // Folder might already exist, continue
                  console.warn(`Folder creation skipped: ${nextPath}`, error)
                  createdFolders.add(nextPath)
                }
              }
              currentPath = nextPath
            }
          }

          // Create the new note
          const created = await window.api.createNote(noteTitle, folderPath)
          // Set the content
          await window.api.saveNote({
            id: created.id,
            title: noteTitle,
            content: backupNote.content || '',
            path: folderPath,
            updatedAt: backupNote.updatedAt || Date.now(),
            createdAt: backupNote.createdAt || Date.now()
          })
        }
      } catch (error) {
        console.error(`Failed to restore note ${backupNote.id}:`, error)
        // Continue with other notes
      }
    }

    // Refresh the UI to show changes - but preserve existing items
    await this.refreshNotes()
    // Force sidebar to re-render with all notes
    this.sidebar.renderTree(this.sidebar.getSearchValue())

    // Refresh editor state to prevent freezing
    if (state.activeId) {
      const activeNote = state.notes.find((n) => n.id === state.activeId)
      if (activeNote) {
        const noteData = await window.api.loadNote(activeNote.id)
        if (noteData) {
          await this.editor.loadNote(noteData)
        }
      }
    }

    // Ensure editor is enabled and responsive
    setTimeout(() => {
      if (this.editor) {
        const editorElement = (this.editor as any).editor
        if (editorElement) {
          editorElement.updateOptions({ readOnly: false })
          editorElement.focus()
        }
      }
    }, 100)
  }

  private async reloadVault(): Promise<void> {
    try {
      this.statusBar.setStatus('Reloading vault...')
      await this.refreshNotes()
      this.sidebar.renderTree(this.sidebar.getSearchValue())
      this.statusBar.setStatus('Vault reloaded')
      notificationManager.show('Vault reloaded successfully', 'success')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reload vault'
      this.statusBar.setStatus(`⚠️ ${errorMessage}`)
      notificationManager.show('Failed to reload vault', 'error')
    }
  }
}

ErrorHandler.init()
window.addEventListener('DOMContentLoaded', () => {
  const app = new App()
  void app.init()
})
