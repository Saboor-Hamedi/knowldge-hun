import { codicons, getFileIcon } from '../../utils/codicons'
import './timeline.css'
import { GitGraph } from './GitGraph'
import { GitCommit, CommitDetails } from './types'

export class TimelineComponent {
  private container: HTMLElement
  private bodyElement: HTMLElement | null = null
  private currentPath: string = ''
  private history: GitCommit[] = []
  private isLoading: boolean = false
  private mode: 'file' | 'repo' = 'file'
  private lastFetchedPath: string = ''
  private lastFetchedMode: 'file' | 'repo' | null = null
  private filterQuery: string = ''
  private filteredHistoryState: GitCommit[] = []
  private expandedCommits: Set<string> = new Set()
  private resizeObserver: ResizeObserver

  constructor(containerOrId: HTMLElement | string) {
    if (typeof containerOrId === 'string') {
      const el = document.getElementById(containerOrId)
      if (!el) throw new Error(`Timeline container #${containerOrId} not found`)
      this.container = el
    } else {
      this.container = containerOrId
    }

    // Restore mode
    const savedMode = localStorage.getItem('timeline-mode') as 'file' | 'repo'
    if (savedMode === 'file' || savedMode === 'repo') {
      this.mode = savedMode
    }

    // Add specific classes
    this.container.classList.add('sidebar')
    this.container.classList.add('timeline-panel')

    this.resizeObserver = new ResizeObserver(() => {
      if (this.isVisible()) {
        this.renderGraph()
      }
    })
    this.resizeObserver.observe(this.container)

    this.initStructure()
  }

  private initStructure(): void {
    // This part stays static to prevent "shaking"
    this.container.innerHTML = `
      <header class="sidebar__header">
        <div class="sidebar__title">
          <span class="sidebar__title-text">TIMELINE</span>
        </div>
        <div class="sidebar__actions timeline-mode-toggle">
          <button class="sidebar__action ${this.mode === 'file' ? 'is-active' : ''}" id="mode-file" title="File History">File</button>
          <button class="sidebar__action ${this.mode === 'repo' ? 'is-active' : ''}" id="mode-repo" title="Repo History">Repo</button>
          <button class="sidebar__action" id="timeline-refresh" title="Refresh History">${codicons.refresh}</button>
        </div>
      </header>
      <div class="timeline-search">
        <div class="timeline-search-box">
          <span class="search-icon">${codicons.search}</span>
          <input type="text" id="timeline-search-input" placeholder="Filter history..." spellcheck="false" autocomplete="off" />
        </div>
      </div>
      <div class="sidebar__body timeline-body" id="timeline-body-target">
        <!-- Content will be injected here -->
      </div>
    `
    this.bodyElement = this.container.querySelector('#timeline-body-target')
    this.setupHeaderHandlers()
  }

  private isVisible(): boolean {
    return this.container.style.display !== 'none' && this.container.offsetParent !== null
  }

  public setMode(mode: 'file' | 'repo'): void {
    if (this.mode === mode) return
    this.mode = mode
    localStorage.setItem('timeline-mode', mode)

    // Update button states immediately
    const fileBtn = this.container.querySelector('#mode-file')
    const repoBtn = this.container.querySelector('#mode-repo')
    fileBtn?.classList.toggle('is-active', mode === 'file')
    repoBtn?.classList.toggle('is-active', mode === 'repo')

    this.update('', this.currentPath)
  }

