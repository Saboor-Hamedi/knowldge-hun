/**
 * Graph Controls Panel
 * UI controls for filtering and customizing the graph view
 */

import { createElement, Search, X, Filter, ZoomIn, ZoomOut, Maximize2, Tag, Folder, Circle, Eye, EyeOff } from 'lucide'

export interface GraphControlsOptions {
  onSearch: (query: string) => void
  onFilterChange: (filters: GraphFilters) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onToggleLabels: (show: boolean) => void
  onForceStrengthChange: (strength: number) => void
}

export interface GraphFilters {
  showOrphans: boolean
  selectedTags: string[]
  selectedFolders: string[]
}

export class GraphControls {
  private container: HTMLElement
  private options: GraphControlsOptions
  private filters: GraphFilters = {
    showOrphans: true,
    selectedTags: [],
    selectedFolders: []
  }
  private showLabels = true
  private availableTags: string[] = []
  private availableFolders: string[] = []
  private searchInput!: HTMLInputElement
  private tagsDropdown!: HTMLElement
  private foldersDropdown!: HTMLElement

  constructor(container: HTMLElement, options: GraphControlsOptions) {
    this.container = container
    this.options = options
    this.render()
  }

  setAvailableTags(tags: string[]): void {
    this.availableTags = tags.sort()
    this.updateTagsDropdown()
  }

