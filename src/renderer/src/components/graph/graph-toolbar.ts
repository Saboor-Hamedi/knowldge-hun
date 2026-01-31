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
  Palette,
  ZoomIn,
  ZoomOut,
  Maximize2,
  BarChart2
} from 'lucide'

type IconComponent = typeof Search

export interface GraphToolbarOptions {
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
  onThemeChange: (theme: string) => void
  onClearGraph?: () => void
  onDropdownOpen?: () => void
  isModal: boolean
}

export interface GraphFilters {
  searchQuery: string
  showOrphans: boolean
  selectedTags: string[]
  selectedFolders: string[]
  localGraphEnabled: boolean
  localGraphDepth: number
}

export class GraphToolbar {
  private container: HTMLElement
  private options: GraphToolbarOptions
  private filters: GraphFilters = {
    searchQuery: '',
    showOrphans: true,
    selectedTags: [],
    selectedFolders: [],
    localGraphEnabled: false,
    localGraphDepth: 2
  }
  private showLabels = true
  private availableTags: string[] = []
  private availableFolders: string[] = []
  private activeTheme = 'default'

  private searchInput!: HTMLInputElement
  private tagsDropdown!: HTMLElement
  private foldersDropdown!: HTMLElement
  private statsDropdown!: HTMLElement
  private depthSlider!: HTMLInputElement
  private forceSlider!: HTMLInputElement

  constructor(container: HTMLElement, options: GraphToolbarOptions) {
    this.container = container
    this.options = options
    this.render()
  }

  public setAvailableTags(tags: string[]): void {
    this.availableTags = tags.sort()
    this.updateTagsDropdown()
  }

  public setAvailableFolders(folders: string[]): void {
    this.availableFolders = folders.sort()
    this.updateFoldersDropdown()
  }

  public setActiveTheme(theme: string): void {
    this.activeTheme = theme
    this.updateThemesDropdown()
  }

  public setStats(nodes: number, links: number, orphans: number = 0): void {
    if (this.statsDropdown) {
      this.statsDropdown.innerHTML = `
        <div class="graph-toolbar__dropdown-header">Graph Insights</div>
        <div class="graph-toolbar__dropdown-list">
          <div class="graph-toolbar__dropdown-item-info">
            <span class="graph-toolbar__stat-label">Total Nodes</span>
            <span class="graph-toolbar__stat-value">${nodes}</span>
          </div>
          <div class="graph-toolbar__dropdown-item-info">
            <span class="graph-toolbar__stat-label">Connections</span>
            <span class="graph-toolbar__stat-value">${links}</span>
          </div>
          <div class="graph-toolbar__dropdown-item-info">
            <span class="graph-toolbar__stat-label">Orphan Notes</span>
            <span class="graph-toolbar__stat-value">${orphans}</span>
          </div>
        </div>
      `
    }
  }

  public getCurrentSearchQuery(): string {
    return this.searchInput.value.trim()
  }

  public getShowOrphans(): boolean {
    return this.filters.showOrphans
  }

  public getSelectedTags(): string[] {
    return this.filters.selectedTags
  }

  public getSelectedFolders(): string[] {
    return this.filters.selectedFolders
  }

