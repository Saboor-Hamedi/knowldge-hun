/**
 * Graph Controls Panel
 * UI controls for filtering and customizing the graph view
 */

import {
  createElement,
  Search,
  X,
  Tag,
  Folder,
  Circle,
  Eye,
  EyeOff,
  Download,
  Focus,
  Route,
  Palette
} from 'lucide'

export interface GraphControlsOptions {
  onSearch: (query: string) => void
  onFilterChange: (filters: GraphFilters) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onToggleLabels: (show: boolean) => void
  onForceStrengthChange: (strength: number) => void
  onDepthChange: (depth: number) => void
  onToggleLocalGraph: (enabled: boolean) => void
  onExport: (format: 'svg' | 'png') => void
  onStartPathFind: () => void
  onThemeChange: (theme: string) => void
  onDropdownOpen?: () => void
}

export interface GraphFilters {
  showOrphans: boolean
  selectedTags: string[]
  selectedFolders: string[]
  localGraphEnabled: boolean
  localGraphDepth: number
}

export class GraphControls {
  private container: HTMLElement
  private options: GraphControlsOptions
  private filters: GraphFilters = {
    showOrphans: true,
    selectedTags: [],
    selectedFolders: [],
    localGraphEnabled: false,
    localGraphDepth: 2
  }
  private showLabels = true
  private availableTags: string[] = []
  private availableFolders: string[] = []
  private searchInput!: HTMLInputElement
  private tagsDropdown!: HTMLElement
  private foldersDropdown!: HTMLElement
  private depthSlider!: HTMLInputElement

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
              ${this.createIcon(Tag, 11)}
              <span>Tags</span>
              <span class="graph-controls__filter-count" data-count="tags">0</span>
            </button>
            <div class="graph-controls__dropdown graph-controls__tags-dropdown"></div>
          </div>
          
          <div class="graph-controls__filter-group">
            <button class="graph-controls__filter-btn" data-filter="folders" title="Filter by folders">
              ${this.createIcon(Folder, 11)}
              <span>Folders</span>
              <span class="graph-controls__filter-count" data-count="folders">0</span>
            </button>
            <div class="graph-controls__dropdown graph-controls__folders-dropdown"></div>
          </div>
          
          <button class="graph-controls__toggle-btn ${this.filters.showOrphans ? 'is-active' : ''}" 
                  data-toggle="orphans" title="Toggle orphan notes">
            ${this.createIcon(Circle, 11)}
            <span>Orphans</span>
          </button>
        </div>
        
        <div class="graph-controls__divider"></div>
        
        <div class="graph-controls__section graph-controls__local">
          <button class="graph-controls__toggle-btn ${this.filters.localGraphEnabled ? 'is-active' : ''}" 
                  data-toggle="local" title="Show local graph around active note">
            ${this.createIcon(Focus, 11)}
            <span>Local</span>
          </button>
          
          <label class="graph-controls__slider-label graph-controls__depth-label" style="display: ${this.filters.localGraphEnabled ? 'flex' : 'none'}">
            <span>Depth</span>
            <input type="range" class="graph-controls__slider graph-controls__depth-slider" 
                   min="1" max="5" value="${this.filters.localGraphDepth}" data-slider="depth" />
            <span class="graph-controls__depth-value">${this.filters.localGraphDepth}</span>
          </label>
        </div>
        
        <div class="graph-controls__divider"></div>
        
        <div class="graph-controls__section graph-controls__tools">
          <button class="graph-controls__tool-btn" data-tool="pathfind" title="Find path between two notes">
            ${this.createIcon(Route, 11)}
          </button>
          
          <div class="graph-controls__filter-group">
            <button class="graph-controls__tool-btn" data-tool="export" title="Export graph">
              ${this.createIcon(Download, 11)}
            </button>
            <div class="graph-controls__dropdown graph-controls__export-dropdown">
              <div class="graph-controls__dropdown-list">
                <button class="graph-controls__dropdown-item" data-export="svg">Vector (Scalable)</button>
                <button class="graph-controls__dropdown-item" data-export="png">Image (High-Res)</button>
              </div>
            </div>
          </div>

