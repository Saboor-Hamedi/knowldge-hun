// Rightbar toggle logic
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') {
    const shell = document.querySelector('.vscode-shell') as HTMLElement;
    const rightPanel = document.getElementById('rightPanel') as HTMLElement;
    if (rightPanel && shell) {
      const isVisible = rightPanel.style.display !== 'none';
      rightPanel.style.display = isVisible ? 'none' : 'block';
      shell.style.setProperty('--right-panel-width', isVisible ? '0px' : '270px');
    }
    e.preventDefault();
  }
});
import { state } from './core/state'
import type { NotePayload, NoteMeta, TreeItem, AppSettings } from './core/types'
import { sortNotes, syncTabsWithNotes, ensureTab, sortTabs } from './utils/helpers'
import { sortTreeRecursive } from './utils/tree-utils'
import { keyboardManager } from './core/keyboardManager'
import { modalManager } from './components/modal/modal'
import { ActivityBar } from './components/activitybar/activitybar'
import { SidebarTree } from './components/sidebar/sidebar-tree'
import { TabBar } from './components/tabbar/tabbar'
import { EditorComponent } from './components/editor/editor'
import { StatusBar } from './components/statusbar/statusbar'
import { RightBar } from './components/rightbar/rightbar'
import { SettingsView } from './components/settings/settings-view'
import { contextMenu } from './components/contextmenu/contextmenu'
import { codicons } from './utils/codicons'
import { ThemeModal } from './components/theme-modal/theme-modal'
import { FuzzyFinder } from './components/fuzzy-finder/fuzzy-finder'
import { GraphView } from './components/graph/graph'
import { themeManager } from './core/themeManager'
import { ErrorHandler } from './utils/error-handler'
import { notificationManager } from './components/notification/notification'

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
    const treeItem: TreeItem = type === 'folder' ? folderMap.get(item.id)! : { ...item, type, children: [] }

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
  private rightBar: RightBar
  private activityBar: ActivityBar
  private sidebar: SidebarTree
  private tabBar: TabBar
  private editor: EditorComponent
  private statusBar: StatusBar
  private settingsView: SettingsView
  private themeModal: ThemeModal
  private fuzzyFinder: FuzzyFinder
  private graphView: GraphView

  constructor() {
    this.activityBar = new ActivityBar('activityBar')
    this.sidebar = new SidebarTree('sidebar')
    this.tabBar = new TabBar('tabBar')
    this.editor = new EditorComponent('editorContainer')
    this.statusBar = new StatusBar('statusBar')
    this.settingsView = new SettingsView('settingsHost')
    this.rightBar = new RightBar('rightPanel')
    this.themeModal = new ThemeModal('app') // Mount to app container
    this.fuzzyFinder = new FuzzyFinder('app')
    this.graphView = new GraphView() // Mount to app container
    this.wireComponents()
    this.registerGlobalShortcuts()
    this.registerVaultChangeListener()
    this.setupMobileEvents()
    
    // Ensure editor resizes correctly when window size changes
    window.addEventListener('resize', () => {
      this.editor.layout()
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

    // Tab handlers
    this.tabBar.setTabSelectHandler(async (id) => {
      if (id === 'settings') {
        await this.openSettings()
      } else {
        const tab = state.openTabs.find((t) => t.id === id)
        if (tab) await this.openNote(tab.id, tab.path)
      }
    })
    this.tabBar.setTabCloseHandler((id) => void this.closeTab(id))
    this.tabBar.setTabContextMenuHandler((id, e) => this.handleTabContextMenu(id, e))

    this.settingsView.setSettingChangeHandler((newSettings) => {
      if (state.settings) {
        state.settings = { ...state.settings, ...newSettings }
        this.editor.applySettings(state.settings)
        void window.api.updateSettings(newSettings as Partial<AppSettings>)
        this.statusBar.setStatus('Settings auto-saved')
      }
    })

    // Editor handlers
    this.editor.setContentChangeHandler(() => {
      this.statusBar.setStatus('Unsaved changes')
      this.tabBar.render()
    })

    this.editor.setSaveHandler((payload) => void this.saveNote(payload))
    this.editor.setDropHandler((path, isFile) => this.handleDrop(path, isFile))
    this.editor.setLinkClickHandler((target) => void this.openWikiLink(target))
    this.editor.setHoverContentHandler((target) => this.getNotePreview(target))
    this.editor.setContextMenuHandler((e) => this.handleEditorContextMenu(e))
    this.editor.setTabCloseHandler(() => {
      if (state.activeId) {
        // Check if pinned before closing via shortcut
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
  }
 
  // ... registerGlobalShortcuts, registerVaultChangeListener ...

  // handleTabContextMenu
  private handleTabContextMenu(id: string, e: MouseEvent): void {
      const isPinned = state.pinnedTabs.has(id)
      contextMenu.show(e.clientX, e.clientY, [
        {
          label: isPinned ? 'Unpin Tab' : 'Pin Tab',
          icon: codicons.pin,
          onClick: () => this.togglePinTab(id)
        },
        { separator: true },
        {
          label: 'Close',
          icon: codicons.close,
          onClick: () => this.closeTab(id, true) // Force close via menu? Or respect lock? Standard VSCode allows menu close.
          // Letting menu close override pin seems standard. Shortcut is protected.
        },
        {
          label: 'Close Others',
          onClick: () => this.closeOtherTabs(id)
        },
        {
          label: 'Close All',
          onClick: () => this.closeAllTabs()
        }
      ])
  }

  private togglePinTab(id: string): void {
      if (state.pinnedTabs.has(id)) {
        state.pinnedTabs.delete(id)
      } else {
        state.pinnedTabs.add(id)
      }
      state.openTabs = sortTabs(state.openTabs, state.pinnedTabs)
      this.tabBar.render()
      void this.persistWorkspace()
  }

  private async closeOtherTabs(id: string): Promise<void> {
    // Close all tabs except the target one and PINNED tabs
    // Usually "Close Others" preserves pinned tabs in VSCode
    const toClose = state.openTabs.filter((t) => t.id !== id && !state.pinnedTabs.has(t.id));
    for (const tab of toClose) {
      await this.closeTab(tab.id, true);
    }
  }

  private async closeAllTabs(): Promise<void> {
    // Close all non-pinned tabs
    const toClose = state.openTabs.filter((t) => !state.pinnedTabs.has(t.id));
    for (const tab of toClose) {
      await this.closeTab(tab.id, true);
    }
  }

  // ... 

  // Updated persistWorkspace
  private async persistWorkspace(): Promise<void> {
      try {
          await window.api.updateSettings({
              openTabs: state.openTabs.map(t => ({ id: t.id, path: t.path })),
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

      if (typeof state.settings.sidebarVisible !== 'undefined') {
        this.sidebar.setVisible(state.settings.sidebarVisible)
      }

      this.editor.applySettings(state.settings)
    } catch (error) {
      console.error('Failed to load settings', error)
    }
  }

  // ...

  // Updated closeTab
  private async closeTab(id: string, force = false): Promise<void> {
    // If pinned and not forced, do not close
    if (!force && state.pinnedTabs.has(id)) {
        this.statusBar.setStatus('Pinned tab cannot be closed')
        return
    }

    // Attempting to close tab...
    const wasActive = state.activeId === id;
    const tabIndex = state.openTabs.findIndex(t => t.id === id);
    
    // Check for changes logic is implicitly handled via "isDirty" but we usually prompt save.
    // Assuming simple close for now or existing logic handles dirty check before this is called?
    // User request focused on menus/pins. Dirty check logic is complex for "Close Others".
    // For now we assume closing unpins it implicitly? VSCode does NOT unpin if you close it, it stays pinned next time?
    // Actually if you close a pinned tab, it's gone from open tabs. Pinning just keeps it "open" and strictly ordered.
    // If I close it, it should probably be unpinned from state to avoid ghost pins?
    // VSCode: If you close a pinned tab (via menu), it is removed.
    if (state.pinnedTabs.has(id)) {
        state.pinnedTabs.delete(id)
    }
    
    const tab = state.openTabs.find(t => t.id === id);
    if (tab && (state.newlyCreatedIds.has(id) || state.newlyCreatedIds.has(tab.id))) {
        console.log(`[App] Cleaning up unused new note: ${id}`)
        try {
            await window.api.deleteNote(id, tab.path)
            state.newlyCreatedIds.delete(id)
            await this.refreshNotes()
        } catch (e) {
            console.error('[App] Failed to cleanup new note', e)
        }
    }

    state.openTabs = state.openTabs.filter((tab) => tab.id !== id)

    if (wasActive) {
      if (state.openTabs.length > 0) {
        const nextIndex = Math.min(tabIndex, state.openTabs.length - 1);
        const fallback = state.openTabs[nextIndex >= 0 ? nextIndex : 0];
        await this.openNote(fallback.id, fallback.path)
      } else {
        state.activeId = ''
        this.editor.showEmpty()
        this.statusBar.setStatus('No open editors')
        this.statusBar.setMeta('')
      }
    }

    this.tabBar.render()
    this.updateViewVisibility() // Added
    void this.persistWorkspace()
  }
  private registerVaultChangeListener(): void {
    window.addEventListener('vault-changed', () => {
      void this.refreshNotes()
      void this.saveExpandedFolders()
    })

    window.addEventListener(
      'status',
      ((event: CustomEvent) => {
        const message = (event.detail && (event.detail.message as string)) || ''
        if (message) this.statusBar.setStatus(message)
      }) as EventListener
    )

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
      state.openTabs = state.openTabs.map(tab => {
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
                    this.editor.insertAtCursor('') // This effectively deletes the selection
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
                label: 'Knowledge Graph',
                keybinding: 'Alt+G',
                onClick: () => this.graphView.open()
          }
      ])
  }

  private async getNotePreview(target: string): Promise<string | null> {
      const cleanTarget = target.trim().toLowerCase()
      const note = this.resolveNote(cleanTarget)
      
      console.log(`[App] getNotePreview for "${target}":`, note ? `Found (${note.id})` : 'NOT FOUND')
      
      if (note) {
          // Optimization: If the target note is the one currently open in the editor,
          // return the live content instead of reading stale data from disk.
          if (note.id === state.activeId && this.editor) {
              const content = this.editor.getValue()
              // Sanitize content for preview
              const clean = content
                  .replace(/^---\n[\s\S]*?\n---\n/, '') // Frontmatter
                  .replace(/<!--[\s\S]*?-->/g, '') // Comments
                  .replace(/#+\s/g, '') // Headers
                  .replace(/\[\[([^\]|]+)\|?.*?\]\]/g, '$1') // WikiLinks
                  .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Markdown Links
                  .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
                  .replace(/(\*|_)(.*?)\1/g, '$2') // Italic
                  .replace(/`{3}[\s\S]*?`{3}/g, '[Code]') // Code blocks
                  .replace(/`/g, '') // Inline code
              
              const snippet = clean.substring(0, 1000).trim()
              return snippet + (content.length > 1000 ? '...' : '') || '(Empty unsaved note)'
          }

          try {
              const loaded = await window.api.loadNote(note.id, note.path)
              if (loaded && loaded.content && loaded.content.trim()) {
                  const clean = loaded.content
                  .replace(/^---\n[\s\S]*?\n---\n/, '')
                  .replace(/<!--[\s\S]*?-->/g, '')
                  .replace(/#+\s/g, '')
                  .replace(/\[\[([^\]|]+)\|?.*?\]\]/g, '$1')
                  .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
                  .replace(/(\*\*|__)(.*?)\1/g, '$2')
                  .replace(/(\*|_)(.*?)\1/g, '$2')
                  .replace(/`{3}[\s\S]*?`{3}/g, '[Code]')
                  .replace(/`/g, '')

                  const snippet = clean.substring(0, 1000).trim()
                  return snippet + (loaded.content.length > 1000 ? '...' : '')
              }
              return '(Note is empty)'
          } catch (err) {
              console.error(`[App] loadNote failed for preview:`, err)
              return '(Failed to load note)'
          }
      }
      return null
  }

  private resolveNote(target: string): NoteMeta | undefined {
      const cleanTarget = target.toLowerCase()
      
      // 1. Exact match (ID, Path, Title)
      let note = state.notes.find(n => 
          n.id.toLowerCase() === cleanTarget || 
          (n.path && `${n.path}/${n.id}`.toLowerCase() === cleanTarget) ||
          (n.title && n.title.toLowerCase() === cleanTarget)
      )
      
      // 2. Strip extension if present (e.g. "note.md" -> "note")
      if (!note && cleanTarget.endsWith('.md')) {
          const base = cleanTarget.slice(0, -3)
          note = state.notes.find(n => 
              n.id.toLowerCase() === base || 
              (n.title && n.title.toLowerCase() === base)
          )
      }
      
      return note
  }

  private async openWikiLink(target: string): Promise<void> {
    const cleanTarget = target.trim()
    const [linkTarget] = cleanTarget.split('|')
    const note = this.resolveNote(linkTarget.trim())

    if (note) {
        await this.openNote(note.id, note.path)
        this.statusBar.setStatus(`Jumped to [[${target}]]`)
    } else {
        // Auto-create note on click if it doesn't exist (Wiki behavior)
        console.log(`[App] Note "${linkTarget}" not found, creating...`)
        try {
             await this.createNote(linkTarget.trim())
             this.statusBar.setStatus(`Created new note: [[${linkTarget}]]`)
        } catch (e) {
             console.error('Failed to create note from link', e)
             this.statusBar.setStatus(`Failed to create note: ${linkTarget}`)
        }
    }
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
           this.fuzzyFinder.toggle()
       }
    })

    keyboardManager.register({
      key: 'Control+Shift+r',
      scope: 'global',
      description: 'Rename project',
      handler: () => {
        const brandEl = document.querySelector('.sidebar__brand') as HTMLElement
        if (brandEl) brandEl.click()
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
        const note = state.notes.find(n => n.id === state.activeId)
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
        void this.promptDeleteActiveNote()
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
    console.log('[App] Init started')
    this.statusBar.setStatus('Initializing...')
    await this.initSettings()
    await this.initVault()

    if (state.settings?.openTabs && state.settings.openTabs.length > 0) {
        state.openTabs = [...state.settings.openTabs] as any
    }

    await this.refreshNotes()
    console.log(`[App] Notes refreshed: ${state.notes.length} notes found.`)

    if (state.openTabs.length > 0) {
      this.statusBar.setStatus('Restoring workspace...')
      const toOpen = state.settings?.activeId || state.openTabs[0].id
      console.log(`[App] Restoring tab: ${toOpen}`)
      const noteToOpen = state.notes.find(n => n.id === toOpen) || 
                         state.notes.find(n => n.id === state.openTabs[0].id)
      
      if (noteToOpen) {
          await this.openNote(noteToOpen.id, noteToOpen.path)
      } else if (toOpen === 'settings') { // Handle settings tab restore
          await this.openSettings()
      }
      else {
          console.warn(`[App] Failed to find note to restore: ${toOpen}. Showing first.`)
          if (state.notes.length > 0) await this.openNote(state.notes[0].id)
          else this.editor.showEmpty()
      }
    } else if (state.notes.length > 0) {
      console.log(`[App] No tabs. Opening first note: ${state.notes[0].id}`)
      await this.openNote(state.notes[0].id)
    } else {
      console.log('[App] No notes or tabs. Showing empty.')
      this.editor.showEmpty()
      this.statusBar.setStatus('No notes yet')
      this.statusBar.setMeta('Create a note to begin')
    }
    
    this.tabBar.render()
    this.updateViewVisibility() // Added
    console.log('[App] Init complete')
    document.body.classList.remove('is-loading')

    // Global context menu suppression to prevent browser default appearing over custom menus
    window.addEventListener('contextmenu', (e) => {
        const target = e.target as HTMLElement
        if (target.closest('.vscode-shell')) {
            // If we don't handle it specifically, we still want to block the browser's ugly menu
            // Our components (sidebar, editor, tabs) handle their own and call e.preventDefault()
            // This is a safety net.
        }
    }, true)
  }

  private async initVault(): Promise<void> {
    try {
      const info = await window.api.getVault()
      state.vaultPath = info.path
      state.projectName = info.name || 'Vault'
      this.statusBar.setMeta(`📁 ${info.path}`)
    } catch (error) {
      console.error('Failed to load vault info', error)
      this.statusBar.setStatus('⚠️ Vault unavailable')
      this.statusBar.setMeta('Press Ctrl+Shift+V to select a vault')
    }
  }

  private async chooseVault(): Promise<void> {
    try {
      this.statusBar.setStatus('Selecting vault folder...')
      const info = await window.api.chooseVault()
      
      if (!info.changed) {
        this.statusBar.setStatus('Ready')
        return
      }
      
      state.vaultPath = info.path
      state.projectName = info.name || 'Vault'
      
      this.statusBar.setStatus('Loading vault...')
      await this.refreshNotes()

      if (state.notes.length > 0) {
        await this.openNote(state.notes[0].id)
        this.statusBar.setStatus(`Loaded ${state.notes.length} note${state.notes.length === 1 ? '' : 's'}`)
      } else {
        state.activeId = ''
        this.editor.showEmpty()
        this.statusBar.setStatus('Empty vault')
        this.statusBar.setMeta('Create a note to begin')
      }
      this.updateViewVisibility() // Added

      this.statusBar.setMeta(`📁 ${info.path}`)
    } catch (error) {
      const message = (error as Error).message || 'Unknown error'
      console.error('Vault selection failed', error)
      this.statusBar.setStatus(`⚠️ ${message}`)
      this.statusBar.setMeta('Press Ctrl+Shift+V to try again')
    }
  }

  private async openSettings(): Promise<void> {
    state.activeId = 'settings'
    
    // Ensure "Settings" tab exists
    state.openTabs = ensureTab(state.openTabs, {
        id: 'settings',
        title: 'Settings',
        updatedAt: 0
    })
    state.openTabs = sortTabs(state.openTabs, state.pinnedTabs)
    
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
    state.notes = rawNotes.filter(n => n.type !== 'folder')
    
    sortNotes(state.notes)
    
    // Ensure active note metadata is fresh
    if (state.activeId && state.activeId !== 'settings') {
        const found = state.notes.find(n => n.id === state.activeId)
        if (!found) {
             // Note might have been deleted or moved outside?
        }
    }
    
    // Sync tabs
    state.openTabs = syncTabsWithNotes(state.openTabs, state.notes)
    state.openTabs = sortTabs(state.openTabs, state.pinnedTabs)

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

  private async openNote(id: string, path?: string, focusTarget: 'editor' | 'sidebar' | 'none' = 'editor'): Promise<void> {
    // We no longer automatically hide the sidebar on mobile here.
    // The user can explicitly close it or we can close it when they focus the editor.
    
    const note = await window.api.loadNote(id, path)
    if (!note) {
      // Try to refresh notes and check again before warning
      await this.refreshNotes();
      // Check for both id and path match
      const refreshed = state.notes.find(n => n.id === id || n.path === path);
      if (refreshed) {
        // Note is now found after refresh, open it
        await this.openNote(refreshed.id, refreshed.path, focusTarget);
        return;
      }
      // Only show notification if truly missing
      console.warn(`[App] Note ${id} not found at ${path}. Refreshing...`)
      notificationManager.show(`Note not found after rename or move. Please check your vault.`, 'warning', { title: 'Note Missing' })
      this.statusBar.setStatus('Note missing on disk')
      if (state.activeId === id || !state.activeId) {
          this.editor.showEmpty()
      }
      return
    }

    state.activeId = id
    state.lastSavedAt = note.updatedAt
    
    if (focusTarget !== 'none') {
        state.openTabs = ensureTab(state.openTabs, {
          id: note.id,
          title: note.title,
          updatedAt: note.updatedAt,
          path: note.path
        })
        state.openTabs = sortTabs(state.openTabs, state.pinnedTabs)
    }

    await this.editor.loadNote(note)
    this.updateViewVisibility()
    this.statusBar.setStatus('Ready')
    this.statusBar.setMeta(`📁 ${state.vaultPath || ''}`)
    
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
    state.openTabs = ensureTab(state.openTabs, meta)
    state.openTabs = state.openTabs.map((tab) => (tab.id === meta.id ? meta : tab))
    state.openTabs = sortTabs(state.openTabs, state.pinnedTabs)

    this.sidebar.renderTree(this.sidebar.getSearchValue())
    this.tabBar.render()
    this.statusBar.setStatus('Autosaved')
    this.statusBar.setMeta(`📁 ${state.vaultPath || ''}`)
  }
  private async deleteItems(items: { id: string, type: 'note' | 'folder', path?: string }[]): Promise<void> {
    if (items.length === 0) return

    const count = items.length
    const label = count === 1 ? (items[0].type === 'note' ? 'note' : 'folder') : 'items'
    
    // Check if any of the items is protected (e.g. settings.json if it exists)
    // The user had a previous goal to protect settings.json, but it's not clear here.
    // I'll just follow standard procedure.

    const header = this.createModalHeader(`Delete ${count > 1 ? count + ' ' : ''}${label}`)
    const content = document.createElement('div')
    content.innerHTML = `<p style="margin: 0; color: var(--text);">Are you sure you want to delete ${count === 1 ? 'this ' + label : 'these ' + count + ' items'}? This action cannot be undone.</p>`

    modalManager.open({
      customHeader: header,
      customContent: content,
      size: 'sm',
      buttons: [
        { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() },
        {
          label: 'Delete',
          variant: 'danger',
          onClick: async (m) => {
            m.close()
            this.statusBar.setStatus(`Deleting ${count} items...`)
            
            try {
                for (const item of items) {
                    if (item.type === 'note') {
                        await window.api.deleteNote(item.id, item.path)
                        state.openTabs = state.openTabs.filter((t) => t.id !== item.id)
                        state.pinnedTabs.delete(item.id)
                    } else {
                        await window.api.deleteFolder(item.id)
                    }
                }
                
                this.statusBar.setStatus(`${count} items deleted`)
                window.dispatchEvent(new CustomEvent('vault-changed'))
                
                // If the active note was deleted, switch
                const ancoraActive = state.openTabs.find(t => t.id === state.activeId)
                if (!ancoraActive) {
                    if (state.openTabs.length > 0) {
                        await this.openNote(state.openTabs[0].id, state.openTabs[0].path)
                    } else {
                        state.activeId = ''
                        this.editor.showEmpty()
                    }
                }
            } catch (error) {
                console.error('Bulk delete failed', error)
                this.statusBar.setStatus('Some items could not be deleted')
                await this.refreshNotes()
            }
          }
        }
      ]
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
        state.openTabs = state.openTabs.map(tab => {
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
        const result = await window.api.moveFolder(sourcePath, targetPath)
        const newFolderPath = result.path
        
        const oldPrefix = sourcePath + '/'
        const newPrefix = newFolderPath + '/'
        
        let updatedTabs = false
        state.openTabs = state.openTabs.map(tab => {
            if (tab.id.startsWith(oldPrefix)) {
                updatedTabs = true
                const newId = tab.id.replace(oldPrefix, newPrefix)
                const lastSlash = newId.lastIndexOf('/')
                const newNotePath = lastSlash === -1 ? '' : newId.substring(0, lastSlash)
                return { ...tab, id: newId, path: newNotePath }
            }
            return tab
        })
        
        if (state.activeId.startsWith(oldPrefix)) {
            state.activeId = state.activeId.replace(oldPrefix, newPrefix)
        }

        for (const id of Array.from(state.pinnedTabs)) {
            if (id.startsWith(oldPrefix)) {
                state.pinnedTabs.delete(id)
                state.pinnedTabs.add(id.replace(oldPrefix, newPrefix))
            }
        }
        
        for (const path of Array.from(state.expandedFolders)) {
            if (path === sourcePath || path.startsWith(oldPrefix)) {
                state.expandedFolders.delete(path)
                state.expandedFolders.add(path === sourcePath ? newFolderPath : path.replace(oldPrefix, newPrefix))
            }
        }
        
        if (updatedTabs) {
            this.tabBar.render()
        }
        
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

  private async promptDeleteActiveNote(): Promise<void> {
    const activeId = state.activeId
    if (!activeId) return

    const note = state.notes.find((n) => n.id === activeId)
    if (!note) return

    const header = this.createModalHeader('Delete Note')
    const content = document.createElement('div')
    content.innerHTML = `<p style="margin: 0; color: var(--text);">Are you sure you want to delete <strong>${this.escapeHtml(note.title)}</strong>? This action cannot be undone.</p>`

    modalManager.open({
      customHeader: header,
      customContent: content,
      size: 'sm',
      buttons: [
        { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() },
        {
          label: 'Delete',
          variant: 'danger',
          onClick: async (m) => {
            await this.deleteNote(activeId, note.path)
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

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private async renameNote(noteId: string, newTitle: string): Promise<void> {
    const isActive = state.activeId === noteId
    let notePath: string | undefined

    const existing = state.notes.find(n => n.id === noteId);
    if (existing) {
        notePath = existing.path;
    }

    const newId = newTitle.trim().replace(/[<>:"/\\|?*]/g, '-')
    if (noteId === newId) return;

    state.newlyCreatedIds.delete(noteId) // Rename counts as interacting

    try {
        // 1. Rename on disk (changes ID)
        const newMeta = await (window.api as any).renameNote(noteId, newId, notePath)
        const actualNewId = newMeta.id

        // 3. Update state.openTabs (manually update the ID so sync doesn't filter it)
        state.openTabs = state.openTabs.map(tab => {
            if (tab.id === noteId) {
                return { ...tab, id: actualNewId, title: newTitle, path: newMeta.path }
            }
            return tab
        })

        // 4. Update activeId if needed
        if (isActive) {
            state.activeId = actualNewId
        }

        // 5. Refresh from disk
        await this.refreshNotes()
        
        // 6. Re-open to ensure editor is synced with new ID
        if (isActive) {
             state.isDirty = false 
             await this.openNote(actualNewId, newMeta.path)
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
    const isInternal = state.vaultPath && filePath.toLowerCase().startsWith(state.vaultPath.toLowerCase())
    
    // If it's an internal .md file, just open it
    if (isInternal && filePath.toLowerCase().endsWith('.md')) {
         const name = filePath.split(/[/\\]/).pop() || ''
         const id = name.replace(/\.[^.]+$/, '') // Remove extension
         
         // Try to find exact note
         let note = state.notes.find(n => n.id === id)
         
         // If not found, force refresh in case it was just added externally
         if (!note) {
             await this.refreshNotes()
             note = state.notes.find(n => n.id === id)
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
}

ErrorHandler.init()
window.addEventListener('DOMContentLoaded', () => {
  const app = new App()
  void app.init()
})
