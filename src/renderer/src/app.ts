import { state } from './core/state'
import type { AppSettings } from './core/types'
import { keyboardManager } from './core/keyboardManager'
import { modalManager } from './components/modal/modal'
import { ActivityBar } from './components/activitybar/activitybar'
import { SidebarTree } from './components/sidebar/sidebar-tree'
import { TabBar } from './components/tabbar/tabbar'
import { Breadcrumbs } from './components/breadcrumbs/breadcrumbs'
import { EditorComponent } from './components/editor/editor'
import { StatusBar } from './components/statusbar/statusbar'
import { RightBar } from './components/rightbar/rightbar'
import { SettingsView } from './components/settings/settings-view'
import { contextMenu } from './components/contextmenu/contextmenu'

import { ThemeModal } from './components/theme-modal/theme-modal'
import { DocumentationModal } from './components/documentation/documentation'
import { AISettingsModal } from './components/settings/ai-settings-modal'
import { FuzzyFinder } from './components/fuzzy-finder/fuzzy-finder'
import { ConsoleComponent } from './components/console/console'
import { GraphView } from './components/graph/graph'
import { themeManager } from './core/themeManager'
import { ErrorHandler } from './utils/error-handler'
import { notificationManager } from './components/notification/notification'
import { aiService } from './services/aiService'
import { TabHandlersImpl } from './handlers/tabHandlers'
import { WikiLinkService } from './components/wikilink/wikilinkService'
import { PreviewHandlers } from './handlers/previewHandlers'
import { vaultService } from './services/vaultService'
import { VaultPicker } from './components/vault-picker/vault-picker'
import { WelcomePage } from './components/welcome-page/welcome-page'
import { ragService } from './services/rag/ragService'
import { securityService } from './services/security/securityService'
import { VaultHandler } from './handlers/VaultHandler'
import { FileOperationHandler } from './handlers/FileOperationHandler'
import { ViewOrchestrator } from './handlers/ViewOrchestrator'

class App {
  private activityBar: ActivityBar
  private sidebar: SidebarTree
  private tabBar: TabBar
  private breadcrumbs: Breadcrumbs
  private editor: EditorComponent
  private statusBar: StatusBar
  private settingsView: SettingsView
  private rightBar: RightBar
  private themeModal: ThemeModal
  private documentationModal: DocumentationModal
  private aiSettingsModal: AISettingsModal
  private fuzzyFinder: FuzzyFinder
  private graphView: GraphView
  private tabHandlers!: TabHandlersImpl
  private wikiLinkService!: WikiLinkService
  private previewHandlers!: PreviewHandlers
  private vaultPicker!: VaultPicker
  private hubConsole: ConsoleComponent
  private pendingPersist?: any
  private welcomePage: WelcomePage

  private vaultHandler: VaultHandler
  private fileOps: FileOperationHandler
  private viewOrchestrator: ViewOrchestrator