  setAvailableFolders(folders: string[]): void {
    this.availableFolders = folders.sort()
    this.updateFoldersDropdown()
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="graph-controls">
        <div class="graph-controls__section graph-controls__search">
          <div class="graph-controls__search-icon"></div>
          <input type="text" class="graph-controls__search-input" placeholder="Search..." />
          <button class="graph-controls__search-clear" title="Clear search">
            ${this.createIcon(X, 10)}
          </button>
        </div>
        
        <div class="graph-controls__divider"></div>
        
        <div class="graph-controls__section graph-controls__filters">
          <div class="graph-controls__filter-group">
            <button class="graph-controls__filter-btn" data-filter="tags" title="Filter by tags">
              ${this.createIcon(Tag, 12)}
              <span>Tags</span>
              <span class="graph-controls__filter-count" data-count="tags">0</span>
            </button>
            <div class="graph-controls__dropdown graph-controls__tags-dropdown"></div>
          </div>
          
          <div class="graph-controls__filter-group">
            <button class="graph-controls__filter-btn" data-filter="folders" title="Filter by folders">
              ${this.createIcon(Folder, 12)}
              <span>Folders</span>
              <span class="graph-controls__filter-count" data-count="folders">0</span>
            </button>
            <div class="graph-controls__dropdown graph-controls__folders-dropdown"></div>
          </div>
          
          <button class="graph-controls__toggle-btn ${this.filters.showOrphans ? 'is-active' : ''}" 
                  data-toggle="orphans" title="Toggle orphan notes">
            ${this.createIcon(Circle, 12)}
            <span>Orphans</span>
          </button>
        </div>
        
        <div class="graph-controls__divider"></div>
        
        <div class="graph-controls__section graph-controls__view">
          <button class="graph-controls__toggle-btn ${this.showLabels ? 'is-active' : ''}" 
                  data-toggle="labels" title="Toggle labels">
            ${this.createIcon(this.showLabels ? Eye : EyeOff, 12)}
            <span>Labels</span>
          </button>
          
          <div class="graph-controls__zoom">
            <button class="graph-controls__zoom-btn" data-zoom="out" title="Zoom out">
              ${this.createIcon(ZoomOut, 12)}
            </button>
            <button class="graph-controls__zoom-btn" data-zoom="reset" title="Reset zoom">
              ${this.createIcon(Maximize2, 12)}
            </button>
            <button class="graph-controls__zoom-btn" data-zoom="in" title="Zoom in">
              ${this.createIcon(ZoomIn, 12)}
            </button>
          </div>
        </div>
        
        <div class="graph-controls__divider"></div>
        
        <div class="graph-controls__section graph-controls__force">
          <label class="graph-controls__slider-label">
            <span>Force</span>
            <input type="range" class="graph-controls__slider" 
                   min="50" max="500" value="300" data-slider="force" />
          </label>
        </div>
      </div>
    `

    // Get references
    this.searchInput = this.container.querySelector('.graph-controls__search-input') as HTMLInputElement
    this.tagsDropdown = this.container.querySelector('.graph-controls__tags-dropdown') as HTMLElement
    this.foldersDropdown = this.container.querySelector('.graph-controls__folders-dropdown') as HTMLElement

    // Add search icon
    const searchIconContainer = this.container.querySelector('.graph-controls__search-icon') as HTMLElement
    searchIconContainer.appendChild(createElement(Search, { size: 12, 'stroke-width': 1.5 }))

    this.attachEvents()
  }

  private createIcon(IconComponent: any, size: number): string {
    const svg = createElement(IconComponent, { size, 'stroke-width': 1.5 })
    return svg?.outerHTML || ''
  }

  private attachEvents(): void {
    // Search
    let searchTimeout: number | null = null
    this.searchInput.addEventListener('input', () => {
      if (searchTimeout) clearTimeout(searchTimeout)
      searchTimeout = window.setTimeout(() => {
        this.options.onSearch(this.searchInput.value.trim())
      }, 200)
    })

    // Clear search
    this.container.querySelector('.graph-controls__search-clear')?.addEventListener('click', () => {
      this.searchInput.value = ''
      this.options.onSearch('')
    })

    // Filter dropdowns
    this.container.querySelectorAll('.graph-controls__filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const filter = (btn as HTMLElement).dataset.filter
        this.toggleDropdown(filter as 'tags' | 'folders')
      })
    })

    // Prevent dropdown close when clicking inside
    this.container.querySelectorAll('.graph-controls__dropdown').forEach(dropdown => {
      dropdown.addEventListener('click', (e) => {
        e.stopPropagation()
      })
    })

    // Toggle buttons
    this.container.querySelectorAll('.graph-controls__toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const toggle = (btn as HTMLElement).dataset.toggle
        if (toggle === 'orphans') {
          this.filters.showOrphans = !this.filters.showOrphans
          btn.classList.toggle('is-active', this.filters.showOrphans)
          this.options.onFilterChange({ ...this.filters })
        } else if (toggle === 'labels') {
          this.showLabels = !this.showLabels
          btn.classList.toggle('is-active', this.showLabels)
          btn.innerHTML = `${this.createIcon(this.showLabels ? Eye : EyeOff, 12)}<span>Labels</span>`
          this.options.onToggleLabels(this.showLabels)
        }
      })
    })

    // Zoom buttons
    this.container.querySelectorAll('.graph-controls__zoom-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const zoom = (btn as HTMLElement).dataset.zoom
        if (zoom === 'in') this.options.onZoomIn()
        else if (zoom === 'out') this.options.onZoomOut()
        else if (zoom === 'reset') this.options.onZoomReset()
      })
    })

    // Force slider
    const forceSlider = this.container.querySelector('[data-slider="force"]') as HTMLInputElement
    forceSlider?.addEventListener('input', () => {
      this.options.onForceStrengthChange(parseInt(forceSlider.value, 10))
    })

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      this.closeAllDropdowns()
    })
  }

  private toggleDropdown(type: 'tags' | 'folders'): void {
    const dropdown = type === 'tags' ? this.tagsDropdown : this.foldersDropdown
    const isOpen = dropdown.classList.contains('is-open')
    
    this.closeAllDropdowns()
    
    if (!isOpen) {
      dropdown.classList.add('is-open')
    }
  }

  private closeAllDropdowns(): void {
    this.tagsDropdown?.classList.remove('is-open')
    this.foldersDropdown?.classList.remove('is-open')
  }

  private updateTagsDropdown(): void {
    if (!this.tagsDropdown) return

    if (this.availableTags.length === 0) {
      this.tagsDropdown.innerHTML = '<div class="graph-controls__dropdown-empty">No tags found</div>'
      return
    }

    this.tagsDropdown.innerHTML = `
      <div class="graph-controls__dropdown-header">
        <span>Filter by Tags</span>
        <button class="graph-controls__dropdown-clear">Clear</button>
      </div>
      <div class="graph-controls__dropdown-list">
        ${this.availableTags.map(tag => `
          <label class="graph-controls__dropdown-item">
            <input type="checkbox" value="${tag}" ${this.filters.selectedTags.includes(tag) ? 'checked' : ''} />
            <span>#${tag}</span>
          </label>
        `).join('')}
      </div>
    `

    // Attach events
    this.tagsDropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation()
        const tag = (checkbox as HTMLInputElement).value
        if ((checkbox as HTMLInputElement).checked) {
          if (!this.filters.selectedTags.includes(tag)) {
            this.filters.selectedTags.push(tag)
          }
        } else {
          this.filters.selectedTags = this.filters.selectedTags.filter(t => t !== tag)
        }
        this.updateFilterCount('tags', this.filters.selectedTags.length)
        this.options.onFilterChange({ ...this.filters })
      })
    })

    this.tagsDropdown.querySelector('.graph-controls__dropdown-clear')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.filters.selectedTags = []
      this.updateTagsDropdown()
      this.updateFilterCount('tags', 0)
      this.options.onFilterChange({ ...this.filters })
    })
  }

  private updateFoldersDropdown(): void {
    if (!this.foldersDropdown) return

    if (this.availableFolders.length === 0) {
      this.foldersDropdown.innerHTML = '<div class="graph-controls__dropdown-empty">No folders found</div>'
      return
    }

    this.foldersDropdown.innerHTML = `
      <div class="graph-controls__dropdown-header">
        <span>Filter by Folders</span>
        <button class="graph-controls__dropdown-clear">Clear</button>
      </div>
      <div class="graph-controls__dropdown-list">
        ${this.availableFolders.map(folder => `
          <label class="graph-controls__dropdown-item">
            <input type="checkbox" value="${folder}" ${this.filters.selectedFolders.includes(folder) ? 'checked' : ''} />
            <span>${folder === 'root' ? '/ (root)' : folder}</span>
          </label>
        `).join('')}
      </div>
    `

    // Attach events
    this.foldersDropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation()
        const folder = (checkbox as HTMLInputElement).value
        if ((checkbox as HTMLInputElement).checked) {
          if (!this.filters.selectedFolders.includes(folder)) {
            this.filters.selectedFolders.push(folder)
          }
        } else {
          this.filters.selectedFolders = this.filters.selectedFolders.filter(f => f !== folder)
        }
        this.updateFilterCount('folders', this.filters.selectedFolders.length)
        this.options.onFilterChange({ ...this.filters })
      })
    })

    this.foldersDropdown.querySelector('.graph-controls__dropdown-clear')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.filters.selectedFolders = []
      this.updateFoldersDropdown()
      this.updateFilterCount('folders', 0)
      this.options.onFilterChange({ ...this.filters })
    })
  }

  private updateFilterCount(type: 'tags' | 'folders', count: number): void {
    const countEl = this.container.querySelector(`[data-count="${type}"]`)
    if (countEl) {
      countEl.textContent = String(count)
      countEl.classList.toggle('has-count', count > 0)
    }
  }

  focusSearch(): void {
    this.searchInput?.focus()
  }
}
