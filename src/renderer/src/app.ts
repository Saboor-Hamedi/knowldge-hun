import { state } from './core/state'
import type { NotePayload, NoteMeta, TreeItem } from './core/types'
import { sortNotes, syncTabsWithNotes, ensureTab, sortTabs } from './utils/helpers'
import { keyboardManager } from './core/keyboardManager'
import { modalManager } from './components/modal/modal'
import { ActivityBar } from './components/activitybar/activitybar'
import { SidebarTree } from './components/sidebar/sidebar-tree'
import { TabBar } from './components/tabbar/tabbar'
import { EditorComponent } from './components/editor/editor'
import { StatusBar } from './components/statusbar/statusbar'
import { SettingsPanel } from './components/settings/settings-panel'
import { contextMenu } from './components/contextmenu/contextmenu'
import { codicons } from './utils/codicons'
// ... import others

// Inside setupMobileEvents or similar setup section in App constructor/wireComponents:
// Actually, editor handles events internally, but App knows about contextMenu singleton.
// Let's pass a context menu handler to editor.

import { ThemeModal } from './components/theme-modal/theme-modal'
import { FuzzyFinder } from './components/fuzzy-finder/fuzzy-finder'
import { GraphView } from './components/graph/graph'
import { themeManager } from './core/themeManager'

function flattenTree(items: TreeItem[]): NoteMeta[] {
  const notes: NoteMeta[] = []
  for (const item of items) {
    if ('type' in item && item.type === 'folder') {
      notes.push(...flattenTree(item.children))
    } else {
      notes.push(item as NoteMeta)
    }
  }
  return notes
}

class App {
  private activityBar: ActivityBar
  private sidebar: SidebarTree
  private tabBar: TabBar
  private editor: EditorComponent
  private statusBar: StatusBar
  private settingsPanel: SettingsPanel
  private themeModal: ThemeModal
  private fuzzyFinder: FuzzyFinder
  private graphView: GraphView

  constructor() {
    this.activityBar = new ActivityBar('activityBar')
    this.sidebar = new SidebarTree('sidebar')
    this.tabBar = new TabBar('tabBar')
    this.editor = new EditorComponent('editorContainer')
    this.statusBar = new StatusBar('statusBar')
    this.settingsPanel = new SettingsPanel('settingsPanel')
    this.themeModal = new ThemeModal('app') // Mount to app container
    this.fuzzyFinder = new FuzzyFinder('app')
    this.graphView = new GraphView() // Mount to app container
    this.wireComponents()
    this.registerGlobalShortcuts()
    this.registerVaultChangeListener()
    this.setupMobileEvents()
  }

  private setupMobileEvents(): void {
    const handleCheck = () => {
      const isSmall = window.matchMedia('(max-width: 800px)').matches
      const shell = document.querySelector('.vscode-shell')
      
      // Auto-close if resizing to small and sidebar is open
      if (isSmall && shell && !shell.classList.contains('sidebar-hidden')) {
        this.sidebar.hide()
      }
    }

    // Check on resize
    window.addEventListener('resize', () => {
       handleCheck()
    })
    
    // Check on load
    handleCheck()

    document.addEventListener('click', (e) => {
      // Only run on mobile/small screens
      if (!window.matchMedia('(max-width: 800px)').matches) return

      const target = e.target as HTMLElement
      // Do not close if clicking inside sidebar, activity bar, or modal
      if (target.closest('.sidebar') || target.closest('.activitybar') || target.closest('.graph-modal')) return
      
      // Do not close if clicking the specific toggle button (usually in activity bar, but just in case)
      if (target.closest('[data-action="toggle-sidebar"]')) return

      const shell = document.querySelector('.vscode-shell')
      // If sidebar is visible (shell does NOT have .sidebar-hidden), hide it
      if (shell && !shell.classList.contains('sidebar-hidden')) {
        this.sidebar.hide()
      }
    })
  }

