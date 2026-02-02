import { codicons } from '../../utils/codicons'
import './timeline.css'

export type TimelineEntry = {
  hash: string
  timestamp: number
  author: string
  subject: string
}

export class TimelineComponent {
  private container: HTMLElement
  private contentEl: HTMLElement
  private currentPath: string | null = null
  private entries: TimelineEntry[] = []

  constructor(containerId: string) {
    const parent = document.getElementById(containerId)
    if (!parent) throw new Error(`Timeline container #${containerId} not found`)

    this.container = document.createElement('div')
    this.container.className = 'timeline-panel'
    this.container.innerHTML = `
      <div class="timeline__header">
        ${codicons.history}
        <span>Timeline</span>
      </div>
      <div class="timeline__content">
        <div class="timeline__empty">
          <i>${codicons.history}</i>
          <div>Open a file to view its history</div>
        </div>
      </div>
    `
    parent.appendChild(this.container)
    this.contentEl = this.container.querySelector('.timeline__content') as HTMLElement
  }

  public async update(noteId: string, path: string): Promise<void> {
    console.log('[Timeline] Update called with:', { noteId, path })
    if (this.currentPath === path) {
      console.log('[Timeline] Path unchanged, skipping update')
      return
    }
    this.currentPath = path

    this.renderLoading()

    try {
      // Fetch history from main process
      console.log('[Timeline] Fetching history for path:', path)
      const history = await window.api.getGitHistory(path)
      console.log('[Timeline] Received history:', history)
      this.entries = history

      if (this.entries.length === 0) {
        console.log('[Timeline] No history entries found')
        this.renderEmpty('No history found for this file')
      } else {
        console.log(`[Timeline] Rendering ${this.entries.length} entries`)
        this.renderEntries()
      }
    } catch (err) {
      console.error('[Timeline] Failed to update:', err)
      this.renderEmpty(`Failed to load version history: ${err}`)
    }
  }

  private renderLoading(): void {
    this.contentEl.innerHTML = `
      <div class="timeline__empty">
        <div class="notification-spin" style="margin-bottom: 12px; display: inline-block;">
          ${codicons.refresh}
        </div>
        <div>Fetching history...</div>
      </div>
    `
  }

  private renderEmpty(message: string): void {
    this.contentEl.innerHTML = `
      <div class="timeline__empty">
        <i>${codicons.history}</i>
        <div>${message}</div>
      </div>
    `
  }

  private renderEntries(): void {
    const list = document.createElement('div')
    list.className = 'timeline__list'

    this.entries.forEach((entry) => {
      const item = document.createElement('div')
      item.className = 'timeline__item'
      item.title = `Commit ${entry.hash}\n${entry.subject}`

      const date = new Date(entry.timestamp).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      item.innerHTML = `
        <div class="timeline__subject">${entry.subject}</div>
        <div class="timeline__meta">
          <span class="timeline__author">${entry.author}</span>
          <span>&bull;</span>
          <span class="timeline__date">${date}</span>
        </div>
      `

      item.onclick = async () => {
        // Handle commit selection (e.g., show diff)
        // For now, let's just show the content in a temporary preview or log it
        const content = await window.api.getGitContentAtCommit(this.currentPath!, entry.hash)

        // Dispatch event for other components to handle (e.g., Editor to show diff)
        window.dispatchEvent(
          new CustomEvent('timeline:compare', {
            detail: {
              hash: entry.hash,
              content,
              path: this.currentPath,
              subject: entry.subject
            }
          })
        )
      }

      list.appendChild(item)
    })

    this.contentEl.innerHTML = ''
    this.contentEl.appendChild(list)
  }

  public setVisible(visible: boolean): void {
    if (visible) {
      this.container.classList.add('is-active')
    } else {
      this.container.classList.remove('is-active')
    }
  }
}