  constructor() {
    this.activityBar = new ActivityBar('activityBar')
    this.sidebar = new SidebarTree('sidebar')
    this.tabBar = new TabBar('tabBar')
    this.breadcrumbs = new Breadcrumbs('breadcrumbs')
    this.editor = new EditorComponent('editorContainer')
    this.statusBar = new StatusBar('statusBar')
    this.welcomePage = new WelcomePage('welcomeHost')
    this.hubConsole = new ConsoleComponent('consoleHost')
    this.settingsView = new SettingsView('settingsHost')
    this.themeModal = new ThemeModal('app')
    this.documentationModal = new DocumentationModal('app')
    this.aiSettingsModal = new AISettingsModal('app')
    this.rightBar = new RightBar('rightPanel', this.aiSettingsModal)
    this.fuzzyFinder = new FuzzyFinder('app')
    this.graphView = new GraphView()

    this.viewOrchestrator = new ViewOrchestrator({
      editor: this.editor,
      settingsView: this.settingsView,
      welcomePage: this.welcomePage,
      tabBar: this.tabBar,
      statusBar: this.statusBar,
      activityBar: this.activityBar
    })

    this.vaultHandler = new VaultHandler(
      {
        sidebar: this.sidebar,
        tabBar: this.tabBar,
        statusBar: this.statusBar,
        editor: this.editor,
        breadcrumbs: this.breadcrumbs,
        activityBar: this.activityBar,
        welcomePage: this.welcomePage
      },
      {
        updateViewVisibility: () => this.viewOrchestrator.updateViewVisibility(),
        showWelcomePage: () => this.viewOrchestrator.showWelcomePage()
      }
    )

    this.fileOps = new FileOperationHandler(
      {
        sidebar: this.sidebar,
        tabBar: this.tabBar,
        statusBar: this.statusBar,
        editor: this.editor
      },
      {
        refreshNotes: () => this.vaultHandler.refreshNotes(),
        openNote: (id, path, focus) => this.vaultHandler.openNote(id, path, focus),
        saveExpandedFolders: () => this.vaultHandler.saveExpandedFolders(),
        persistWorkspace: () => this.vaultHandler.persistWorkspace(),
        updateViewVisibility: () => this.viewOrchestrator.updateViewVisibility()
      }
    )

    this.tabHandlers = new TabHandlersImpl(
      this.tabBar,
      this.statusBar,
      this.editor,
      () => this.vaultHandler.persistWorkspace(),
      () => this.viewOrchestrator.updateViewVisibility()
    )

    this.wikiLinkService = new WikiLinkService({
      openNote: (id, path) => this.vaultHandler.openNote(id, path),
      createNote: (title, path) => this.fileOps.createNote(title, path),
      getEditorValue: () => this.editor.getValue(),
      setStatus: (message) => this.statusBar.setStatus(message)
    })

    this.previewHandlers = new PreviewHandlers({
      showPreview: (content) => this.editor.showPreview(content),
      updateViewVisibility: () => this.viewOrchestrator.updateViewVisibility(),
      setStatus: (message) => this.statusBar.setStatus(message),
      setMeta: (message) => this.statusBar.setMeta(message),
      updateSidebarSelection: (noteId) => this.sidebar.updateSelection(noteId),
      renderTabBar: () => this.tabBar.render(),
      persistWorkspace: () => this.vaultHandler.persistWorkspace()
    })

    this.vaultPicker = new VaultPicker('app')
    this.vaultPicker.setCallbacks({
      onVaultSelected: (path) => this.vaultHandler.handleVaultSelected(path),
      onVaultLocated: (orig, newP) => this.vaultHandler.handleVaultLocated(orig, newP),
      onChooseNew: () => this.vaultHandler.chooseVault()
    })

    this.welcomePage.setOpenFolderHandler(() => this.vaultHandler.chooseVault())
    this.welcomePage.setCreateNewHandler(() => this.vaultHandler.chooseVault())
    this.welcomePage.setProjectSelectHandler((path) => this.vaultHandler.handleVaultSelected(path))
    this.welcomePage.setOpenDocsHandler(() => this.documentationModal.open())

    this.breadcrumbs.setNoteOpenHandler((id) => this.vaultHandler.openNote(id))

    this.wireComponents()
    this.registerGlobalShortcuts()
    this.wireUpdateEvents()
    this.attachSyncEvents()
    // URL params handling removed (unused)

    window.addEventListener('resize', () => this.editor.layout())
    window.addEventListener('delete-active-note', () => {
      if (state.activeId) {
        const note = state.notes.find((n) => n.id === state.activeId)
        void this.fileOps.deleteItems([{ id: state.activeId, type: 'note', path: note?.path }])
      }
    })
    window.addEventListener('vault-changed', () => {
      void this.vaultHandler.refreshNotes()
      void this.vaultHandler.saveExpandedFolders()
    })
    window.addEventListener('status', ((e: CustomEvent<{ message: string }>) => {
      if (e.detail?.message) this.statusBar.setStatus(e.detail.message)
    }) as EventListener)
    window.addEventListener(
      'toggle-right-sidebar',
      () => void this.viewOrchestrator.toggleRightSidebar()
    )
    window.addEventListener('toggle-hub-console', () => this.hubConsole.toggle())
    window.addEventListener('knowledge-hub:rename-item', ((
      e: CustomEvent<{ id: string; type: 'note' | 'folder'; title: string }>
    ) => {
      const { id, type, title } = e.detail
      void this.promptRenameItem(id, type, title)
    }) as EventListener)
    window.addEventListener('knowledge-hub:open-note', ((
      e: CustomEvent<{ id: string; path: string }>
    ) => {
      const { id, path } = e.detail
      void this.vaultHandler.openNote(id, path)
    }) as EventListener)
    window.addEventListener('toggle-documentation-modal', () => this.documentationModal.toggle())
    window.addEventListener('knowledge-hub:focus-folder', ((e: CustomEvent<{ path: string }>) => {
      const path = e.detail?.path
      if (path) {
        this.vaultHandler.revealPathInSidebar(path, true)
        this.sidebar.scrollToActive(false)
      }
    }) as EventListener)

    this.editor.setCursorPositionChangeHandler(() => this.schedulePersist())
    window.addEventListener('beforeunload', () => void this.vaultHandler.persistWorkspace())
  }