  public async update(_id: string, path: string): Promise<void> {
    // If requesting same data we already have, skip fetch (unless it's a force refresh scenario)
    // Actually, update is called when file changes mainly.
    // If called manually (refresh button), we should force it.
    // But here we can't distinguish force.
    // Let's rely on setVisible to manage when to call update.

    this.currentPath = path
    this.isLoading = true
    this.renderInternal()

    try {
      console.log(`[Timeline] Fetching history for mode: ${this.mode}, path: ${path}`)
      if (this.mode === 'file') {
        if (!path) {
          this.history = []
        } else {
          this.history = await window.api.getGitHistory(path)
        }
      } else {
        this.history = await window.api.getGitRepoHistory()
      }

      this.lastFetchedPath = path
      this.lastFetchedMode = this.mode

      console.log(`[Timeline] History received: ${this.history.length} commits`)
    } catch (err) {
      console.error('[Timeline] Failed to update:', err)
      this.history = []
    } finally {
      this.isLoading = false
      this.renderInternal()
    }
  }

  private renderInternal(): void {
    if (!this.bodyElement) return

    if (this.isLoading) {
      this.bodyElement.innerHTML = `
        <div class="timeline-loading">
          <div class="spinner">${codicons.refresh}</div>
          <span>Fetching history...</span>
        </div>
      `
      return
    }

    this.filteredHistoryState = this.history.filter((commit) => {
      if (!this.filterQuery) return true
      return (
        commit.subject.toLowerCase().includes(this.filterQuery) ||
        commit.author.toLowerCase().includes(this.filterQuery) ||
        commit.hash.toLowerCase().includes(this.filterQuery)
      )
    })

    if (this.filteredHistoryState.length === 0) {
      const emptyMsg = this.filterQuery
        ? `No commits matching "${this.filterQuery}"`
        : this.mode === 'file'
          ? this.currentPath
            ? `No history found for file:<br/><code style="font-size: 10px; opacity: 0.7">${this.currentPath}</code>`
            : 'Select a file to view history.'
          : 'No history found for this repository.'

      this.bodyElement.innerHTML = `
        <div class="timeline-empty">
          <div class="empty-icon">${codicons.history}</div>
          <div class="empty-text">${emptyMsg}</div>
        </div>
      `
      return
    }

    const historyHtml: string[] = []
    let lastDateLabel = ''

    this.filteredHistoryState.forEach((commit, index) => {
      const date = new Date(commit.timestamp)
      const dateLabel = this.isToday(date)
        ? 'Today'
        : this.isYesterday(date)
          ? 'Yesterday'
          : date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

      if (dateLabel !== lastDateLabel) {
        historyHtml.push(`<div class="timeline-date-group">${dateLabel}</div>`)
        lastDateLabel = dateLabel
      }

      historyHtml.push(this.renderItem(commit, index))
    })

    this.bodyElement.innerHTML = `
      <div class="timeline-content">
        <div class="timeline-list">
          ${historyHtml.join('')}
          <div class="timeline-graph-overlay">
            <svg id="timeline-svg" width="100%" height="100%"></svg>
          </div>
        </div>
      </div>
    `

    this.setupItemHandlers()

    // Load details for already expanded items
    const expandedItems = Array.from(
      this.container.querySelectorAll('.timeline-item.is-expanded')
    ) as HTMLElement[]
    expandedItems.forEach((item) => {
      const hash = item.dataset.hash
      const commit = this.filteredHistoryState.find((c) => c.hash === hash)
      if (commit) {
        this.loadDetailsForItem(item, commit)
      }
    })

    // Adjust graph when rendering
    requestAnimationFrame(() => this.renderGraph())
  }

  private renderGraph(): void {
    const svg = this.container.querySelector('#timeline-svg') as SVGSVGElement
    if (!svg) return

    const scrollContainer = this.container.querySelector('.timeline-list') as HTMLElement
    if (!scrollContainer) return

    // Explicitly set SVG height to full scrollable container
    const totalHeight = scrollContainer.scrollHeight
    svg.style.height = `${totalHeight}px`

    // Also set overlay height to ensure it covers scrolling area
    const overlay = this.container.querySelector('.timeline-graph-overlay') as HTMLElement
    if (overlay) overlay.style.height = `${totalHeight}px`

    const commitYPositions = this.collectYPositions()
    new GitGraph(svg, this.filteredHistoryState, commitYPositions)
  }