  private render(): void {
    this.container.classList.add('graph-toolbar-container')
    this.container.innerHTML = `
      <div class="graph-toolbar">
        <!-- left section: Search & Filters -->
        <div class="graph-toolbar__group">
          <div class="graph-toolbar__search">
            <div class="graph-toolbar__search-icon">${this.createIcon(Search, 11)}</div>
            <input type="text" class="graph-toolbar__search-input" placeholder="Search notes..." />
            <button class="graph-toolbar__search-clear" title="Clear search">
              ${this.createIcon(X, 11)}
            </button>
          </div>

          <div class="graph-toolbar__divider"></div>

          <button class="graph-toolbar__btn" data-action="zoom-in" title="Zoom In">
            ${this.createIcon(ZoomIn, 13)}
          </button>
          <button class="graph-toolbar__btn" data-action="zoom-out" title="Zoom Out">
            ${this.createIcon(ZoomOut, 13)}
          </button>
          <button class="graph-toolbar__btn" data-action="zoom-reset" title="Reset View">
            ${this.createIcon(Maximize2, 13)}
          </button>

          <div class="graph-toolbar__divider"></div>

          <div class="graph-toolbar__filter-group">
            <button class="graph-toolbar__btn" data-filter="tags" title="Filter by tags">
              ${this.createIcon(Tag, 13)}
              <span>Tags</span>
              <span class="graph-toolbar__badge" data-count="tags">0</span>
            </button>
            <div class="graph-toolbar__dropdown graph-toolbar__tags-dropdown"></div>
          </div>

          <div class="graph-toolbar__filter-group">
            <button class="graph-toolbar__btn" data-filter="folders" title="Filter by folders">
              ${this.createIcon(Folder, 13)}
              <span>Folders</span>
              <span class="graph-toolbar__badge" data-count="folders">0</span>
            </button>
            <div class="graph-toolbar__dropdown graph-toolbar__folders-dropdown"></div>
          </div>
          
          <button class="graph-toolbar__btn ${this.filters.showOrphans ? 'is-active' : ''}" 
                  data-toggle="orphans" title="Toggle orphan notes">
            ${this.createIcon(Circle, 13)}
            <span>Orphans</span>
          </button>
        </div>

        <!-- Center section: Stats -->
        <div class="graph-toolbar__filter-group graph-toolbar__stats-group">
          <button class="graph-toolbar__btn" data-tool="stats" title="Graph Statistics">
            ${this.createIcon(BarChart2, 13)}
            <span>Stats</span>
          </button>
          <div class="graph-toolbar__dropdown graph-toolbar__stats-dropdown"></div>
        </div>

        <!-- Right section: Tools & Simulation -->
        <div class="graph-toolbar__group">
          <div class="graph-toolbar__divider"></div>
          
          <div class="graph-toolbar__filter-group">
            <button class="graph-toolbar__btn ${this.filters.localGraphEnabled ? 'is-active' : ''}" 
                    data-toggle="local" title="Focus local graph">
              ${this.createIcon(Focus, 13)}
              <span>Local</span>
            </button>
            <div class="graph-toolbar__dropdown graph-toolbar__local-dropdown">
               <div class="graph-toolbar__dropdown-header">Local Graph Settings</div>
               <div class="graph-toolbar__dropdown-list">
                  <div class="graph-toolbar__dropdown-item-row">
                    <span>Depth</span>
                    <input type="range" class="graph-toolbar__slider graph-toolbar__depth-slider" 
                           min="1" max="5" value="${this.filters.localGraphDepth}" />
                    <span class="graph-toolbar__depth-value">${this.filters.localGraphDepth}</span>
                  </div>
               </div>
            </div>
          </div>


          <div class="graph-toolbar__divider"></div>

          <div class="graph-toolbar__filter-group">
            <button class="graph-toolbar__btn" data-tool="themes" title="Graph Themes">
              ${this.createIcon(Palette, 13)}
            </button>
            <div class="graph-toolbar__dropdown graph-toolbar__themes-dropdown"></div>
          </div>

          <div class="graph-toolbar__filter-group">
            <button class="graph-toolbar__btn" data-tool="export" title="Export Graph">
              ${this.createIcon(Download, 13)}
            </button>
            <div class="graph-toolbar__dropdown graph-toolbar__export-dropdown">
              <div class="graph-toolbar__dropdown-header">Export As</div>
              <div class="graph-toolbar__dropdown-list">
                <button class="graph-toolbar__dropdown-item" data-export="svg">SVG (Vector)</button>
                <button class="graph-toolbar__dropdown-item" data-export="png">PNG (High Res)</button>
              </div>
            </div>
          </div>

          <div class="graph-toolbar__divider"></div>

          <button class="graph-toolbar__btn ${this.showLabels ? 'is-active' : ''}" 
                  data-toggle="labels" title="Toggle node labels">
            ${this.createIcon(this.showLabels ? Eye : EyeOff, 13)}
          </button>

          <div class="graph-toolbar__divider"></div>

          <div class="graph-toolbar__force-control">
            <span>Force</span>
            <input type="range" class="graph-toolbar__slider" 
                   min="50" max="800" value="300" data-slider="force" />
          </div>
        </div>
      </div>
    `

    this.initReferences()
    this.updateThemesDropdown()
    this.attachEvents()
  }

  private initReferences(): void {
    const root = this.container
    this.searchInput = root.querySelector('.graph-toolbar__search-input') as HTMLInputElement
    this.tagsDropdown = root.querySelector('.graph-toolbar__tags-dropdown') as HTMLElement
    this.foldersDropdown = root.querySelector('.graph-toolbar__folders-dropdown') as HTMLElement
    this.statsDropdown = root.querySelector('.graph-toolbar__stats-dropdown') as HTMLElement
    this.forceSlider = root.querySelector('[data-slider="force"]') as HTMLInputElement
    this.depthSlider = root.querySelector('.graph-toolbar__depth-slider') as HTMLInputElement
  }