  async init(): Promise<void> {
    await this.initSettings()
    await this.vaultHandler.init()
    this.registerConsoleCommands()
    this.wireUpdateEvents()
    ErrorHandler.init()

    // Clear initial loading overlay
    document.body.classList.remove('is-loading')
  }

  private async initSettings(): Promise<void> {
    state.settings = await window.api.getSettings()
    if (state.settings.expandedFolders)
      state.expandedFolders = new Set(state.settings.expandedFolders)
    if (state.settings.pinnedTabs) state.pinnedTabs = new Set(state.settings.pinnedTabs)
    if (state.settings.cursorPositions)
      state.cursorPositions = new Map(Object.entries(state.settings.cursorPositions))
    if (state.settings.theme) themeManager.setTheme(state.settings.theme)

    if (state.settings.recentVaults) {
      state.recentProjects = state.settings.recentVaults.map((path) => ({
        name: vaultService.getVaultName(path),
        path
      }))
    }

    if (state.settings) {
      this.editor.applySettings(state.settings)
      this.viewOrchestrator.restoreLayout(state.settings)
    }
  }

  private schedulePersist(): void {
    if (this.pendingPersist) window.clearTimeout(this.pendingPersist)
    this.pendingPersist = window.setTimeout(() => void this.vaultHandler.persistWorkspace(), 300)
  }

  private wireComponents(): void {
    this.activityBar.setViewChangeHandler((view) => {
      if (view === 'settings') return void this.viewOrchestrator.openSettings()
      if (view === 'theme') return this.themeModal.open()
      if (view === 'graph') return this.graphView.open()
      if (view === 'documentation') return this.documentationModal.toggle()

      const isSidebarView = view === 'notes' || view === 'search'
      this.sidebar.setVisible(isSidebarView)
      this.sidebar.setMode(view === 'search' ? 'search' : 'explorer')
      this.editor.layout()
    })

    this.sidebar.setNoteSelectHandler(
      (id, path) => void this.vaultHandler.openNote(id, path, 'editor')
    )
    this.sidebar.setNoteCreateHandler((path) => void this.fileOps.createNote(undefined, path))
    this.sidebar.setNoteDeleteHandler(
      (id, path) => void this.fileOps.deleteItems([{ id, type: 'note', path }])
    )
    this.sidebar.setItemsDeleteHandler((items) => void this.fileOps.deleteItems(items))
    this.sidebar.setNoteMoveHandler((id, from, to) => this.fileOps.handleNoteMove(id, from, to))
    this.sidebar.setFolderMoveHandler((src, tgt) => this.fileOps.handleFolderMove(src, tgt))
    this.sidebar.setFolderCreateHandler((path) => void this.fileOps.createFolder(path))
    this.sidebar.setGraphClickHandler(() => this.graphView.open())

    this.fuzzyFinder.setSelectHandler(async (id, path, type, isFinal) => {
      if (type === 'folder') {
        this.vaultHandler.revealPathInSidebar(path, true)
      } else {
        await this.vaultHandler.openNote(id, path, isFinal ? 'editor' : 'none')
      }
    })

    this.tabBar.setTabSelectHandler(async (id) => {
      this.previewHandlers.closePreviewTabs(id)
      if (id === 'settings') return void this.viewOrchestrator.openSettings()

      const tab = state.openTabs.find((t) => t.id === id)
      if (tab) await this.vaultHandler.openNote(tab.id, tab.path)
    })

    this.tabBar.setTabCloseHandler((id) => void this.closeTab(id))
    this.tabBar.setTabContextMenuHandler((id, e) => {
      this.tabHandlers.handleTabContextMenu(
        id,
        e,
        (id, f) => this.closeTab(id, f),
        (id) => this.tabHandlers.closeOtherTabs(id, (id, f) => this.closeTab(id, f)),
        () => this.tabHandlers.closeAllTabs((id, f) => this.closeTab(id, f))
      )
    })

    this.settingsView.setVaultCallbacks({
      onVaultChange: () => this.vaultHandler.chooseVault(),
      onVaultReveal: () => window.api.revealVault(),
      onVaultSelected: (p) => this.vaultHandler.handleVaultSelected(p),
      onVaultLocated: (o, n) => this.vaultHandler.handleVaultLocated(o, n)
    })

    this.settingsView.setSettingChangeHandler(async (newSettings) => {
      if (state.settings) {
        state.settings = { ...state.settings, ...newSettings }
        this.editor.applySettings(state.settings)
        void window.api.updateSettings(newSettings as Partial<AppSettings>)
        this.statusBar.setStatus('Settings auto-saved')
        if (newSettings.deepseekApiKey !== undefined) {
          await aiService.loadApiKey()
          await this.rightBar.refreshApiKey()
        }
      }
    })

    this.editor.setContentChangeHandler(() => {
      this.statusBar.setStatus('Unsaved changes')
      this.tabBar.render()
      this.sidebar.updateDirtyState()
    })
    this.editor.setSaveHandler((payload) => void this.fileOps.saveNote(payload))
    this.editor.setDropHandler((p, f) => this.handleDrop(p, f))
    this.editor.setLinkClickHandler((t) => void this.wikiLinkService.openWikiLink(t))
    this.editor.setHoverContentHandler((t) => this.wikiLinkService.getNotePreview(t))
    this.editor.setContextMenuHandler((e) => this.handleEditorContextMenu(e))
    this.editor.setTabCloseHandler(() => {
      if (state.activeId && !state.pinnedTabs.has(state.activeId)) {
        void this.closeTab(state.activeId)
      }
    })
    this.editor.attachKeyboardShortcuts()

    this.themeModal.setThemeChangeHandler((themeId) => {
      themeManager.setTheme(themeId)
      this.editor.applySettings({ ...state.settings!, theme: themeId })
    })

    this.rightBar.setEditorContext(
      () => this.editor.getValue(),
      () => {
        if (state.activeId && state.activeId !== 'settings') {
          const note = state.notes.find((n) => n.id === state.activeId)
          return note ? { title: note.title, id: note.id } : null
        }
        return null
      }
    )
  }