  private collectYPositions(): Map<string, number> {
    const svg = this.container.querySelector('#timeline-svg') as SVGSVGElement
    const items = Array.from(this.container.querySelectorAll('.timeline-item')) as HTMLElement[]
    const commitYPositions = new Map<string, number>()
    if (!svg) return commitYPositions

    const svgRect = svg.getBoundingClientRect()
    items.forEach((item) => {
      const hash = item.dataset.hash
      if (!hash) return
      const rect = item.getBoundingClientRect()
      const y = rect.top - svgRect.top + 18
      commitYPositions.set(hash, y)
    })
    return commitYPositions
  }

  private setupHeaderHandlers(): void {
    const fileBtn = this.container.querySelector('#mode-file')
    const repoBtn = this.container.querySelector('#mode-repo')
    const refreshBtn = this.container.querySelector('#timeline-refresh')

    if (fileBtn) fileBtn.addEventListener('click', () => this.setMode('file'))
    if (repoBtn) repoBtn.addEventListener('click', () => this.setMode('repo'))
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('rotate-icon')
        await this.update('', this.currentPath)
        setTimeout(() => refreshBtn.classList.remove('rotate-icon'), 500)
      })
    }

    const searchInput = this.container.querySelector('#timeline-search-input') as HTMLInputElement
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.filterQuery = searchInput.value.toLowerCase().trim()
        this.renderInternal()
      })
    }
  }

  private setupItemHandlers(): void {
    const items = this.container.querySelectorAll('.timeline-item')
    items.forEach((item, index) => {
      // Prevent collapse when clicking inside details
      const detailsEl = item.querySelector('.timeline-item-details')
      if (detailsEl) {
        detailsEl.addEventListener('click', (e) => e.stopPropagation())
      }

      // Toggle expansion on click (except if clicking actions if we add any)
      item.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement
        // Prevent if clicking a button inside (future proofing)
        if (target.tagName === 'BUTTON') return

        const commit = this.filteredHistoryState[index]
        if (!commit) return

        // Toggle expanded class
        const wasExpanded = item.classList.contains('is-expanded')
        item.classList.toggle('is-expanded')

        if (item.classList.contains('is-expanded')) {
          this.expandedCommits.add(commit.hash)
        } else {
          this.expandedCommits.delete(commit.hash)
        }

        // If expanding and no details loaded, fetch them
        if (!wasExpanded) {
          this.loadDetailsForItem(item as HTMLElement, commit)
        }

        // Animate graph during state change
        const startTime = Date.now()
        const animate = (): void => {
          this.renderGraph()
          if (Date.now() - startTime < 300) {
            requestAnimationFrame(animate)
          }
        }
        requestAnimationFrame(animate)
      })
    })

    // Sync graph on scroll
    const list = this.container.querySelector('.timeline-list')
    if (list) {
      list.addEventListener('scroll', () => this.renderGraph())
    }
  }

  private async loadDetailsForItem(item: HTMLElement, commit: GitCommit): Promise<void> {
    const detailsEl = item.querySelector('.timeline-item-details') as HTMLElement
    if (!detailsEl || detailsEl.dataset.loaded) return

    detailsEl.innerHTML = `<div class="timeline-loading-sm">${codicons.refresh} Loading details...</div>`

    try {
      if (typeof window.api.getCommitDetails !== 'function') {
        throw new Error('API not available')
      }
      const details = await window.api.getCommitDetails(commit.hash)
      this.renderCommitDetails(detailsEl, commit, details)
      detailsEl.dataset.loaded = 'true'

      // Adjust graph height after expansion
      requestAnimationFrame(() => this.renderGraph())
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      detailsEl.innerHTML = `<div class="error-text">Failed: ${msg}</div>`
    }
  }

  private renderItem(commit: GitCommit, index: number): string {
    const isExpanded = this.expandedCommits.has(commit.hash)
    const date = new Date(commit.timestamp)
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const initials = this.getInitials(commit.author)
    const avatarColor = this.getAvatarColor(commit.author)

    // Generate badges HTML
    let refsHtml = ''
    if (commit.refs && commit.refs.length > 0) {
      const badges = commit.refs
        .map((ref) => {
          let text = ref.trim()
          let type = 'other'

          if (text.startsWith('HEAD ->')) {
            text = text.replace('HEAD ->', '').trim()
            type = 'branch'
          } else if (text === 'HEAD') {
            type = 'branch'
          } else if (text.startsWith('tag:')) {
            text = text.replace('tag:', '').trim()
            type = 'tag'
          } else if (text.startsWith('origin/')) {
            text = text.replace('origin/', '')
            type = 'remote'
          }

          if (!text) return ''
          return `<span class="ref-badge ref-${type}" title="${ref}">${text}</span>`
        })
        .join('')
      if (badges) {
        refsHtml = `<div class="commit-refs">${badges}</div>`
      }
    }

    return `
      <div class="timeline-item ${isExpanded ? 'is-expanded' : ''}" 
           data-hash="${commit.hash}" 
           data-index="${index}"
           style="animation-delay: ${Math.min(index * 0.05, 1)}s">
        <div class="timeline-item-graph-stub"></div>
        <div class="commit-avatar" style="background: ${avatarColor}">${initials}</div>
        <div class="timeline-item-content">
          <div class="commit-header">
            <span class="commit-author">${commit.author}</span>
            <span class="commit-date">${timeStr}</span>
          </div>
          <div class="commit-subject" title="${commit.subject}">${commit.subject}</div>
          <div class="commit-footer">
            <span class="commit-hash">${commit.hash.substring(0, 7)}</span>
            ${commit.body ? `<span class="commit-has-body" title="Has description">${codicons.ellipsis}</span>` : ''}
          </div>
          ${refsHtml}
          <div class="timeline-item-details"></div>
        </div>
      </div>
    `
  }

  private renderCommitDetails(
    container: HTMLElement,
    commit: GitCommit,
    details: CommitDetails,
    showAll: boolean = false
  ): void {
    let statsHtml = ''
    if (details && details.stats) {
      statsHtml = `
            <div class="commit-stats">
              <span class="stat-add">+${details.stats.insertions}</span>
              <span class="stat-del">-${details.stats.deletions}</span>
              <span class="stat-files">${details.stats.filesChanged} files</span>
            </div>
          `
    }

    let filesHtml = ''
    if (details && details.files && details.files.length > 0) {
      const displayFiles = showAll ? details.files : details.files.slice(0, 5)
      const filesList = displayFiles
        .map((f) => {
          const icon = getFileIcon(f.path)
          const total = f.additions + f.deletions
          const addPct = total > 0 ? (f.additions / total) * 100 : 0
          const delPct = total > 0 ? (f.deletions / total) * 100 : 0

          // Determine status letter
          let statusLetter = 'M'
          let statusClass = 'mod'
          if (f.deletions === 0 && f.additions > 0) {
            statusLetter = 'A'
            statusClass = 'add'
          } else if (f.additions === 0 && f.deletions > 0) {
            statusLetter = 'D'
            statusClass = 'del'
          }

          return `
            <div class="commit-file" data-path="${f.path}">
              <span class="file-status-badge status-${statusClass}">${statusLetter}</span>
              <span class="file-icon-wrapper">${icon}</span>
              <span class="file-path" title="${f.path}">${f.path.split('/').pop()}</span>
              
              <div class="file-progress-wrapper">
                <div class="file-progress-bar">
                  <div class="progress-add" style="width: ${addPct}%"></div>
                  <div class="progress-del" style="width: ${delPct}%"></div>
                </div>
                <span class="stat-diff">+${f.additions} -${f.deletions}</span>
              </div>
            </div>
          `
        })
        .join('')

      filesHtml = `
            <div class="commit-files-list">
               ${filesList}
               ${!showAll && details.files.length > 5 ? `<div class="more-files">+${details.files.length - 5} more files...</div>` : ''}
               ${showAll && details.files.length > 5 ? `<div class="show-less">Show less</div>` : ''}
            </div>
          `
    }

    container.innerHTML = `
        <div class="commit-body">${commit.body ? commit.body.replace(/\n/g, '<br/>') : ''}</div>
        ${statsHtml}
        ${filesHtml}
        <div class="commit-actions">
           ${this.currentPath ? '<button class="action-btn">Compare</button>' : ''}
        </div>
      `

    // More files click handler
    const moreFilesBtn = container.querySelector('.more-files') as HTMLElement
    if (moreFilesBtn) {
      moreFilesBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.renderCommitDetails(container, commit, details, true)
        // Adjust graph height after expansion
        requestAnimationFrame(() => this.renderGraph())
      })
    }

    // Show less click handler
    const showLessBtn = container.querySelector('.show-less') as HTMLElement
    if (showLessBtn) {
      showLessBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.renderCommitDetails(container, commit, details, false)
        // Adjust graph height after collapse
        requestAnimationFrame(() => this.renderGraph())
      })
    }

    // File click handlers
    const fileItems = container.querySelectorAll('.commit-file')
    fileItems.forEach((item) => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation()
        const path = (item as HTMLElement).dataset.path
        if (!path) return

        // Visual feedback
        item.classList.add('loading-file')
        try {
          // Fetch content for this specific file at this commit
          const finalContent = await window.api.getGitContentAtCommit(path, commit.hash)

          this.container.dispatchEvent(
            new CustomEvent('timeline:compare', {
              detail: { commit, path, content: finalContent },
              bubbles: true
            })
          )
        } catch (err) {
          console.error('Failed to load file', err)
        } finally {
          item.classList.remove('loading-file')
        }
      })
    })

    // Re-attach event listeners for buttons if needed or use delegation
    // Since innerHTML kills event listeners, we rely on bubbling or re-adding
    const btn = container.querySelector('.action-btn') as HTMLButtonElement
    if (btn) {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const originalText = btn.innerText
        btn.innerText = 'Loading...'
        btn.disabled = true
        try {
          await this.handleCompare(commit)
        } finally {
          btn.innerText = originalText
          btn.disabled = false
        }
      })
    }
  }

  private async handleCompare(commit: GitCommit): Promise<void> {
    try {
      const content = await window.api.getGitContentAtCommit(this.currentPath || '', commit.hash)
      this.container.dispatchEvent(
        new CustomEvent('timeline:compare', {
          detail: { commit, path: this.currentPath, content },
          bubbles: true
        })
      )
    } catch (err) {
      console.error('Failed to compare', err)
    }
  }

  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.style.display = 'grid'

      const shouldUpdate =
        this.mode !== this.lastFetchedMode ||
        (this.mode === 'file' && this.currentPath !== this.lastFetchedPath) ||
        //!this.history || this.history.length === 0 // Allow retry if empty? Maybe not if it's truly empty.
        (this.history.length === 0 && (this.mode === 'repo' || !!this.currentPath))

      if (shouldUpdate) {
        this.update('', this.currentPath)
      }
    } else {
      this.container.style.display = 'none'
    }
  }

  public dispose(): void {
    this.resizeObserver.disconnect()
  }

  private isToday(date: Date): boolean {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  private isYesterday(date: Date): boolean {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    )
  }

  private getInitials(name: string): string {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  private getAvatarColor(name: string): string {
    const colors = [
      '#FF5722',
      '#E91E63',
      '#9C27B0',
      '#673AB7',
      '#3F51B5',
      '#2196F3',
      '#03A9F4',
      '#00BCD4',
      '#009688',
      '#4CAF50',
      '#8BC34A',
      '#CDDC39'
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }
}
