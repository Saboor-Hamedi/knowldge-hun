import { state } from '../../core/state'
import { codicons } from '../../utils/codicons'
import './fuzzy-finder.css'

export class FuzzyFinder {
  private container: HTMLElement
  private modal: HTMLElement | null = null
  private input: HTMLInputElement | null = null
  private list: HTMLElement | null = null
  private isOpen = false
  private backdrop: HTMLElement | null = null
  private selectedIndex = 0
  private visibleItems: any[] = []
  private onSelect?: (id: string, path?: string, type?: string, isFinal?: boolean) => Promise<void> | void

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

  setSelectHandler(handler: (id: string, path?: string, type?: string, isFinal?: boolean) => Promise<void> | void): void {
    this.onSelect = handler
  }

  toggle(): void {
    if (this.isOpen) this.close()
    else this.open()
  }

  open(): void {
    if (this.isOpen || !this.modal) return
    this.isOpen = true
    this.modal.classList.add('is-open')
    
    // Create backdrop
    this.backdrop = document.createElement('div')
    this.backdrop.style.position = 'fixed'
    this.backdrop.style.inset = '0'
    this.backdrop.style.zIndex = '1999'
    this.container.appendChild(this.backdrop)
    this.backdrop.addEventListener('click', () => this.close())

    // Reset
    if (this.input) {
      this.input.value = ''
      this.input.focus()
    }
    this.filter('')
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
      <div class="fuzzy-input-wrapper">
        <input class="fuzzy-input" placeholder="Type filename to search..." />
      </div>
      <div class="fuzzy-list"></div>
    `
    this.container.appendChild(this.modal)

    this.input = this.modal.querySelector('.fuzzy-input')
    this.list = this.modal.querySelector('.fuzzy-list')

    // Bind input event only (for typing)
    this.input?.addEventListener('input', (e) => this.filter((e.target as HTMLInputElement).value))
    
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
        this.selectedIndex = (this.selectedIndex - 1 + this.visibleItems.length) % this.visibleItems.length
        this.renderList()
        this.scrollToSelected()
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const item = this.visibleItems[this.selectedIndex]
      if (item) {
        await this.onSelect?.(item.id, item.path, item.type, true)
        this.close()
      }
    } else {
        // For other keys, ensure input is focused so user can type
        if (this.input && document.activeElement !== this.input && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="fuzzy-match">$1</span>');
  }

  private filter(query: string): void {
    const term = query.toLowerCase()
    
    // 1. Collect only notes (files)
    const allItems: any[] = []
    
    // Add notes
    state.notes.forEach(n => allItems.push({ ...n, type: 'note' }))
    
    // FOLDERS REMOVED from search results as per request ("only allow files two show up")

    let matches: any[] = []
    
    if (!term) {
        // Show recent 5 notes on empty query
        // Assuming state.notes is already sorted by some criteria, but let's sort by updatedAt if available
        // or just take top 5 if they are sorted by recent.
        // In app.ts, we call sortNotes(state.notes), which likely sorts by A-Z or Update?
        // Let's assume user wants recent. state.notes might be A-Z.
        // We can sort a copy by updatedAt just for this view.
        matches = [...allItems].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5)
    } else {
        matches = allItems.filter(n => {
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

  private query = ''

  private renderList(): void {
    if (!this.list) return
    
    this.list.innerHTML = this.visibleItems.map((item, index) => {
      const isSelected = index === this.selectedIndex ? 'is-selected' : ''
      const icon = item.type === 'folder' ? codicons.folder : codicons.file
      const title = this.highlight(item.title || '', this.query)
      const path = this.highlight(item.path ? item.path.replace(/\\/g, '/') : '', this.query)
    
      return `
        <div class="fuzzy-item ${isSelected}" data-index="${index}">
          <div class="fuzzy-item__main">
            <div class="fuzzy-item__icon">${icon}</div>
            <span class="fuzzy-item__title">${title}</span>
            <span class="fuzzy-item__path">${path}</span>
          </div>
        </div>
      `
    }).join('')
    
    // Click and hover selection
    const items = this.list.querySelectorAll('.fuzzy-item')
    items.forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt((el as HTMLElement).dataset.index!)
        this.selectedIndex = idx
        const item = this.visibleItems[idx]
        this.onSelect?.(item.id, item.path, item.type, true)
        this.close()
      })
      el.addEventListener('mouseover', () => {
        const idx = parseInt((el as HTMLElement).dataset.index!)
        this.selectedIndex = idx
        this.renderList()
      })
    })
  }
}
