import { codicons } from '../../utils/codicons'
import './timeline.css'

type GitCommit = {
  hash: string
  timestamp: number
  author: string
  subject: string
  body?: string
  parents?: string[]
}

type CommitDetails = {
  hash: string
  files: { path: string; additions: number; deletions: number }[]
  stats: {
    insertions: number
    deletions: number
    filesChanged: number
  }
}

export class TimelineComponent {
  private container: HTMLElement
  private bodyElement: HTMLElement | null = null
  private currentPath: string = ''
  private history: GitCommit[] = []
  private isLoading: boolean = false
  private mode: 'file' | 'repo' = 'file'
  private resizeObserver: ResizeObserver

  constructor(containerOrId: HTMLElement | string) {
    if (typeof containerOrId === 'string') {
      const el = document.getElementById(containerOrId)
      if (!el) throw new Error(`Timeline container #${containerOrId} not found`)
      this.container = el
    } else {
      this.container = containerOrId
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

    // Update button states immediately
    const fileBtn = this.container.querySelector('#mode-file')
    const repoBtn = this.container.querySelector('#mode-repo')
    fileBtn?.classList.toggle('is-active', mode === 'file')
    repoBtn?.classList.toggle('is-active', mode === 'repo')

    this.update('', this.currentPath)
  }

  public async update(_id: string, path: string): Promise<void> {
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

    if (this.history.length === 0) {
      const emptyMsg =
        this.mode === 'file'
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

    this.bodyElement.innerHTML = `
      <div class="timeline-content">
        <div class="timeline-list">
          ${this.history.map((commit, index) => this.renderItem(commit, index)).join('')}
          <div class="timeline-graph-overlay">
            <svg id="timeline-svg" width="100%" height="100%"></svg>
          </div>
        </div>
      </div>
    `

    this.setupItemHandlers()

    // Use requestAnimationFrame AND a small delay to ensure rendering is complete
    requestAnimationFrame(() => {
      setTimeout(() => this.renderGraph(), 50)
      setTimeout(() => this.renderGraph(), 300) // Safety for slow layout
    })
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
  }

  private setupItemHandlers(): void {
    const items = this.container.querySelectorAll('.timeline-item')
    items.forEach((item, index) => {
      // Toggle expansion on click (except if clicking actions if we add any)
      item.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement
        // Prevent if clicking a button inside (future proofing)
        if (target.tagName === 'BUTTON') return

        const commit = this.history[index]
        if (!commit) return

        // Toggle expanded class
        const wasExpanded = item.classList.contains('is-expanded')

        // Collapse others if desired (optional, maybe keep multiple open?)
        // Let's keep multiple open for comparison utility

        item.classList.toggle('is-expanded')

        // If expanding and no details loaded, fetch them
        if (!wasExpanded) {
          const detailsEl = item.querySelector('.timeline-item-details') as HTMLElement

          // Animate graph during expansion
          const startTime = Date.now()
          const animate = (): void => {
            this.renderGraph()
            if (Date.now() - startTime < 300) {
              requestAnimationFrame(animate)
            }
          }
          requestAnimationFrame(animate)

          if (detailsEl && !detailsEl.dataset.loaded) {
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
        } else {
          // Collapsing - animate graph
          const startTime = Date.now()
          const animate = (): void => {
            this.renderGraph()
            if (Date.now() - startTime < 300) {
              requestAnimationFrame(animate)
            }
          }
          requestAnimationFrame(animate)
        }
      })
    })

    // Sync graph on scroll
    const list = this.container.querySelector('.timeline-list')
    if (list) {
      list.addEventListener('scroll', () => this.renderGraph())
    }
  }

  private renderItem(commit: GitCommit, index: number): string {
    const date = new Date(commit.timestamp)
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return `
      <div class="timeline-item" data-hash="${commit.hash}" data-index="${index}">
        <div class="timeline-item-graph-stub"></div>
        <div class="timeline-item-content">
          <div class="commit-header">
            <span class="commit-author">${commit.author}</span>
            <span class="commit-date">${dateStr} ${timeStr}</span>
          </div>
          <div class="commit-subject" title="${commit.subject}">${commit.subject}</div>
          <div class="commit-footer">
            <span class="commit-hash">${commit.hash.substring(0, 7)}</span>
            ${commit.body ? `<span class="commit-has-body" title="Has description">${codicons.ellipsis}</span>` : ''}
          </div>
          <div class="timeline-item-details"></div>
        </div>
      </div>
    `
  }

  private renderCommitDetails(
    container: HTMLElement,
    commit: GitCommit,
    details: CommitDetails
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
      const maxFiles = 5
      const filesList = details.files
        .slice(0, maxFiles)
        .map(
          (f) => `
            <div class="commit-file" data-path="${f.path}">
              <span class="file-path" title="${f.path}">${f.path}</span>
              <span class="file-mods">
                 <span class="add">+${f.additions}</span>
                 <span class="del">-${f.deletions}</span>
              </span>
            </div>
          `
        )
        .join('')

      filesHtml = `
            <div class="commit-files-list">
               ${filesList}
               ${details.files.length > maxFiles ? `<div class="more-files">+${details.files.length - maxFiles} more files...</div>` : ''}
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

  private renderGraph(): void {
    const svg = this.container.querySelector('#timeline-svg') as SVGSVGElement
    if (!svg) return

    const scrollContainer = this.container.querySelector('.timeline-list') as HTMLElement
    if (!scrollContainer) return

    // Explicitly set SVG height to full scrollable container
    const totalHeight = scrollContainer.scrollHeight
    svg.style.height = `${totalHeight}px`
    svg.innerHTML = ''

    const colors = [
      '#4facfe', // Blue
      '#00f2fe', // Cyan
      '#f093fb', // Purple
      '#f5576c', // Red
      '#fa709a', // Pink
      '#fee140', // Yellow
      '#81fbb8', // Green
      '#667eea' // Indigo
    ]

    const items = Array.from(this.container.querySelectorAll('.timeline-item')) as HTMLElement[]
    if (items.length === 0) return

    const trackWidth = 14
    const startX = 14
    const svgRect = svg.getBoundingClientRect()
    const tracks: string[] = []
    const commitNodes: Map<string, { x: number; y: number; color: string; trackIndex: number }> =
      new Map()

    // Pass 1: Allocate tracks and find positions
    this.history.forEach((commit, i) => {
      const item = items[i]
      if (!item) return

      const rect = item.getBoundingClientRect()
      // Pin Y to the top part of the item (stable during expansion)
      // Item padding-top is 6px. Header line-height is approx 16px.
      // 6 + 16/2 = 14px roughly. Let's use 18px to align with the first line center.
      const y = rect.top - svgRect.top + 18

      // Find ALL tracks currently pointing to this commit (merges)
      let trackIndex = tracks.indexOf(commit.hash)
      if (trackIndex === -1) {
        // New branch tip or disconnected commit
        trackIndex = tracks.findIndex((t) => t === '')
        if (trackIndex === -1) {
          trackIndex = tracks.length
          tracks.push(commit.hash)
        } else {
          tracks[trackIndex] = commit.hash
        }
      }

      const x = startX + trackIndex * trackWidth
      const color = colors[trackIndex % colors.length]
      commitNodes.set(commit.hash, { x, y, color, trackIndex })

      // Update tracks for parents
      // 1. Clear this hash from ANY other tracks it might be in (merges)
      for (let j = 0; j < tracks.length; j++) {
        if (j !== trackIndex && tracks[j] === commit.hash) {
          tracks[j] = ''
        }
      }

      // 2. Assign parents
      if (commit.parents && commit.parents.length > 0) {
        // Primary parent stays in the same track
        tracks[trackIndex] = commit.parents[0]

        // Secondary parents get new tracks
        for (let p = 1; p < commit.parents.length; p++) {
          const pHash = commit.parents[p]
          if (tracks.indexOf(pHash) === -1) {
            const free = tracks.indexOf('')
            if (free !== -1) tracks[free] = pHash
            else tracks.push(pHash)
          }
        }
      } else {
        // Root commit, free the track
        tracks[trackIndex] = ''
      }
    })

    // Pass 2: Draw connections and dots
    this.history.forEach((commit) => {
      const node = commitNodes.get(commit.hash)
      if (!node) return

      if (commit.parents && commit.parents.length > 0) {
        commit.parents.forEach((parentHash) => {
          const pNode = commitNodes.get(parentHash)
          if (pNode) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')

            // Calculate dynamic control points based on vertical distance
            const distY = Math.abs(pNode.y - node.y)
            // If distance is large (expanded item), increase curve steepness
            const curveStrength = Math.min(distY * 0.5, 40) // Cap at 40px

            // Cubic Bezier: Start -> Control1 -> Control2 -> End
            // C x1 y1, x2 y2, x y
            // We want C1 to go down from Start, and C2 to go up from End

            const d = `M ${node.x} ${node.y} C ${node.x} ${node.y + curveStrength}, ${pNode.x} ${pNode.y - curveStrength}, ${pNode.x} ${pNode.y}`

            path.setAttribute('d', d)
            path.setAttribute('stroke', node.color)
            path.setAttribute('stroke-width', '1.5')
            path.setAttribute('fill', 'none')
            path.setAttribute('opacity', '0.6')
            svg.appendChild(path)
          } else {
            // Tail (parent not loaded in this batch)
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
            line.setAttribute('x1', node.x.toString())
            line.setAttribute('y1', node.y.toString())
            line.setAttribute('x2', node.x.toString())
            line.setAttribute('y2', (node.y + 25).toString())
            line.setAttribute('stroke', node.color)
            line.setAttribute('stroke-width', '1.5')
            line.setAttribute('stroke-dasharray', '2,2')
            line.setAttribute('opacity', '0.3')
            svg.appendChild(line)
          }
        })
      }

      // Dot
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', node.x.toString())
      circle.setAttribute('cy', node.y.toString())
      circle.setAttribute('r', '4')
      circle.setAttribute('fill', node.color)
      circle.setAttribute('stroke', 'var(--sidebar-bg, #1a1a1a)')
      circle.setAttribute('stroke-width', '2')
      svg.appendChild(circle)
    })
  }

  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.style.display = 'grid'
      this.update('', this.currentPath)
    } else {
      this.container.style.display = 'none'
    }
  }

  public dispose(): void {
    this.resizeObserver.disconnect()
  }
}