  private wireComponents(): void {
    // Activity bar handlers
    this.activityBar.setViewChangeHandler((view) => {
      if (view === 'settings') {
        this.settingsPanel.open()
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
      this.sidebar.setVisible(view === 'notes')
      // TODO: Handle search view if different pane
    })

    // Sidebar handlers
    this.sidebar.setNoteSelectHandler((id, path) => void this.openNote(id, path, 'sidebar'))
    this.sidebar.setNoteCreateHandler((path) => void this.createNote(undefined, path))
    this.sidebar.setNoteDeleteHandler((id, path) => void this.deleteNote(id, path))
    this.sidebar.setFolderCreateHandler((parentPath) => void this.createFolder(parentPath))
    this.sidebar.setVisibilityChangeHandler((visible) => {
      void window.api.updateSettings({ sidebarVisible: visible } as any)
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

    // TabBar handlers
    this.tabBar.setTabSelectHandler((id) => void this.openNoteFromTab(id))
    this.tabBar.setTabCloseHandler((id) => void this.closeTab(id))
    this.tabBar.setTabContextMenuHandler((id, e) => this.handleTabContextMenu(id, e))

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

    // ... existing settings handlers ... 
    this.settingsPanel.setSettingChangeHandler((settings) => {
      if (settings.theme) {
        themeManager.setTheme(settings.theme)
      }
      this.editor.applySettings(settings)
    })

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
      const toClose = state.openTabs.filter(t => t.id !== id && !state.pinnedTabs.has(t.id))
      
      for (const tab of toClose) {
          await this.closeTab(tab.id, true)
      }
  }

  private async closeAllTabs(): Promise<void> {
       // Close all non-pinned tabs
       const toClose = state.openTabs.filter(t => !state.pinnedTabs.has(t.id))
       for (const tab of toClose) {
           await this.closeTab(tab.id, true)
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

    window.addEventListener('item-rename', ((event: CustomEvent) => {
      const { id, type, newTitle } = event.detail
      if (type === 'note') {
        void this.renameNote(id, newTitle)
      } else if (type === 'folder') {
        void this.renameFolder(id, newTitle)
      }
    }) as EventListener)
  }

  private async renameFolder(id: string, newName: string): Promise<void> {
      const findFolder = (items: TreeItem[]): any => {
          for (const item of items) {
              if ('type' in item && item.type === 'folder') {
                  if (item.id === id) return item
                  const found = findFolder(item.children)
                  if (found) return found
              }
          }
          return null
      }
      
      const folder = findFolder(state.tree)
      if (!folder) {
          console.error("Folder not found", id)
          return
      }
      
      try {
          await window.api.renameFolder(folder.path, newName)
          this.statusBar.setStatus(`Renamed folder to ${newName}`)
          await this.refreshNotes()
      } catch (error) {
          console.error('Failed to rename folder', error)
          this.statusBar.setStatus('Folder rename failed')
      }
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
                keybinding: 'Ctrl+G',
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
              const snippet = content.replace(/^<!--\s*.+?\s*-->\n?/, '').substring(0, 1000).trim()
              return snippet + (content.length > 1000 ? '...' : '') || '(Empty unsaved note)'
          }

          try {
              const loaded = await window.api.loadNote(note.id, note.path)
              if (loaded && loaded.content && loaded.content.trim()) {
                  const snippet = loaded.content.substring(0, 1000).trim()
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
       key: 'Control+g',
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
      } else {
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

      this.statusBar.setMeta(`📁 ${info.path}`)
    } catch (error) {
      const message = (error as Error).message || 'Unknown error'
      console.error('Vault selection failed', error)
      this.statusBar.setStatus(`⚠️ ${message}`)
      this.statusBar.setMeta('Press Ctrl+Shift+V to try again')
    }
  }

  private async openSettings(): Promise<void> {
    if (!state.settings) return

    this.settingsPanel.setSettingChangeHandler(() => {
      this.editor.applySettings(state.settings || {})
      this.statusBar.setStatus('Settings saved')
    })

    this.settingsPanel.open()
  }

  private async refreshNotes(): Promise<void> {
    state.tree = await window.api.listNotes()
    state.notes = flattenTree(state.tree)
    sortNotes(state.notes)
    state.openTabs = syncTabsWithNotes(state.openTabs, state.notes)
    state.openTabs = sortTabs(state.openTabs, state.pinnedTabs)
    this.sidebar.renderTree(this.sidebar.getSearchValue())
    this.tabBar.render()
  }

  private async createNote(title?: string, path?: string): Promise<void> {
    const meta = await window.api.createNote(title || '', path)
    state.tree = await window.api.listNotes()
    state.notes = flattenTree(state.tree)
    sortNotes(state.notes)
    state.openTabs = ensureTab(state.openTabs, meta)
    state.openTabs = sortTabs(state.openTabs, state.pinnedTabs)
    this.sidebar.renderTree(this.sidebar.getSearchValue())
    this.tabBar.render()
    await this.openNote(meta.id, meta.path)
    void this.persistWorkspace()
  }

  private async openNote(id: string, path?: string, focusTarget: 'editor' | 'sidebar' | 'none' = 'editor'): Promise<void> {
    const isMobile = window.matchMedia('(max-width: 900px)').matches
    if (isMobile) {
      this.sidebar.hide()
    }

    const note = await window.api.loadNote(id, path)
    if (!note) {
      console.warn(`[App] Note ${id} not found at ${path}. Refreshing...`)
      this.statusBar.setStatus('Note missing on disk')
      if (state.activeId === id || !state.activeId) {
          this.editor.showEmpty()
      }
      await this.refreshNotes()
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
    this.statusBar.setStatus('Ready')
    this.statusBar.setMeta(`📁 ${state.vaultPath || ''}`)
    
    // Automatically reveal in sidebar ONLY if not previewing
    let sidebarUpdated = false
    if (focusTarget !== 'none') {
        sidebarUpdated = this.revealPathInSidebar(path)
    }

    if (!sidebarUpdated) {
        this.sidebar.updateSelection(id)
    }
    
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
            const folderId = `folder-${currentPath}`
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

  private async openNoteFromTab(id: string): Promise<void> {
    const note = state.notes.find(n => n.id === id)
    if (note) {
      await this.openNote(note.id, note.path)
    }
  }

  private async saveNote(payload: NotePayload): Promise<void> {
    if (!state.activeId) return

    const meta = await window.api.saveNote(payload)
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
  private async deleteNote(id: string, path?: string): Promise<void> {
    try {
      await window.api.deleteNote(id, path)
      
      // Refresh tree
      state.tree = await window.api.listNotes()
      state.notes = flattenTree(state.tree)
      state.openTabs = state.openTabs.filter((t) => t.id !== id)
      state.pinnedTabs.delete(id)

      // If deleted note was active, switch to another
      if (state.activeId === id) {
        const fallback = state.openTabs[state.openTabs.length - 1] || state.notes[0]
        if (fallback) {
          await this.openNote(fallback.id, fallback.path)
        } else {
          state.activeId = ''
          this.editor.showEmpty()
          this.statusBar.setStatus('No notes')
          this.statusBar.setMeta('')
        }
      }

      this.sidebar.renderTree(this.sidebar.getSearchValue())
      this.tabBar.render()
      this.statusBar.setStatus('Note deleted')
    } catch (error) {
      this.statusBar.setStatus('Failed to delete note')
      console.error('Delete error:', error)
    }
  }

  private async createFolder(parentPath?: string): Promise<void> {
    const header = this.createModalHeader('New Folder')
    modalManager.open({
      customHeader: header,
      size: 'sm',
      inputs: [
        {
          name: 'folderName',
          label: 'Folder Name',
          placeholder: 'Enter folder name',
          value: '',
          required: true
        }
      ],
      buttons: [
        { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() },
        {
          label: 'Create',
          variant: 'primary',
          onClick: async (m) => {
            const values = m.getValues()
            const folderName = (values.folderName as string)?.trim()
            if (!folderName) {
              this.statusBar.setStatus('Folder name required')
              return
            }

            try {
              await window.api.createFolder(folderName, parentPath)
              state.tree = await window.api.listNotes()
              state.notes = flattenTree(state.tree)
              this.sidebar.renderTree(this.sidebar.getSearchValue())
              this.statusBar.setStatus(`Created folder "${folderName}"`)
              m.close()
            } catch (error) {
              const message = (error as Error).message || 'Unknown error'
              this.statusBar.setStatus(`Failed: ${message}`)
              console.error('Folder creation failed:', error)
            }
          }
        }
      ]
    })
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

    try {
        // 1. Rename on disk (changes ID)
        const newMeta = await (window.api as any).renameNote(noteId, newId, notePath)
        
        // 2. Update Backup links in other notes
        if (typeof window.api.updateBacklinks === 'function') {
             await window.api.updateBacklinks(noteId, newId)
        }
        
        // 3. Update state.openTabs (manually update the ID so sync doesn't filter it)
        state.openTabs = state.openTabs.map(tab => {
            if (tab.id === noteId) {
                return { ...tab, id: newId, title: newTitle }
            }
            return tab
        })

        // 4. Update activeId if needed
        if (isActive) {
            state.activeId = newId
        }

        // 5. Refresh from disk
        await this.refreshNotes()
        
        // 6. Re-open to ensure editor is synced with new ID
        if (isActive) {
             await this.openNote(newId, newMeta.path)
        }
        
        this.statusBar.setStatus(`Renamed to "${newTitle}"`)
        void this.persistWorkspace()
    } catch (error) {
        console.error('Rename failed', error)
        this.statusBar.setStatus(`Rename failed: ${(error as Error).message}`)
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

window.addEventListener('DOMContentLoaded', () => {
  const app = new App()
  void app.init()
})