  private createIcon(Icon: IconComponent, size: number): string {
    const svg = createElement(Icon, { size, 'stroke-width': 1.6 })
    return svg?.outerHTML || ''
  }

  private attachEvents(): void {
    // Search logic with debounce
    let searchTimeout: ReturnType<typeof setTimeout>
    this.searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => {
        this.filters.searchQuery = this.searchInput.value.trim()
        this.options.onSearch(this.filters.searchQuery)
      }, 300)
    })

    this.container.querySelector('.graph-toolbar__search-clear')?.addEventListener('click', () => {
      this.searchInput.value = ''
      this.filters.searchQuery = ''
      this.options.onSearch('')
    })

    // Zoom and other actions
    this.container.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = (btn as HTMLElement).dataset.action
        if (action === 'zoom-in') this.options.onZoomIn()
        else if (action === 'zoom-out') this.options.onZoomOut()
        else if (action === 'zoom-reset') this.options.onZoomReset()
      })
    })

    // Toggle Dropdowns
    const dropdownBtns = this.container.querySelectorAll(
      '[data-filter], [data-tool="themes"], [data-tool="export"], [data-toggle="local"], [data-tool="stats"]'
    )
    dropdownBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const b = btn as HTMLElement
        const target = (b.dataset.filter ||
          b.dataset.tool ||
          (b.dataset.toggle === 'local' ? 'local' : null)) as
          | 'tags'
          | 'folders'
          | 'themes'
          | 'export'
          | 'local'
          | 'stats'
          | null
        if (target) this.toggleDropdown(target)

        // If it's the local graph toggle, handle the actual toggle logic too
        if (b.dataset.toggle === 'local') {
          this.filters.localGraphEnabled = !this.filters.localGraphEnabled
          btn.classList.toggle('is-active', this.filters.localGraphEnabled)
          this.options.onToggleLocalGraph(this.filters.localGraphEnabled)
          this.options.onFilterChange({ ...this.filters })
        }
      })
    })

    // Toggles (Orphans, Local, Labels)
    this.container.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const toggle = (btn as HTMLElement).dataset.toggle
        if (toggle === 'orphans') {
          this.filters.showOrphans = !this.filters.showOrphans
          btn.classList.toggle('is-active', this.filters.showOrphans)
          this.options.onFilterChange({ ...this.filters })
        } else if (toggle === 'labels') {
          this.showLabels = !this.showLabels
          btn.classList.toggle('is-active', this.showLabels)
          btn.innerHTML = this.createIcon(this.showLabels ? Eye : EyeOff, 12)
          this.options.onToggleLabels(this.showLabels)
        }
      })
    })

    // Theme Selection (handled via delegated listener on dropdown update)

    // Export Selection
    this.container.querySelectorAll('[data-export]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const format = (btn as HTMLElement).dataset.export as 'svg' | 'png'
        this.options.onExport(format)
        this.closeAllDropdowns()
      })
    })

    // Force Slider
    this.forceSlider.addEventListener('input', () => {
      this.options.onForceStrengthChange(parseInt(this.forceSlider.value))
    })

    // Depth Slider
    this.depthSlider.addEventListener('input', () => {
      const depth = parseInt(this.depthSlider.value)
      this.filters.localGraphDepth = depth
      const valDisplay = this.container.querySelector('.graph-toolbar__depth-value')
      if (valDisplay) valDisplay.textContent = depth.toString()
      this.options.onDepthChange(depth)
    })

    // Global click to close dropdowns
    const handleGlobalClick = (): void => this.closeAllDropdowns()
    document.addEventListener('click', handleGlobalClick)

    // Escape to close dropdowns
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        const anyOpen = !!this.container.querySelector('.graph-toolbar__dropdown.is-open')
        if (anyOpen) {
          e.stopPropagation()
          this.closeAllDropdowns()
        }
      }
    }
    document.addEventListener('keydown', handleEsc)

    this.container.addEventListener('click', (e) => e.stopPropagation())
  }

  private toggleDropdown(type: 'tags' | 'folders' | 'themes' | 'export' | 'local' | 'stats'): void {
    const dropdowns = {
      tags: this.tagsDropdown,
      folders: this.foldersDropdown,
      themes: this.container.querySelector('.graph-toolbar__themes-dropdown') as HTMLElement,
      export: this.container.querySelector('.graph-toolbar__export-dropdown') as HTMLElement,
      local: this.container.querySelector('.graph-toolbar__local-dropdown') as HTMLElement,
      stats: this.statsDropdown
    }

    const dropdown = dropdowns[type]
    if (!dropdown) return

    const wasOpen = dropdown.classList.contains('is-open')
    this.closeAllDropdowns()

    if (!wasOpen) {
      this.options.onDropdownOpen?.()
      dropdown.classList.add('is-open')
      this.container.classList.add('is-dropdown-open')
      const btn = this.container.querySelector(
        `[data-filter="${type}"], [data-tool="${type}"], [data-toggle="${type}"]`
      )
      btn?.classList.add('is-active-dropdown')
    }
  }

  private closeAllDropdowns(): void {
    this.container.classList.remove('is-dropdown-open')
    this.container
      .querySelectorAll('.graph-toolbar__dropdown')
      .forEach((d) => d.classList.remove('is-open'))
    this.container
      .querySelectorAll('.graph-toolbar__btn')
      .forEach((b) => b.classList.remove('is-active-dropdown'))
  }

  private updateTagsDropdown(): void {
    if (!this.tagsDropdown) return
    this.tagsDropdown.innerHTML = `
      <div class="graph-toolbar__dropdown-header">Filter by Tags</div>
      <div class="graph-toolbar__dropdown-list">
        ${this.availableTags
          .map(
            (tag) => `
          <label class="graph-toolbar__dropdown-item">
            <input type="checkbox" value="${tag}" ${this.filters.selectedTags.includes(tag) ? 'checked' : ''} />
            <span>#${tag}</span>
          </label>
        `
          )
          .join('')}
      </div>
    `
    this.attachDropdownListeners(this.tagsDropdown, 'selectedTags')
  }

  private updateFoldersDropdown(): void {
    if (!this.foldersDropdown) return
    this.foldersDropdown.innerHTML = `
      <div class="graph-toolbar__dropdown-header">Filter by Folders</div>
      <div class="graph-toolbar__dropdown-list">
        ${this.availableFolders
          .map(
            (folder) => `
          <label class="graph-toolbar__dropdown-item">
            <input type="checkbox" value="${folder}" ${this.filters.selectedFolders.includes(folder) ? 'checked' : ''} />
            <span>${folder === 'root' ? '/ (root)' : folder}</span>
          </label>
        `
          )
          .join('')}
      </div>
    `
    this.attachDropdownListeners(this.foldersDropdown, 'selectedFolders')
  }

  private updateThemesDropdown(): void {
    const dropdown = this.container.querySelector('.graph-toolbar__themes-dropdown') as HTMLElement
    if (!dropdown) return

    const themes = [
      { id: 'default', label: 'Default' },
      { id: 'spatial', label: 'Spatial' },
      { id: 'ocean', label: 'Ocean' },
      { id: 'grid', label: 'Grid' },
      { id: 'moon', label: 'Moonlight' },
      { id: 'hologram', label: 'Hologram' },
      { id: 'nexus', label: 'Nexus' }
    ]

    dropdown.innerHTML = `
      <div class="graph-toolbar__dropdown-header">Select Theme</div>
      <div class="graph-toolbar__dropdown-list">
        ${themes
          .map(
            (t) => `
          <button class="graph-toolbar__dropdown-item ${t.id === this.activeTheme ? 'is-selected' : ''}" 
                  data-theme="${t.id}">
            ${t.label}
          </button>
        `
          )
          .join('')}
      </div>
    `

    // Re-attach listeners
    dropdown.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const theme = (btn as HTMLElement).dataset.theme!
        this.activeTheme = theme
        this.options.onThemeChange(theme)
        this.updateThemesDropdown() // Refresh UI for selected mark
        this.closeAllDropdowns()
      })
    })
  }

  private attachDropdownListeners(
    dropdown: HTMLElement,
    filterKey: 'selectedTags' | 'selectedFolders'
  ): void {
    dropdown.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        const val = input.value
        if (input.checked) {
          if (!this.filters[filterKey].includes(val)) this.filters[filterKey].push(val)
        } else {
          this.filters[filterKey] = this.filters[filterKey].filter((x) => x !== val)
        }

        const type = filterKey === 'selectedTags' ? 'tags' : 'folders'
        const badge = this.container.querySelector(`[data-count="${type}"]`) as HTMLElement
        if (badge) {
          badge.textContent = this.filters[filterKey].length.toString()
          badge.style.display = this.filters[filterKey].length > 0 ? 'flex' : 'none'
        }

        this.options.onFilterChange({ ...this.filters })
      })
    })
  }
}