  private async closeTab(id: string, force = false): Promise<void> {
    await this.tabHandlers.closeTab(
      id,
      force,
      async (id, path) => {
        await window.api.deleteNote(id, path)
      },
      () => this.vaultHandler.refreshNotes(),
      (id, path) => this.vaultHandler.openNote(id, path),
      () => this.viewOrchestrator.showWelcomePage()
    )
  }

  private async promptRenameItem(
    id: string,
    type: 'note' | 'folder',
    currentTitle: string
  ): Promise<void> {
    modalManager.open({
      title: `Rename ${type === 'note' ? 'Note' : 'Folder'}`,
      inputs: [
        {
          name: 'title',
          label: 'New Title',
          value: currentTitle,
          required: true,
          placeholder: `Enter ${type} name...`
        }
      ],
      buttons: [
        {
          label: 'Rename',
          onClick: async (m) => {
            const { title: newTitle } = m.getValues()
            if (newTitle && newTitle !== currentTitle) {
              try {
                if (type === 'note') await this.fileOps.renameNote(id, newTitle)
                else await this.fileOps.renameFolder(id, newTitle)
                m.close()
              } catch (err: any) {
                notificationManager.show(err.message || 'Rename failed', 'error')
              }
            } else {
              m.close()
            }
          }
        },
        { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() }
      ]
    })
  }

  private async promptRenameActiveNote(): Promise<void> {
    const note = state.notes.find((n) => n.id === state.activeId)
    if (note) await this.promptRenameItem(note.id, 'note', note.title)
  }