          <div class="graph-controls__filter-group">
            <button class="graph-controls__tool-btn" data-tool="themes" title="Select Theme">
              ${this.createIcon(Palette, 11)}
            </button>
            <div class="graph-controls__dropdown graph-controls__themes-dropdown">
              <div class="graph-controls__dropdown-list">
                <button class="graph-controls__dropdown-item" data-theme="default">Default</button>
                <button class="graph-controls__dropdown-item" data-theme="spatial">Spatial</button>
                <button class="graph-controls__dropdown-item" data-theme="ocean">Ocean</button>
                <button class="graph-controls__dropdown-item" data-theme="grid">Grid</button>
                <button class="graph-controls__dropdown-item" data-theme="moon">Moonlight</button>
                <button class="graph-controls__dropdown-item" data-theme="hologram">Hologram</button>
                <button class="graph-controls__dropdown-item" data-theme="nexus">Nexus</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="graph-controls__divider"></div>
        
        <div class="graph-controls__section graph-controls__view">
          <button class="graph-controls__toggle-btn ${this.showLabels ? 'is-active' : ''}" 
                  data-toggle="labels" title="Toggle labels">
            ${this.createIcon(this.showLabels ? Eye : EyeOff, 11)}
            <span>Labels</span>
          </button>
        </div>
        
        <div class="graph-controls__divider"></div>
        
