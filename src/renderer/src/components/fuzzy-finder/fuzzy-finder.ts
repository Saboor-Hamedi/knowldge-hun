import { state } from '../../core/state'
import { codicons } from '../../utils/codicons'
import getFileIcon from '../../utils/fileIconMappers'
import './fuzzy-finder.css'

export interface Command {
  id: string
  label: string
  description?: string
  handler: () => void | Promise<void>
  icon?: string
}

export class FuzzyFinder {
  private container: HTMLElement
  private modal: HTMLElement | null = null
  private input: HTMLInputElement | null = null
  private list: HTMLElement | null = null
  private isOpen = false
  private backdrop: HTMLElement | null = null
  private selectedIndex = 0
  private visibleItems: any[] = []
  private onSelect?: (
    id: string,
    path?: string,
    type?: string,
    isFinal?: boolean
  ) => Promise<void> | void
  private mode: 'notes' | 'commands' = 'notes'
  private commands: Command[] = []

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()

    // Global Esc listener as safety
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close()
      }
    })
  }

  registerCommand(command: Command): void {
    this.commands.push(command)
  }

  registerCommands(commands: Command[]): void {
    this.commands.push(...commands)
  }

  setSelectHandler(
    handler: (id: string, path?: string, type?: string, isFinal?: boolean) => Promise<void> | void
  ): void {
    this.onSelect = handler
  }

  toggle(mode: 'notes' | 'commands' = 'notes'): void {
    if (this.isOpen) this.close()
    else this.open(mode)
  }

  open(mode: 'notes' | 'commands' = 'notes'): void {
    if (this.isOpen || !this.modal) return
    this.mode = mode
    this.isOpen = true
    this.modal.classList.add('is-open')

    // Create backdrop
    this.backdrop = document.createElement('div')
    this.backdrop.className = 'fuzzy-backdrop'
    this.container.appendChild(this.backdrop)
    this.backdrop.addEventListener('click', () => this.close())

    // Update placeholder and icon based on mode
    this.updateModeUI()

    // Reset
    this.filter('')
  }

  private switchToCommandMode(): void {
    if (this.mode === 'commands') return
    this.mode = 'commands'
    this.updateModeUI()
  }

  private updateModeUI(): void {
    if (this.input) {
      this.input.placeholder =
        this.mode === 'commands' ? 'Type a command name...' : 'Type filename to search...'
      this.input.focus()
    }
    const iconEl = this.modal?.querySelector('.fuzzy-icon')
    if (iconEl) {
      iconEl.textContent = this.mode === 'commands' ? '>' : '🔍'
      iconEl.className = this.mode === 'commands' ? 'fuzzy-icon fuzzy-icon--command' : 'fuzzy-icon'
    }
  }

  close(): void {
    if (!this.isOpen || !this.modal) return
    this.isOpen = false
    this.modal.classList.remove('is-open')
    if (this.backdrop) {
      this.backdrop.remove()
      this.backdrop = null
    }
  }

  private render(): void {
    this.modal = document.createElement('div')
    this.modal.className = 'fuzzy-modal'
    this.modal.innerHTML = `
      <div class="fuzzy-header">
        <span class="fuzzy-icon">🔍</span>
        <input class="fuzzy-input" placeholder="Type filename to search..." autocomplete="off" />
      </div>
      <div class="fuzzy-list"></div>
    `
    this.container.appendChild(this.modal)

    this.input = this.modal.querySelector('.fuzzy-input')
    this.list = this.modal.querySelector('.fuzzy-list')

    // Bind input event with ">" detection for mode switching
    this.input?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value
      // Detect ">" at the start to switch to command mode
      if (this.mode === 'notes' && value.startsWith('>')) {
        this.switchToCommandMode()
        // Remove the ">" and set the remaining value
        const remaining = value.substring(1)
        if (this.input) {
          this.input.value = remaining
        }
        this.filter(remaining)
      } else {
        this.filter(value)
      }
    })

    // Also handle keydown for immediate ">" detection
    this.input?.addEventListener('keydown', (e) => {
      // If user types ">" and we're in notes mode, switch immediately
      if (this.mode === 'notes' && e.key === '>' && !e.shiftKey) {
        e.preventDefault()
        this.switchToCommandMode()
        if (this.input) {
          this.input.value = ''
        }
        this.filter('')
        return
      }
    })

    // Global key listener handles navigation regardless of focus
    if (!this.globalKeyListenerAttached) {
      window.addEventListener('keydown', (e) => void this.handleGlobalKey(e))
      this.globalKeyListenerAttached = true
    }
  }

  private globalKeyListenerAttached = false

  private async handleGlobalKey(e: KeyboardEvent): Promise<void> {
    if (!this.isOpen) return

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.close()
      return
    }

    if (e.key === 'ArrowDown') {
      if (this.visibleItems.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        this.selectedIndex = (this.selectedIndex + 1) % this.visibleItems.length
        this.renderList()
        this.scrollToSelected()
      }
    } else if (e.key === 'ArrowUp') {
      if (this.visibleItems.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        this.selectedIndex =
          (this.selectedIndex - 1 + this.visibleItems.length) % this.visibleItems.length
        this.renderList()
        this.scrollToSelected()
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const item = this.visibleItems[this.selectedIndex]
      if (item) {
        // Always close first for immediate feedback
        this.close()

        if (this.mode === 'commands') {
          const command = item as Command
          await command.handler()
        } else {
          // Call onSelect for notes
          if (item.id) {
            await this.onSelect?.(item.id, item.path, item.type, true)
          }
        }
      }
    } else {
      // For other keys, ensure input is focused so user can type
      if (
        this.input &&
        document.activeElement !== this.input &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        this.input.focus()
      }
    }
  }

  private scrollToSelected(): void {
    const selectedEl = this.list?.children[this.selectedIndex] as HTMLElement
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' })
    }
  }

  private highlight(text: string, query: string): string {
    if (!query) return text
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return text.replace(regex, '<span class="fuzzy-match">$1</span>')
  }

  private filter(query: string): void {
    if (this.mode === 'commands') {
      this.filterCommands(query)
      return
    }

    const term = query.toLowerCase()

    // 1. Collect only notes (files)
    const allItems: any[] = []

    // Add notes - ensure type is always 'note' by putting it after spread
    state.notes.forEach((n) => allItems.push({ ...n, type: 'note' }))

    // FOLDERS REMOVED from search results as per request ("only allow files two show up")

    let matches: any[] = []

    if (!term) {
      // Show recent 5 notes on empty query
      matches = [...allItems].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5)
    } else {
      matches = allItems.filter((n) => {
        const title = (n.title || '').toLowerCase()
        const path = (n.path || '').toLowerCase()
        return title.includes(term) || path.includes(term)
      })

      // 2. Sort by relevance
      matches.sort((a, b) => {
        const aTitle = (a.title || '').toLowerCase()
        const bTitle = (b.title || '').toLowerCase()
        const aStarts = aTitle.startsWith(term)
        const bStarts = bTitle.startsWith(term)

        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        return 0
      })

      matches = matches.slice(0, 50)
    }

    this.visibleItems = matches
    this.selectedIndex = 0
    this.query = term // Store query
    this.renderList()
  }

  private filterCommands(query: string): void {
    const term = query.toLowerCase()
    let matches: Command[] = []

    if (!term) {
      matches = [...this.commands]
    } else {
      matches = this.commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(term) ||
          cmd.description?.toLowerCase().includes(term) ||
          cmd.id.toLowerCase().includes(term)
      )
    }

    this.visibleItems = matches
    this.selectedIndex = 0
    this.query = term
    this.renderList()
  }

  private query = ''

  private renderList(): void {
    if (!this.list) return

    if (this.visibleItems.length === 0) {
      this.list.innerHTML = '<div class="fuzzy-empty">No items found</div>'
      return
    }

    if (this.mode === 'commands') {
      this.list.innerHTML = this.visibleItems
        .map((item, index) => {
          const isSelected = index === this.selectedIndex ? 'is-selected' : ''
          const command = item as Command
          const label = this.highlightMatch(command.label, this.query)
          return `
          <div class="fuzzy-item ${isSelected}" data-index="${index}">
            <div class="fuzzy-item__content">
              <div class="fuzzy-item__label">${label}</div>
              ${command.description ? `<div class="fuzzy-item__description">${command.description}</div>` : ''}
            </div>
            ${command.icon ? `<div class="fuzzy-item__icon">${command.icon}</div>` : ''}
          </div>
        `
        })
        .join('')
    } else {
      this.list.innerHTML = this.visibleItems
        .map((item, index) => {
          const isSelected = index === this.selectedIndex ? 'is-selected' : ''
          const icon =
            item.type === 'folder' ? codicons.folder : getFileIcon(item.title || '', 'markdown')
          const noteType = item.type === 'note' ? this.getNoteType(item.title || '') : ''
          const title = this.highlight(item.title || '', this.query)
          const path = this.highlight(item.path ? item.path.replace(/\\/g, '/') : '', this.query)

          return `
          <div class="fuzzy-item ${isSelected}" data-index="${index}" ${noteType ? `data-note-type="${noteType}"` : ''}>
            <div class="fuzzy-item__main">
              <div class="fuzzy-item__icon" ${noteType ? `data-note-type="${noteType}"` : ''}>${icon}</div>
              <span class="fuzzy-item__title">${title}</span>
              <span class="fuzzy-item__path">${path}</span>
            </div>
          </div>
        `
        })
        .join('')
    }

    // Click and hover selection
    const items = this.list.querySelectorAll('.fuzzy-item')
    items.forEach((el, index) => {
      el.addEventListener('click', () => {
        const idx = parseInt((el as HTMLElement).dataset.index || String(index))
        this.selectedIndex = idx
        const item = this.visibleItems[idx]
        if (!item) return

        // Always close first for immediate feedback
        this.close()

        if (this.mode === 'commands') {
          const command = item as Command
          void command.handler()
        } else {
          // Call onSelect for notes
          if (item.id) {
            this.onSelect?.(item.id, item.path, item.type, true)
          }
        }
      })
      el.addEventListener('mouseover', () => {
        const idx = parseInt((el as HTMLElement).dataset.index || String(index))
        this.selectedIndex = idx
        this.renderList()
      })
    })
  }

  private highlightMatch(text: string, query: string): string {
    if (!query) return text
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const index = lowerText.indexOf(lowerQuery)
    if (index === -1) return text
    return `${text.substring(0, index)}<mark>${text.substring(index, index + query.length)}</mark>${text.substring(index + query.length)}`
  }

  private getNoteType(noteName: string): string {
    const name = noteName.toLowerCase()

    // Since this is a .md project, all notes are .md files by default
    // The noteName here is the note title (without .md extension in the system)
    // But we check for special patterns like "settings.json" which would be "settings.json.md"

    // Check for special patterns in the title (these would be *.json.md, *.yaml.md, etc.)
    if (name.includes('.json')) {
      // e.g., "settings.json" -> "settings.json.md"
      return 'json'
    }
    if (name.includes('.yaml') || name.includes('.yml')) {
      // e.g., "config.yaml" -> "config.yaml.md"
      return 'typescript'
    }
    if (name.includes('.js') && (name.includes('.jsx') || name.endsWith('.js'))) {
      // e.g., "component.jsx" -> "component.jsx.md"
      return 'javascript'
    }
    if (name.includes('.ts') && (name.includes('.tsx') || name.endsWith('.ts'))) {
      // e.g., "component.tsx" -> "component.tsx.md"
      return 'typescript'
    }
    if (name.includes('.html')) {
      // e.g., "template.html" -> "template.html.md"
      return 'html'
    }
    if (
      name.includes('.css') ||
      name.includes('.scss') ||
      name.includes('.sass') ||
      name.includes('.less')
    ) {
      // e.g., "styles.css" -> "styles.css.md"
      return 'css'
    }

    // Default: all notes are markdown files
    return 'markdown'
  }
}
