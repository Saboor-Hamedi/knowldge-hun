import { state } from '../../core/state'
import type { NoteMeta, FolderItem } from '../../core/types'
import { getFolderIcon, getFileIcon, codicons } from '../../utils/codicons'
import { contextMenu } from '../contextmenu/contextmenu'
import './sidebar-tree.css'

export class SidebarTree {
  private container: HTMLElement
  private bodyEl: HTMLElement
  private searchEl: HTMLInputElement
  private headerEl: HTMLElement
  private onNoteSelect?: (id: string, path?: string) => void
  private onNoteCreate?: (path?: string) => void
  private onNoteDelete?: (id: string, path?: string) => void
  private onFolderCreate?: (parentPath?: string) => void
  private editingId: string | null = null
  private draggedItem: { type: 'note' | 'folder'; id: string; path?: string } | null = null
  private selectedFolderPath: string | null = null
  private selectedId: string | null = null
  private onVisibilityChange?: (visible: boolean) => void
  private onGraphClick?: () => void

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
    
    this.headerEl = this.container.querySelector('.sidebar__header') as HTMLElement
    this.bodyEl = this.container.querySelector('.sidebar__body') as HTMLElement
    this.searchEl = this.container.querySelector('#searchInput') as HTMLInputElement
    
    this.attachEvents()
    this.attachBackdropListener()
  }

  setGraphClickHandler(handler: () => void): void {
      this.onGraphClick = handler
  }

  private attachBackdropListener(): void {
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    if (!shell) return

    shell.addEventListener('click', (e) => {
      // Check if we are in mobile mode
      const isMobile = window.matchMedia('(max-width: 900px)').matches
      if (!isMobile) return

      // Check if sidebar is open (not hidden)
      if (shell.classList.contains('sidebar-hidden')) return

      // Check if click target is the shell (which receives backdrop clicks)
      // and NOT inside the sidebar or activity bar
      const target = e.target as HTMLElement
      if (target.classList.contains('vscode-shell')) {
         this.hide()
      }
    })
  }

  setNoteSelectHandler(handler: (id: string, path?: string) => void): void {
    this.onNoteSelect = (id, path) => {
      // Capture if we currently have focus in the list
      const hadFocus = this.bodyEl.contains(document.activeElement)
      
      this.selectedId = id
      this.updateSelection(id)
      
      if (hadFocus) {
          // Restore focus immediately to maintain keyboard flow
          this.scrollToActive(true)
      }
      
      handler(id, path)
    }
  }

  setNoteCreateHandler(handler: (path?: string) => void): void {
    this.onNoteCreate = handler
  }

  setNoteDeleteHandler(handler: (id: string, path?: string) => void): void {
    this.onNoteDelete = handler
  }

  setFolderCreateHandler(handler: (parentPath?: string) => void): void {
    this.onFolderCreate = handler
  }

  setVisibilityChangeHandler(handler: (visible: boolean) => void): void {
    this.onVisibilityChange = handler
  }

  toggle(): void {
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    if (!shell) return
    shell.classList.toggle('sidebar-hidden')
    this.onVisibilityChange?.(!shell.classList.contains('sidebar-hidden'))
  }

  hide(): void {
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    if (!shell) return
    shell.classList.add('sidebar-hidden')
    this.onVisibilityChange?.(false)
  }

  show(): void {
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    if (!shell) return
    shell.classList.remove('sidebar-hidden')
    this.onVisibilityChange?.(true)
  }

  setVisible(visible: boolean): void {
    if (visible) this.show()
    else this.hide()
  }

  isEditing(): boolean {
    return this.editingId !== null
  }

  private render(): void {
    this.container.innerHTML = `
      <header class="sidebar__header">
        <div class="sidebar__title">
          <span class="sidebar__title-text">EXPLORER</span>
        </div>
        <div class="sidebar__actions">
          <button class="sidebar__action" title="New Folder" data-action="new-folder">
            ${codicons.newFolder}
          </button>
          <button class="sidebar__action" title="New Note (Ctrl+N)" data-action="new">
            ${codicons.add}
          </button>
          <button class="sidebar__action" title="Reveal in Explorer" data-action="reveal">
            ${codicons.folderOpened}
          </button>
        </div>
      </header>
      
      <div class="sidebar__search">
        <input id="searchInput" type="search" placeholder="Search..." aria-label="Search notes" />
      </div>
      
      <div class="sidebar__body"></div>
      
      <footer class="sidebar__footer"></footer>
    `
  }

  renderTree(filter = ''): void {
    const term = filter.trim().toLowerCase()
    
    // If we have an activeId from state but no local selection, sync them initially
    if (!this.selectedId && state.activeId) {
        this.selectedId = state.activeId
    }

    this.bodyEl.innerHTML = ''
    
    // Ensure state.tree is valid before processing
    if (!state.tree) return

    const items = term.length ? this.filterTree(state.tree, term) : this.sortTree(state.tree)

    if (items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'sidebar__empty'
      empty.textContent = term.length ? 'No matches' : 'No notes or folders yet'
      this.bodyEl.appendChild(empty)
      return
    }

    this.renderItems(items, this.bodyEl, 0)
  }

  private sortTree(items: (FolderItem | NoteMeta)[]): (FolderItem | NoteMeta)[] {
    return [...items].sort((a, b) => {
      // Folders first
      const aIsFolder = 'children' in a
      const bIsFolder = 'children' in b
      
      if (aIsFolder && !bIsFolder) return -1
      if (!aIsFolder && bIsFolder) return 1
      
      // Then alphabetical
      return a.title.localeCompare(b.title)
    })
  }

  private filterTree(items: (FolderItem | NoteMeta)[], term: string): (FolderItem | NoteMeta)[] {
    const result: (FolderItem | NoteMeta)[] = []
    
    for (const item of items) {
      if (item.type === 'folder') {
        // It's a folder
        const folder = item as FolderItem
        const matchesSelf = (folder.title || '').toLowerCase().includes(term)
        const children = folder.children || []
        const filteredChildren = this.filterTree(children, term)
        
        if (matchesSelf || filteredChildren.length > 0) {
          result.push({
            ...folder,
            children: filteredChildren
          })
        }
      } else {
        // It's a note
        if ((item.title || '').toLowerCase().includes(term)) {
          result.push(item)
        }
      }
    }
    
    return this.sortTree(result)
  }

  private renderItems(items: (FolderItem | NoteMeta)[], container: HTMLElement, depth: number): void {
    for (const item of items) {
      if (item.type === 'folder') {
        this.renderFolder(item as FolderItem, container, depth)
      } else {
        this.renderNote(item as NoteMeta, container, depth)
      }
    }
  }

  private renderFolder(folder: FolderItem, container: HTMLElement, depth: number): void {
    const isFiltered = this.searchEl.value.trim().length > 0
    const isExpanded = isFiltered || state.expandedFolders.has(folder.id)
    const isActive = this.selectedId === folder.id
    
    const el = document.createElement('div')
    el.className = `tree-item tree-item--folder${isExpanded ? ' is-expanded' : ''}${isActive ? ' is-active' : ''}`
    el.dataset.id = folder.id
    el.dataset.type = 'folder'
    if (folder.path) el.dataset.path = folder.path
    el.dataset.depth = String(depth)
    el.draggable = true
    el.tabIndex = 0
    
    const indent = document.createElement('span')
    indent.className = 'tree-item__indent'
    indent.style.width = `${depth * 16}px`
    
    const arrow = document.createElement('span')
    arrow.className = 'tree-item__expand'
    arrow.innerHTML = codicons.chevronRight
    
    const icon = document.createElement('span')
    icon.className = 'tree-item__icon'
    icon.innerHTML = getFolderIcon(folder.title)
    
    const label = document.createElement('span')
    label.className = 'tree-item__label'
    label.textContent = folder.title
    label.dataset.itemId = folder.id
    
    el.appendChild(indent)
    el.appendChild(arrow)
    el.appendChild(icon)
    el.appendChild(label)
    container.appendChild(el)
    
    if (isExpanded && folder.children) {
        this.renderItems(this.sortTree(folder.children), container, depth + 1)
    }
  }

  private renderNote(note: NoteMeta, container: HTMLElement, depth: number): void {
    const isActive = this.selectedId === note.id
    
    const el = document.createElement('div')
    el.className = `tree-item tree-item--note${isActive ? ' is-active' : ''}`
    el.dataset.id = note.id
    el.dataset.type = 'note'
    if (note.path) el.dataset.path = note.path
    el.dataset.depth = String(depth)
    el.draggable = true
    el.tabIndex = 0

    const indent = document.createElement('span')
    indent.className = 'tree-item__indent'
    indent.style.width = `${depth * 16}px`

    const spacer = document.createElement('span')
    spacer.className = 'tree-item__expand'

    const icon = document.createElement('span')
    icon.className = 'tree-item__icon'
    icon.innerHTML = getFileIcon(note.title)

    const label = document.createElement('span')
    label.className = 'tree-item__label'
    label.textContent = note.title
    label.dataset.noteId = note.id

    el.appendChild(indent)
    el.appendChild(spacer)
    el.appendChild(icon)
    el.appendChild(label)
    container.appendChild(el)
  }

  private attachEvents(): void {
    // Header actions
    this.headerEl.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const button = target.closest('.sidebar__action') as HTMLElement
      if (!button) return

      const action = button.dataset.action
      if (action === 'new') {
        this.onNoteCreate?.(this.selectedFolderPath || undefined)
      } else if (action === 'new-folder') {
        this.onFolderCreate?.(this.selectedFolderPath || undefined)
      } else if (action === 'reveal') {
        void window.api.revealVault()
      } else if (action === 'graph') {
        this.onGraphClick?.()
      }
    })

    // Search
    this.searchEl.addEventListener('input', () => {
      this.renderTree(this.searchEl.value)
    })

    // Tree item click
    this.bodyEl.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const item = target.closest('.tree-item') as HTMLElement
      
      if (!item) {
        // Background click - Select Root
        this.selectedId = null
        this.selectedFolderPath = null
        
        const currentActive = this.bodyEl.querySelector('.tree-item.is-active')
        if (currentActive) {
            currentActive.classList.remove('is-active')
        }
        return
      }

      // Expand/collapse on chevron click
      if (target.classList.contains('tree-item__expand') || target.closest('.tree-item__expand')) {
        event.stopPropagation()
        if (item.dataset.type === 'folder') {
          this.toggleFolder(item.dataset.id!)
        }
        return
      }

      // Don't trigger if clicking on label while editing
      if (this.editingId === item.dataset.id && target.classList.contains('tree-item__label')) {
        event.stopPropagation()
        return
      }

      // Stop propagation for selection clicks too
      event.stopPropagation()

      // Selection logic
      if (item.dataset.type === 'note' && item.dataset.id) {
        this.selectedId = item.dataset.id
        this.selectedFolderPath = item.dataset.path || null
        this.onNoteSelect?.(item.dataset.id, item.dataset.path || undefined)
      } else if (item.dataset.type === 'folder') {
        this.selectedId = item.dataset.id!
        this.selectedFolderPath = item.dataset.id || null
        this.toggleFolder(item.dataset.id!)
      }
    })
    
    // Background Context Menu
    this.bodyEl.addEventListener('contextmenu', (event) => {
      const target = event.target as HTMLElement
      const item = target.closest('.tree-item') as HTMLElement
      
      if (!item) {
        event.preventDefault()
        contextMenu.show(event.clientX, event.clientY, [
          {
            label: 'New Note',
            onClick: () => this.onNoteCreate?.()
          },
          {
            label: 'New Folder',
            onClick: () => this.onFolderCreate?.('')
          }
        ])
        return
      }

      event.preventDefault()
      this.showContextMenu(event, item)
    })

    // Double-click to rename
    this.bodyEl.addEventListener('dblclick', (event) => {
      const target = event.target as HTMLElement
      const label = target.closest('.tree-item__label') as HTMLElement
      if (!label) return

      const itemId = label.dataset.itemId || label.dataset.noteId
      if (itemId) {
        this.startRename(itemId)
      }
    })

    // Drag and drop events
    this.bodyEl.addEventListener('dragstart', this.handleDragStart.bind(this))
    this.bodyEl.addEventListener('dragover', this.handleDragOver.bind(this))
    this.bodyEl.addEventListener('dragleave', this.handleDragLeave.bind(this))
    this.bodyEl.addEventListener('drop', this.handleDrop.bind(this))
    this.bodyEl.addEventListener('dragend', this.handleDragEnd.bind(this))

    // Keyboard
    this.bodyEl.addEventListener('keydown', this.handleKeyboard.bind(this))

    // Inline rename handlers (blur/enter/escape)
    this.bodyEl.addEventListener('blur', (event) => {
        const label = event.target as HTMLElement
        if (!label.classList.contains('tree-item__label')) return
        if (!label.contentEditable || label.contentEditable === 'false') return
        void this.finishRename(label)
    }, true)

    this.bodyEl.addEventListener('keydown', (event) => {
      const label = event.target as HTMLElement
      if (!label.classList.contains('tree-item__label')) return
      if (!label.contentEditable || label.contentEditable === 'false') return

      if (event.key === 'Enter') {
        event.preventDefault()
        void this.finishRename(label)
        label.blur()
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        const original = label.dataset.originalTitle || ''
        label.textContent = original
        label.contentEditable = 'false'
        label.classList.remove('is-editing')
        this.editingId = null
        label.blur()
      }
    })
  }

  private toggleFolder(id: string): void {
    if (state.expandedFolders.has(id)) {
      state.expandedFolders.delete(id)
    } else {
      state.expandedFolders.add(id)
    }
    this.renderTree(this.searchEl.value)
    
    // Restore focus to the toggled folder
    setTimeout(() => {
        const newItem = this.bodyEl.querySelector(`.tree-item[data-id="${id}"]`) as HTMLElement
        newItem?.focus()
    }, 0)
  }

  private handleDragStart(event: DragEvent): void {
    const target = event.target as HTMLElement
    const item = target.closest('.tree-item') as HTMLElement
    if (!item) return

    this.draggedItem = {
      type: item.dataset.type as 'note' | 'folder',
      id: item.dataset.id!,
      path: item.dataset.path || undefined
    }

    event.dataTransfer!.effectAllowed = 'copyMove'
    
    if (this.draggedItem.type === 'note') {
         event.dataTransfer!.setData('text/plain', `note:${this.draggedItem.id}`)
    } else {
         event.dataTransfer!.setData('text/plain', this.draggedItem.path || '') 
    }
    
    event.dataTransfer!.setData('from-sidebar', 'true')
    item.style.opacity = '0.5'
  }

  private handleDragOver(event: DragEvent): void {
    event.preventDefault()
    const target = event.target as HTMLElement
    const item = target.closest('.tree-item') as HTMLElement
    
    if (!this.draggedItem) return

    if (!item && (target.classList.contains('sidebar__body') || target === this.bodyEl)) {
      event.dataTransfer!.dropEffect = 'move'
      this.bodyEl.classList.add('drag-over-root')
      return
    }

    if (item && item.dataset.id !== this.draggedItem.id) {
      event.dataTransfer!.dropEffect = 'move'
      item.classList.add('drag-over')
    }
  }

  private handleDragLeave(event: DragEvent): void {
    const target = event.target as HTMLElement
    const item = target.closest('.tree-item') as HTMLElement
    
    if (item) {
        item.classList.remove('drag-over')
    } else {
        this.bodyEl.classList.remove('drag-over-root')
    }
  }

  private async handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault()
    event.stopPropagation()

    document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'))
    this.bodyEl.classList.remove('drag-over-root')

    if (!this.draggedItem) return

    const target = event.target as HTMLElement
    const folder = target.closest('.tree-item') as HTMLElement | null
    let targetPath = ''

    if (!folder) {
      if (target.classList.contains('sidebar__body') || target === this.bodyEl) {
        targetPath = ''
      } else {
        this.draggedItem = null
        return
      }
    } else {
        // Dropping on an item (folder or note)
        if (folder.dataset.id === this.draggedItem.id) return
        
        // If target is a folder, move INTO it. If note, move into its parent.
        if (folder.dataset.type === 'folder') {
            targetPath = folder.dataset.id!
        } else {
            targetPath = folder.dataset.path || ''
        }
    }

    try {
      if (this.draggedItem.type === 'note') {
        await window.api.moveNote(
          this.draggedItem.id,
          this.draggedItem.path,
          targetPath || undefined
        )
      } else if (this.draggedItem.type === 'folder') {
        const sourcePath = this.draggedItem.id.replace(/\\/g, '/')
        const targetPathNorm = targetPath.replace(/\\/g, '/')
        
        console.log('[Drag] Moving folder:', sourcePath, '->', targetPathNorm)
        
        if (targetPathNorm.startsWith(sourcePath + '/') || targetPathNorm === sourcePath) {
          console.warn('[Drag] Blocked: Cannot move folder into itself')
          window.dispatchEvent(new CustomEvent('status', { 
            detail: { message: 'Cannot move folder into itself or its descendants' } 
          }))
          this.draggedItem = null
          return
        }
        
        await window.api.moveFolder(sourcePath, targetPath)
      }
      
      // Auto-expand the target folder so the user sees the dropped item
      if (targetPath) {
          state.expandedFolders.add(targetPath)
      }
      
      window.dispatchEvent(new CustomEvent('vault-changed'))
    } catch (error) {
      console.error('Failed to move item:', error)
    }

    this.draggedItem = null
  }

  private handleDragEnd(event: DragEvent): void {
    const target = event.target as HTMLElement
    const item = target.closest('.tree-item') as HTMLElement
    if (item) item.style.opacity = ''
    
    document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'))
    this.bodyEl.classList.remove('drag-over-root')
    
    this.draggedItem = null
  }

  private handleKeyboard(event: KeyboardEvent): void {
    const target = event.target as HTMLElement
    const item = target.closest('.tree-item') as HTMLElement
    if (!item) return

    const key = event.key.toLowerCase()

    // Ctrl+R: Rename
    if ((event.ctrlKey || event.metaKey) && key === 'r') {
      event.preventDefault()
      const itemId = item.dataset.id
      if (itemId) {
        this.startRename(itemId)
      }
      return
    }

    // Delete or Ctrl+D
    if (key === 'delete' || ((event.ctrlKey || event.metaKey) && key === 'd')) {
      event.preventDefault()
      if (item.dataset.type === 'note' && item.dataset.id) {
        this.onNoteDelete?.(item.dataset.id, item.dataset.path || undefined)
      } else {
        void this.deleteFolder(item.dataset.path!)
      }
      return
    }

    // Arrow Left: Collapse or Jump to Parent
    if (key === 'arrowleft') {
        event.preventDefault()
        // If folder and expanded, collapse it
        if (item.dataset.type === 'folder' && state.expandedFolders.has(item.dataset.id!)) {
            this.toggleFolder(item.dataset.id!)
            return
        }

        // Logic to jump to parent (previous sibling with less indent)
        const depth = parseInt((item.querySelector('.tree-item__indent') as HTMLElement)?.style.width || '0') / 16
        if (depth > 0) {
            let prev = item.previousElementSibling
        // Limit parent jump loop to avoid infinite loop
        let attempts = 0
        while (prev && attempts < 50) {
            attempts++
            const prevIndentEl = prev.querySelector('.tree-item__indent') as HTMLElement
            const prevIndent = prevIndentEl?.style.width || '0'
            const prevDepth = parseInt(prevIndent) / 16
            
            if (prevDepth < depth) {
                // Found the parent folder item
                const prevId = (prev as HTMLElement).dataset.id!
                if (prev.getAttribute('data-type') === 'folder') {
                    this.selectedFolderPath = (prev as HTMLElement).dataset.path || null
                }
                // Just highlight parent, don't toggle
                this.updateSelection(prevId)
                break
            }
            prev = prev.previousElementSibling
        }
      }
      return
    }

    // Arrow Right: Expand Folder
    if (item.dataset.type === 'folder' && key === 'arrowright') {
        event.preventDefault()
        if (!state.expandedFolders.has(item.dataset.id!)) {
          this.toggleFolder(item.dataset.id!)
        }
        return
    }

    // Arrow Up/Down: Navigation
    if (key === 'arrowdown' || key === 'arrowup') {
      if (!event.shiftKey) {
        event.preventDefault()
        const items = Array.from(this.bodyEl.querySelectorAll('.tree-item')) as HTMLElement[]
        const currentIndex = items.indexOf(item)
        
        let nextIndex = currentIndex
        if (key === 'arrowdown') nextIndex = Math.min(currentIndex + 1, items.length - 1)
        if (key === 'arrowup') nextIndex = Math.max(currentIndex - 1, 0)

        const nextItem = items[nextIndex]
        if (nextItem && nextIndex !== currentIndex) {
            const nextId = nextItem.dataset.id!
            
            // Just move visual focus/selection. DO NOT open/toggle.
            this.selectedFolderPath = nextItem.dataset.path || null
            
            this.updateSelection(nextId)
            // Function updateSelection calls scrollToActive(true), which ensures focus
        }
      }
      return
    }

    // Enter: Open note or toggle folder
    if (key === 'enter') {
      event.preventDefault()
      if (item.dataset.type === 'note' && item.dataset.id) {
        this.onNoteSelect?.(item.dataset.id, item.dataset.path || undefined)
      } else if (item.dataset.type === 'folder') {
        const folderId = item.dataset.id!
        this.toggleFolder(folderId)
      }
    }
  }

  private showContextMenu(event: MouseEvent, item: HTMLElement): void {
    if (item.dataset.type === 'folder') {
      contextMenu.show(event.clientX, event.clientY, [
        {
          label: 'New Note',
          onClick: () => this.onNoteCreate?.(item.dataset.id)
        },
        {
          label: 'New Folder',
          onClick: () => this.onFolderCreate?.(item.dataset.id)
        },
        { separator: true },
        {
          label: 'Rename',
          keybinding: 'Ctrl+R',
          onClick: () => this.startRename(item.dataset.id!)
        },
        {
          label: 'Delete',
          keybinding: 'Del',
          onClick: () => void this.deleteFolder(item.dataset.id!)
        }
      ])
    } else {
      contextMenu.show(event.clientX, event.clientY, [
        {
          label: 'Rename',
          keybinding: 'Ctrl+R',
          onClick: () => this.startRename(item.dataset.id!)
        },
        { separator: true },
        {
          label: 'Delete',
          keybinding: 'Ctrl+D',
          onClick: () => this.onNoteDelete?.(item.dataset.id!, item.dataset.path || undefined)
        }
      ])
    }
  }

  public startRename(itemId: string): void {
    const attemptRename = (retries = 5) => {
        const item = this.bodyEl.querySelector(`.tree-item[data-id="${itemId}"]`) as HTMLElement
        if (!item) {
            if (retries > 0) setTimeout(() => attemptRename(retries - 1), 50)
            return
        }
        
        const label = item.querySelector('.tree-item__label') as HTMLElement
        if (!label) return

        this.editingId = itemId
        label.dataset.originalTitle = label.textContent || ''
        label.contentEditable = 'true'
        label.classList.add('is-editing')
        
        // Explicitly focus and select all text
        setTimeout(() => {
           if (label.isConnected) {
             label.focus()
             const range = document.createRange()
             range.selectNodeContents(label)
             const sel = window.getSelection()
             sel?.removeAllRanges()
             sel?.addRange(range)
             
             // Ensure it's scrolled into view
             label.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
           }
        }, 50)
    }

    attemptRename()
  }

  private async finishRename(label: HTMLElement): Promise<void> {
    const itemId = label.dataset.itemId || label.dataset.noteId
    const itemType = label.closest('.tree-item')?.getAttribute('data-type') || 'note'
    if (!itemId) return

    const newTitle = label.textContent?.trim() || 'Untitled'
    const originalTitle = label.dataset.originalTitle || 'Untitled'
    
    label.contentEditable = 'false'
    label.classList.remove('is-editing')
    this.editingId = null
    
    if (newTitle !== originalTitle) {
        window.dispatchEvent(new CustomEvent('item-rename', {
            detail: { id: itemId, type: itemType, newTitle, oldTitle: originalTitle }
        }))
    }
  }

  private async deleteFolder(path: string): Promise<void> {
    if (!confirm(`Delete folder and all contents?`)) return
    try {
      await window.api.deleteFolder(path)
      window.dispatchEvent(new CustomEvent('vault-changed'))
    } catch (error) {
      console.error('Failed to delete', error)
    }
  }

  updateSelection(id: string): void {
      if (this.selectedId === id) return // No change
      
      this.selectedId = id
      
      const currentActive = this.bodyEl.querySelector('.tree-item.is-active')
      if (currentActive) {
          currentActive.classList.remove('is-active')
      }
      
      const newActive = this.bodyEl.querySelector(`.tree-item[data-id="${id}"]`) as HTMLElement
      if (newActive) {
          newActive.classList.add('is-active')
          this.scrollToActive(true)
      }
  }

  scrollToActive(shouldFocus: boolean = true): void {
    const activeItem = this.bodyEl.querySelector('.tree-item.is-active') as HTMLElement
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'auto' })
      if (shouldFocus) activeItem.focus()
    }
  }

  getSearchValue(): string {
    return this.searchEl.value
  }
}
