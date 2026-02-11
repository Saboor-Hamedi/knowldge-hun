import { codicons } from '../../utils/codicons'
import './timeline.css'

type GitCommit = {
  hash: string
  timestamp: number
  author: string
  subject: string
  parents?: string[]
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
            ? 'No history found for this file.'
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
    })
  }

  private setupHeaderHandlers(): void {
    const fileBtn = this.container.querySelector('#mode-file')
    const repoBtn = this.container.querySelector('#mode-repo')
    if (fileBtn) fileBtn.addEventListener('click', () => this.setMode('file'))
    if (repoBtn) repoBtn.addEventListener('click', () => this.setMode('repo'))
  }

  private setupItemHandlers(): void {
    const items = this.container.querySelectorAll('.timeline-item')
    items.forEach((item, index) => {
      item.addEventListener('click', async () => {
        const commit = this.history[index]
        if (!commit) return

        try {
          // Highlight selection
          items.forEach((el) => el.classList.remove('is-active'))
          item.classList.add('is-active')

          const content = await window.api.getGitContentAtCommit(
            this.currentPath || '',
            commit.hash
          )
          this.container.dispatchEvent(
            new CustomEvent('timeline:compare', {
              detail: { commit, path: this.currentPath, content },
              bubbles: true
            })
          )
        } catch (err) {
          console.error('[Timeline] Failed to fetch content for commit:', err)
        }
      })
    })

    // Sync graph on scroll
    const list = this.container.querySelector('.timeline-list')
    if (list) {
      list.addEventListener('scroll', () => this.renderGraph())
    }
  }

  private renderItem(commit: GitCommit, _index: number): string {
    const date = new Date(commit.timestamp)
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return `
      <div class="timeline-item" data-hash="${commit.hash}">
        <div class="timeline-item-graph-stub"></div>
        <div class="timeline-item-content">
          <div class="commit-header">
            <span class="commit-author">${commit.author}</span>
            <span class="commit-date">${dateStr} ${timeStr}</span>
          </div>
          <div class="commit-subject" title="${commit.subject}">${commit.subject}</div>
          <div class="commit-footer">
            <span class="commit-hash">${commit.hash.substring(0, 7)}</span>
          </div>
        </div>
      </div>
    `
  }

  private renderGraph(): void {
    const svg = this.container.querySelector('#timeline-svg') as SVGSVGElement
    if (!svg) return

    const scrollContainer = this.container.querySelector('.timeline-list') as HTMLElement
    if (!scrollContainer) return

    // Clear previous
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

    // Standard track width
    const trackWidth = 15
    const startX = 20

    const svgRect = svg.getBoundingClientRect()
    const tracks: string[] = []
    const commitNodes: Map<string, { x: number; y: number; color: string }> = new Map()

    // Pass 1: Allocate tracks and find positions
    this.history.forEach((commit, i) => {
      const item = items[i]
      if (!item) return

      const rect = item.getBoundingClientRect()
      // Calculate Y relative to the SVG container (which is inside the scrollable list)
      const y = rect.top - svgRect.top + rect.height / 2

      // Track allocation
      let trackIndex = tracks.indexOf(commit.hash)
      if (trackIndex === -1) {
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
      commitNodes.set(commit.hash, { x, y, color })

      // Clean up track for parents
      tracks[trackIndex] = ''
      if (commit.parents && commit.parents.length > 0) {
        tracks[trackIndex] = commit.parents[0]
        for (let p = 1; p < commit.parents.length; p++) {
          const parentHash = commit.parents[p]
          if (tracks.indexOf(parentHash) === -1) {
            const freeSlot = tracks.indexOf('')
            if (freeSlot !== -1) tracks[freeSlot] = parentHash
            else tracks.push(parentHash)
          }
        }
      }
    })

    // Pass 2: Draw connections (only if node exists)
    this.history.forEach((commit) => {
      const node = commitNodes.get(commit.hash)
      if (!node) return

      if (commit.parents) {
        commit.parents.forEach((parentHash) => {
          const pNode = commitNodes.get(parentHash)
          if (pNode) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
            // Bezier curve
            const d = `M ${node.x} ${node.y} C ${node.x} ${node.y + 15}, ${pNode.x} ${pNode.y - 15}, ${pNode.x} ${pNode.y}`
            path.setAttribute('d', d)
            path.setAttribute('stroke', node.color)
            path.setAttribute('stroke-width', '2')
            path.setAttribute('fill', 'none')
            path.setAttribute('opacity', '0.6')
            svg.appendChild(path)
          } else {
            // Draw a tail if parent is not in current view (limit reached)
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
            line.setAttribute('x1', node.x.toString())
            line.setAttribute('y1', node.y.toString())
            line.setAttribute('x2', node.x.toString())
            line.setAttribute('y2', (node.y + 30).toString())
            line.setAttribute('stroke', node.color)
            line.setAttribute('stroke-width', '2')
            line.setAttribute('stroke-dasharray', '2,2')
            line.setAttribute('opacity', '0.4')
            svg.appendChild(line)
          }
        })
      }

      // Draw commit dot
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', node.x.toString())
      circle.setAttribute('cy', node.y.toString())
      circle.setAttribute('r', '4.5')
      circle.setAttribute('fill', node.color)
      circle.setAttribute('stroke', 'var(--sidebar-bg, #1e1e1e)')
      circle.setAttribute('stroke-width', '2')
      circle.style.cursor = 'pointer'
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