        <div class="graph-controls__section graph-controls__force">
          <label class="graph-controls__slider-label">
            <span>Graph Force</span>
            <input type="range" class="graph-controls__slider" 
                   min="50" max="500" value="300" data-slider="force" />
          </label>
        </div>
      </div>
    `

    // Get references
    this.searchInput = this.container.querySelector(
      '.graph-controls__search-input'
    ) as HTMLInputElement
    this.tagsDropdown = this.container.querySelector(
      '.graph-controls__tags-dropdown'
    ) as HTMLElement
    this.foldersDropdown = this.container.querySelector(
      '.graph-controls__folders-dropdown'
    ) as HTMLElement
    this.depthSlider = this.container.querySelector(
      '.graph-controls__depth-slider'
    ) as HTMLInputElement

    // Add search icon
    const searchIconContainer = this.container.querySelector(
      '.graph-controls__search-icon'
    ) as HTMLElement
    searchIconContainer.appendChild(createElement(Search, { size: 11, 'stroke-width': 1.5 }))

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
    this.container.querySelectorAll('.graph-controls__filter-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const filter = (btn as HTMLElement).dataset.filter
        this.toggleDropdown(filter as 'tags' | 'folders' | 'export')
      })
    })

    // Tool buttons with dropdowns
    this.container.querySelectorAll('.graph-controls__tool-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const tool = (btn as HTMLElement).dataset.tool
        if (tool === 'export') {
          this.toggleDropdown('export')
        } else if (tool === 'themes') {
          this.toggleDropdown('themes')
        } else if (tool === 'tags') {
          this.toggleDropdown('tags')
        } else if (tool === 'folders') {
          this.toggleDropdown('folders')
        } else if (tool === 'pathfind') {
          this.closeAllDropdowns()
          this.options.onStartPathFind()
        } else if (tool === 'theme-cycle') {
          const themes = ['default', 'spatial', 'ocean', 'grid', 'moon', 'hologram', 'nexus']
          const currentTheme = document.body.getAttribute('data-graph-theme') || 'default'
          const nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length
          const nextTheme = themes[nextIndex]

          document.body.setAttribute('data-graph-theme', nextTheme) // Store state
          this.options.onThemeChange(nextTheme)
        }
      })
    })

    // Theme select buttons
    this.container.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const theme = (btn as HTMLElement).dataset.theme as string
        this.options.onThemeChange(theme)
      })
    })

    // Export buttons
    this.container.querySelectorAll('[data-export]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const format = (btn as HTMLElement).dataset.export as 'svg' | 'png'
        this.options.onExport(format)
        this.closeAllDropdowns()
      })
    })

    // Prevent dropdown close when clicking inside
    this.container.querySelectorAll('.graph-controls__dropdown').forEach((dropdown) => {
      dropdown.addEventListener('click', (e) => {
        e.stopPropagation()
      })
    })

    // Toggle buttons
    this.container.querySelectorAll('.graph-controls__toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const toggle = (btn as HTMLElement).dataset.toggle
        if (toggle === 'orphans') {
          this.filters.showOrphans = !this.filters.showOrphans
          btn.classList.toggle('is-active', this.filters.showOrphans)
          this.options.onFilterChange({ ...this.filters })
        } else if (toggle === 'labels') {
          this.showLabels = !this.showLabels
          btn.classList.toggle('is-active', this.showLabels)
          btn.innerHTML = `${this.createIcon(this.showLabels ? Eye : EyeOff, 11)}<span>Labels</span>`
          this.options.onToggleLabels(this.showLabels)
        } else if (toggle === 'local') {
          this.filters.localGraphEnabled = !this.filters.localGraphEnabled
          btn.classList.toggle('is-active', this.filters.localGraphEnabled)
          // Show/hide depth slider
          const depthLabel = this.container.querySelector(
            '.graph-controls__depth-label'
          ) as HTMLElement
          if (depthLabel) {
            depthLabel.style.display = this.filters.localGraphEnabled ? 'flex' : 'none'
          }
          this.options.onToggleLocalGraph(this.filters.localGraphEnabled)
          this.options.onFilterChange({ ...this.filters })
        }
      })
    })

    // Zoom buttons
    this.container.querySelectorAll('.graph-controls__zoom-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const zoom = (btn as HTMLElement).dataset.zoom
        if (zoom === 'in') this.options.onZoomIn()
        else if (zoom === 'out') this.options.onZoomOut()
        else if (zoom === 'reset') this.options.onZoomReset()
      })
    })

    // Force slider
    const forceSlider = this.container.querySelector('[data-slider="force"]') as HTMLInputElement
    const debouncedForce = this.debounce(
      (val: number) => this.options.onForceStrengthChange(val),
      50
    )
    forceSlider?.addEventListener('input', () => {
      debouncedForce(parseInt(forceSlider.value, 10))
    })

    // Depth slider
    const debouncedDepth = this.debounce((val: number) => this.options.onDepthChange(val), 50)
    this.depthSlider?.addEventListener('input', () => {
      const depth = parseInt(this.depthSlider.value, 10)
      this.filters.localGraphDepth = depth
      const depthValue = this.container.querySelector('.graph-controls__depth-value')
      if (depthValue) depthValue.textContent = String(depth)
      debouncedDepth(depth)
    })

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      this.closeAllDropdowns()
    })

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllDropdowns()
      }
    })
  }

  private toggleDropdown(type: 'tags' | 'folders' | 'export' | 'themes'): void {
    let dropdown: HTMLElement | null = null
    let btn: HTMLElement | null = null

    if (type === 'tags') {
      dropdown = this.tagsDropdown
      btn = this.container.querySelector('[data-filter="tags"]')
    } else if (type === 'folders') {
      dropdown = this.foldersDropdown
      btn = this.container.querySelector('[data-filter="folders"]')
    } else if (type === 'export') {
      dropdown = this.container.querySelector('.graph-controls__export-dropdown')
      btn = this.container.querySelector('[data-tool="export"]')
    } else if (type === 'themes') {
      dropdown = this.container.querySelector('.graph-controls__themes-dropdown')
      btn = this.container.querySelector('[data-tool="themes"]')
    }

    if (!dropdown || !btn) return

    const isOpen = dropdown.classList.contains('is-open')

    // Always close all first to ensure mutual exclusion
    this.closeAllDropdowns()

    // 2. If it was already open, then it's now closed (by step 1)
    if (isOpen) return

    // 3. Open and position correctly
    this.options.onDropdownOpen?.()
    dropdown.classList.add('is-open')
    btn.classList.add('is-active')

    const rect = btn.getBoundingClientRect()
    // Calculate relative to offsetParent to handle transforms (modal)
    const parentRect = dropdown.offsetParent?.getBoundingClientRect() || { top: 0, left: 0 }

    dropdown.style.top = `${Math.round(rect.bottom - parentRect.top + 6)}px`

    // Smart Directional Alignment:
    // Tools (on the right) should be right-aligned to their buttons.
    // Filters (on the left) should be left-aligned to their buttons.
    const isTool = type === 'export' || type === 'themes'
    const dropdownWidth = dropdown.offsetWidth || (type === 'themes' ? 140 : 160)

    let viewportLeft = 0
    if (isTool) {
      // Right-align tool dropdowns
      viewportLeft = rect.right - dropdownWidth
    } else {
      // Left-align filter dropdowns
      viewportLeft = rect.left
    }

    // Viewport safety checks
    if (viewportLeft + dropdownWidth > window.innerWidth - 10) {
      viewportLeft = window.innerWidth - dropdownWidth - 10
    }
    if (viewportLeft < 10) viewportLeft = 10

    // Convert to relative position
    dropdown.style.left = `${Math.round(viewportLeft - parentRect.left)}px`
  }

  public setPathFindMode(active: boolean): void {
    const btn = this.container.querySelector('[data-tool="pathfind"]')
    if (btn) {
      btn.classList.toggle('is-active', active)
    }
  }

  private debounce(fn: (...args: any[]) => void, delay: number): (...args: any[]) => void {
    let timeoutId: number | null = null
    return (...args: any[]) => {
      if (timeoutId) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => fn(...args), delay)
    }
  }

  private closeAllDropdowns(): void {
    const dropdowns = this.container.querySelectorAll('.graph-controls__dropdown')
    dropdowns.forEach((d) => {
      d.classList.remove('is-open')
      // Reset position to avoid flash next time
      const de = d as HTMLElement
      de.style.top = '0'
      de.style.left = '0'
    })

    // Remove highlight from buttons that aren't persistent toggles
    this.container
      .querySelectorAll('.graph-controls__filter-btn, .graph-controls__tool-btn')
      .forEach((btn) => {
        const b = btn as HTMLElement
        // Only remove if it's not the pathfind button (handled by state)
        if (b.dataset.tool !== 'pathfind') {
          b.classList.remove('is-active')
        }
      })
  }

  private updateTagsDropdown(): void {
    if (!this.tagsDropdown) return

    if (this.availableTags.length === 0) {
      this.tagsDropdown.innerHTML =
        '<div class="graph-controls__dropdown-empty">No tags found</div>'
      return
    }

    this.tagsDropdown.innerHTML = `
      <div class="graph-controls__dropdown-header">
        <span>Filter by Tags</span>
        <button class="graph-controls__dropdown-clear">Clear</button>
      </div>
      <div class="graph-controls__dropdown-list">
        ${this.availableTags
          .map(
            (tag) => `
          <label class="graph-controls__dropdown-item">
            <input type="checkbox" value="${tag}" ${this.filters.selectedTags.includes(tag) ? 'checked' : ''} />
            <span>#${tag}</span>
          </label>
        `
          )
          .join('')}
      </div>
    `

    // Attach events
    this.tagsDropdown.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation()
        const tag = (checkbox as HTMLInputElement).value
        if ((checkbox as HTMLInputElement).checked) {
          if (!this.filters.selectedTags.includes(tag)) {
            this.filters.selectedTags.push(tag)
          }
        } else {
          this.filters.selectedTags = this.filters.selectedTags.filter((t) => t !== tag)
        }
        this.updateFilterCount('tags', this.filters.selectedTags.length)
        this.options.onFilterChange({ ...this.filters })
      })
    })

    this.tagsDropdown
      .querySelector('.graph-controls__dropdown-clear')
      ?.addEventListener('click', (e) => {
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
      this.foldersDropdown.innerHTML =
        '<div class="graph-controls__dropdown-empty">No folders found</div>'
      return
    }

    this.foldersDropdown.innerHTML = `
      <div class="graph-controls__dropdown-header">
        <span>Filter by Folders</span>
        <button class="graph-controls__dropdown-clear">Clear</button>
      </div>
      <div class="graph-controls__dropdown-list">
        ${this.availableFolders
          .map(
            (folder) => `
          <label class="graph-controls__dropdown-item">
            <input type="checkbox" value="${folder}" ${this.filters.selectedFolders.includes(folder) ? 'checked' : ''} />
            <span>${folder === 'root' ? '/ (root)' : folder}</span>
          </label>
        `
          )
          .join('')}
      </div>
    `

    // Attach events
    this.foldersDropdown.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation()
        const folder = (checkbox as HTMLInputElement).value
        if ((checkbox as HTMLInputElement).checked) {
          if (!this.filters.selectedFolders.includes(folder)) {
            this.filters.selectedFolders.push(folder)
          }
        } else {
          this.filters.selectedFolders = this.filters.selectedFolders.filter((f) => f !== folder)
        }
        this.updateFilterCount('folders', this.filters.selectedFolders.length)
        this.options.onFilterChange({ ...this.filters })
      })
    })

    this.foldersDropdown
      .querySelector('.graph-controls__dropdown-clear')
      ?.addEventListener('click', (e) => {
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