  private async handleDrop(filePath: string, isInternal: boolean): Promise<void> {
    if (isInternal && filePath.toLowerCase().endsWith('.md')) {
      const name = filePath.split(/[/\\]/).pop() || ''
      const id = name.replace(/\.[^.]+$/, '')
      let note = state.notes.find((n) => n.id === id)
      if (!note) {
        await this.vaultHandler.refreshNotes()
        note = state.notes.find((n) => n.id === id)
      }
      if (note) return void this.vaultHandler.openNote(note.id, note.path)
    }

    try {
      this.statusBar.setStatus('Importing file...')
      const imported = await window.api.importNote(filePath)
      this.statusBar.setStatus(`✓ Imported "${imported.title}"`)
      await this.vaultHandler.refreshNotes()
      await this.vaultHandler.openNote(imported.id, imported.path)
      const notePayload = await window.api.loadNote(imported.id, imported.path)
      if (notePayload?.content) {
        await ragService.indexNote(imported.id, notePayload.content, {
          title: imported.title,
          path: imported.path
        })
      }
    } catch {
      this.statusBar.setStatus('⚠️ Import failed')
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
        label: 'Insert Date',
        onClick: () => this.editor.insertAtCursor(new Date().toLocaleString())
      },
      { separator: true },
      {
        label: 'Delete Line',
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
        onClick: () => void this.previewHandlers.openPreviewTab()
      },
      {
        label: 'Details',
        keybinding: 'Ctrl+I',
        onClick: () => this.viewOrchestrator.showDetailsModal()
      },
      { separator: true },
      { label: 'Knowledge Graph', keybinding: 'Alt+G', onClick: () => this.graphView.open() }
    ])
  }

  private wireUpdateEvents(): void {
    const list = ['available', 'not-available', 'progress', 'downloaded', 'error']
    list.forEach((ev) => {
      window.electron?.ipcRenderer?.on?.(`update:${ev}`, (_e, data) => {
        if (ev === 'available') this.statusBar.setStatus('Update available...')
        if (ev === 'progress')
          this.statusBar.setStatus(`Downloading... ${data?.percent?.toFixed(1)}%`)
        if (ev === 'downloaded') this.statusBar.setStatus('Update ready.')
        if (ev === 'error') this.statusBar.setStatus(`Update error: ${data}`)
      })
    })
  }

  private attachSyncEvents(): void {
    window.addEventListener('restore-vault', async (e: any) => {
      if (e.detail?.backupData) await this.vaultHandler.restoreVaultFromBackup(e.detail.backupData)
    })

    const statusBarEl = document.getElementById('statusBar')
    statusBarEl?.addEventListener('sync-action', async (e: any) => {
      const { action } = e.detail
      const settings = (await window.api.getSettings()) as any
      const { gistToken: token, gistId } = settings
      if (!token) return notificationManager.show('GitHub token missing', 'warning')

      if (action === 'backup') {
        notificationManager.show('Backing up...', 'info')
        const vaultData = await window.api.listNotes()
        const notes = (
          await Promise.all(
            vaultData.filter((n) => n.type !== 'folder').map((n) => window.api.loadNote(n.id))
          )
        ).filter((n) => n !== null)
        const res = await window.api.syncBackup(token, gistId, notes)
        if (res.success) {
          notificationManager.show(res.message, 'success')
          if (res.gistId) await window.api.updateSettings({ gistId: res.gistId } as any)
        } else notificationManager.show(res.message, 'error')
      } else if (action === 'restore') {
        if (!gistId) return notificationManager.show('No Gist ID', 'warning')
        if (!confirm('Restore will replace your current vault. Continue?')) return
        notificationManager.show('Restoring...', 'info')
        const res = await window.api.syncRestore(token, gistId)
        if (res.success && res.data) {
          await this.vaultHandler.restoreVaultFromBackup(res.data)
          notificationManager.show('Restored', 'success')
        } else notificationManager.show(res.message, 'error')
      }
    })
  }

  private registerGlobalShortcuts(): void {
    const reg = (
      key: string,
      desc: string,
      handler: () => boolean | void | Promise<void>
    ): void => {
      keyboardManager.register({ key, scope: 'global', description: desc, handler })
    }

    reg('Alt+g', 'Open Knowledge Graph', () => this.graphView.open())
    reg('Control+f', 'Find in note', () => {
      this.editor.focus()
      this.editor.triggerAction('actions.find')
      return true
    })
    reg('Control+p', 'Quick Open', () => this.fuzzyFinder.toggle('notes'))
    reg('Control+Shift+f', 'Global search', () => this.activityBar.setActiveView('search'))
    reg('Control+Shift+p', 'Command Palette', () => this.fuzzyFinder.toggle('commands'))
    reg('Control+i', 'Toggle Right Sidebar', () => void this.viewOrchestrator.toggleRightSidebar())
    reg('Control+Alt+s', 'Open AI Configuration', () => this.aiSettingsModal.open())
    reg('Control+Shift+r', 'Reload vault', () => void this.reloadVault())
    reg('Control+Shift+v', 'Choose vault', () => void this.vaultHandler.chooseVault())
    reg('Control+n', 'New note', () => void this.fileOps.createNote())
    reg('Control+s', 'Save note', () => {
      if (state.activeId && state.activeId !== 'settings') {
        this.editor.manualSave()
        const note = state.notes.find((n) => n.id === state.activeId)
        if (note && /^Untitled( \d+)?$/i.test(note.title)) void this.promptRenameActiveNote()
      }
    })
    reg('Control+r', 'Rename active item', async () => {
      const sidebarEl = document.querySelector('.sidebar__body') as HTMLElement
      const isSidebarFocused = sidebarEl?.contains(document.activeElement)

      if (isSidebarFocused && state.selectedIds.size === 1) {
        const id = Array.from(state.selectedIds)[0]
        const item = document.querySelector(`.tree-item[data-id="${id}"]`) as HTMLElement
        const type = item?.dataset.type as 'note' | 'folder'
        const label = item?.querySelector('.tree-item__label') as HTMLElement
        if (id && type && label) {
          await this.promptRenameItem(id, type, label.textContent?.trim() || '')
        }
      } else {
        await this.promptRenameActiveNote()
      }
    })
    reg('Control+b', 'Toggle sidebar', () => this.sidebar.toggle())
    reg('Control+d', 'Delete item', () => {
      if (state.selectedIds.size > 0) {
        const items = Array.from(state.selectedIds).map((id) => {
          const n = state.notes.find((x) => x.id === id)
          return { id, type: n ? ('note' as const) : ('folder' as const), path: n?.path }
        })
        void this.fileOps.deleteItems(items)
      } else if (state.activeId && state.activeId !== 'settings') {
        const n = state.notes.find((x) => x.id === state.activeId)
        void this.fileOps.deleteItems([{ id: state.activeId, type: 'note', path: n?.path }])
      }
    })
    reg('Control+,', 'Open settings', () => void this.viewOrchestrator.openSettings())
    reg('Control+Shift+<', 'Select theme', () => this.themeModal.toggle())
    reg('Control+Shift+\\', 'Docs', () => {
      this.documentationModal.toggle()
      return true
    })
    reg('Control+j', 'Toggle Console', () => this.hubConsole.toggle())
    reg('Control+l', 'Lock Application', () => void securityService.promptAndLock())
    reg('Escape', 'Close UI', () => {
      if ((this.hubConsole as any).isOpen) {
        this.hubConsole.setVisible(false)
        return true
      }
      if ((this.fuzzyFinder as any).isOpen) {
        this.fuzzyFinder.close()
        return true
      }
      if (state.activeId?.startsWith('preview-')) {
        void this.closeTab(state.activeId)
        return true
      }
      if (modalManager.getCurrent()) {
        modalManager.close()
        return true
      }
      return false
    })
  }

  private registerConsoleCommands(): void {
    this.hubConsole.registerCommand({
      name: 'help',
      description: 'List commands',
      action: () => {
        this.hubConsole.log(
          'help, open, find, stats, clear, close, index-vault, debug-rag, lock, unlock'
        )
      }
    })
    this.hubConsole.registerCommand({
      name: 'stats',
      description: 'Show vault statistics',
      action: () => {
        this.hubConsole.log(
          `Notes: ${state.notes.length}, Tabs: ${state.openTabs.length}, Path: ${state.vaultPath}`
        )
      }
    })
    this.hubConsole.registerCommand({
      name: 'clear',
      description: 'Clear console output',
      action: () => {
        const b = document.querySelector('.hub-console__body')
        if (b) b.innerHTML = ''
      }
    })
    this.hubConsole.registerCommand({
      name: 'close',
      description: 'Close console',
      action: () => this.hubConsole.setVisible(false)
    })
    this.hubConsole.registerCommand({
      name: 'index-vault',
      description: 'Re-index vault for AI',
      action: () => this.vaultHandler.backgroundIndexVault()
    })
  }

  private async reloadVault(): Promise<void> {
    try {
      this.statusBar.setStatus('Reloading vault...')
      await this.vaultHandler.refreshNotes()
      this.statusBar.setStatus('Vault reloaded')
    } catch {
      notificationManager.show('Reload failed', 'error')
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App()
  void app.init()
})
