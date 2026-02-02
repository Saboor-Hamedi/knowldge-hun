import './statusbar.css'
import { VersionFetcher } from '../../utils/versionFetcher'
import { createElement, CloudUpload, CloudDownload, RefreshCw, GitBranch } from 'lucide'
import { state } from '../../core/state'
import { ContextMenu } from '../contextmenu/contextmenu'
import { gitService } from '../../services/git/gitService'
import { notificationManager } from '../notification/notification'
import { RichTooltip } from '../common/tooltip'
import '../common/tooltip.css'

export class StatusBar {
  private container: HTMLElement
  private statusText: HTMLElement
  private metaText: HTMLElement
  private gitBranchEl: HTMLElement | null = null
  private tooltip: RichTooltip | null = null
  private version: string | null = null
  private statusTimeout: NodeJS.Timeout | null = null
  private contextMenu: ContextMenu

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.contextMenu = new ContextMenu()
    this.render()
    this.statusText = this.container.querySelector('.statusbar__version') as HTMLElement
    this.gitBranchEl = this.container.querySelector('.statusbar__git') as HTMLElement
    const rightContainer = this.container.querySelector('.statusbar__right') as HTMLElement
    this.metaText = rightContainer?.querySelector('.statusbar__meta') as HTMLElement

    // Create custom tooltip instance
    this.tooltip = new RichTooltip({ delay: 200 })

    this.updateStatusText()
    this.attachSyncEvents()
    this.initContextMenu()
    this.updateVisibility()
    this.attachGitEvents()

    // Initial git update
    this.updateGitInfo()

    // Fetch and set the app version
    VersionFetcher.fetchVersion()
      .then((v) => {
        this.version = v
        this.updateStatusText()
      })
      .catch((error) => {
        console.warn('StatusBar: Failed to fetch app version', error)
      })
  }

  private createLucideIcon(IconComponent: unknown, size: number = 12): string {
    const svgElement = createElement(IconComponent as Parameters<typeof createElement>[0], {
      size: size,
      'stroke-width': 1.5,
      stroke: 'currentColor',
      color: 'currentColor',
      class: 'lucide-icon'
    }) as unknown as HTMLElement
    if (svgElement && svgElement.outerHTML) {
      return svgElement.outerHTML
    }
    return ''
  }

  private render(): void {
    const syncIconBar = this.createLucideIcon(RefreshCw, 12)
    const uploadIconMenu = this.createLucideIcon(CloudUpload, 10)
    const downloadIconMenu = this.createLucideIcon(CloudDownload, 10)

    this.container.innerHTML = `
      <div class="statusbar__left">
        <span class="statusbar__item statusbar__version"></span>
        <span class="statusbar__item statusbar__git" title="No repository">
          ${this.createLucideIcon(GitBranch, 12)}
          <span class="statusbar__git-branch"></span>
        </span>
      </div>
      <span class="statusbar__right">
        <span class="statusbar__item statusbar__words" style="visibility: hidden;"></span>
        <span class="statusbar__item statusbar__chars" style="visibility: hidden;"></span>
        <span class="statusbar__item statusbar__lines" style="visibility: hidden;"></span>
        <span class="statusbar__item statusbar__tags" style="visibility: hidden;"></span>
        <span class="statusbar__item statusbar__links" style="visibility: hidden;"></span>
        <span class="statusbar__item statusbar__mentions" style="visibility: hidden;"></span>
        <span class="statusbar__item statusbar__cursor" style="visibility: hidden;"></span>
        <div class="statusbar__sync" style="visibility: hidden;">
          <button class="statusbar__sync-button statusbar__item" title="Sync">
            ${syncIconBar}
          </button>
          <div class="statusbar__sync-menu">
            <button class="statusbar__sync-menu-item" data-action="backup">
              <span class="statusbar__sync-menu-icon">${uploadIconMenu}</span>
              <span>Backup to Gist</span>
            </button>
            <button class="statusbar__sync-menu-item" data-action="restore">
              <span class="statusbar__sync-menu-icon">${downloadIconMenu}</span>
              <span>Restore from Gist</span>
            </button>
          </div>
        </div>
        <span class="statusbar__meta statusbar__item"></span>
      </span>
    `
  }

  private initContextMenu(): void {
    this.container.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault()
      const s = state.settings?.statusbar || {
        words: true,
        chars: true,
        lines: true,
        tags: true,
        links: true,
        cursor: true,
        sync: true,
        version: true,
        git: true
      }

      this.contextMenu.show(e.clientX, e.clientY, [
        {
          label: 'Git Status',
          checked: s.git !== false,
          onClick: () => this.toggleSetting('git')
        },
        { separator: true },
        {
          label: 'Words',
          checked: s.words !== false,
          onClick: () => this.toggleSetting('words')
        },
        {
          label: 'Characters',
          checked: s.chars !== false,
          onClick: () => this.toggleSetting('chars')
        },
        {
          label: 'Lines',
          checked: s.lines !== false,
          onClick: () => this.toggleSetting('lines')
        },
        {
          label: 'Tags',
          checked: s.tags !== false,
          onClick: () => this.toggleSetting('tags')
        },
        {
          label: 'WikiLinks',
          checked: s.links !== false,
          onClick: () => this.toggleSetting('links')
        },
        { separator: true },
        {
          label: 'Cursor Position',
          checked: s.cursor !== false,
          onClick: () => this.toggleSetting('cursor')
        },
        { separator: true },
        {
          label: 'Sync Status',
          checked: s.sync !== false,
          onClick: () => this.toggleSetting('sync')
        },
        {
          label: 'App Version',
          checked: s.version !== false,
          onClick: () => this.toggleSetting('version')
        }
      ])
    })
  }

  private async toggleSetting(key: string): Promise<void> {
    const current = state.settings?.statusbar || {
      words: true,
      chars: true,
      lines: true,
      tags: true,
      links: true,
      cursor: true,
      sync: true,
      version: true,
      git: true // Added git to default settings
    }

    const updated = {
      ...current,
      [key]: !((current as Record<string, boolean | undefined>)[key] !== false)
    }

    state.settings = {
      ...state.settings!,
      statusbar: updated
    }

    await window.api.updateSettings({ statusbar: updated })
    this.updateVisibility()
  }

  public updateVisibility(): void {
    const s = state.settings?.statusbar || {
      words: true,
      chars: true,
      lines: true,
      tags: true,
      links: true,
      cursor: true,
      sync: true,
      version: true,
      git: true
    }

    const wordsEl = this.container.querySelector('.statusbar__words') as HTMLElement
    const charsEl = this.container.querySelector('.statusbar__chars') as HTMLElement
    const linesEl = this.container.querySelector('.statusbar__lines') as HTMLElement
    const tagsEl = this.container.querySelector('.statusbar__tags') as HTMLElement
    const linksEl = this.container.querySelector('.statusbar__links') as HTMLElement
    const cursorEl = this.container.querySelector('.statusbar__cursor') as HTMLElement
    const syncEl = this.container.querySelector('.statusbar__sync') as HTMLElement
    const versionEl = this.container.querySelector('.statusbar__version') as HTMLElement
    const gitEl = this.container.querySelector('.statusbar__git') as HTMLElement

    if (wordsEl) {
      wordsEl.style.visibility = s.words !== false ? 'visible' : 'hidden'
      wordsEl.style.display = 'flex'
    }
    if (charsEl) {
      charsEl.style.visibility = s.chars !== false ? 'visible' : 'hidden'
      charsEl.style.display = 'flex'
    }
    if (linesEl) {
      linesEl.style.visibility = s.lines !== false ? 'visible' : 'hidden'
      linesEl.style.display = 'flex'
    }
    if (tagsEl) {
      tagsEl.style.visibility = s.tags !== false ? 'visible' : 'hidden'
      tagsEl.style.display = 'flex'
    }
    if (linksEl) {
      linksEl.style.visibility = s.links !== false ? 'visible' : 'hidden'
      linksEl.style.display = 'flex'
    }
    if (cursorEl) {
      cursorEl.style.visibility = s.cursor !== false ? 'visible' : 'hidden'
      cursorEl.style.display = 'flex'
    }
    if (syncEl) {
      syncEl.style.visibility = s.sync !== false ? 'visible' : 'hidden'
      syncEl.style.display = 'flex'
    }
    if (versionEl) {
      versionEl.style.visibility = s.version !== false ? 'visible' : 'hidden'
      versionEl.style.display = 'flex'
    }
    if (gitEl) {
      gitEl.style.visibility = s.git !== false ? 'visible' : 'hidden'
      // We don't force display: flex here because updateGitInfo handles show/hide logic based on branch existence
    }
  }

  setMetrics(
    metrics: {
      words: number
      chars: number
      lines: number
      wikiLinks: number
      tags: number
      mentions: number
    } | null
  ): void {
    const wordsEl = this.container.querySelector('.statusbar__words')
    const charsEl = this.container.querySelector('.statusbar__chars')
    const linesEl = this.container.querySelector('.statusbar__lines')
    const tagsEl = this.container.querySelector('.statusbar__tags')
    const linksEl = this.container.querySelector('.statusbar__links')
    const mentionsEl = this.container.querySelector('.statusbar__mentions')

    if (!metrics) {
      if (wordsEl) wordsEl.textContent = ''
      if (charsEl) charsEl.textContent = ''
      if (linesEl) linesEl.textContent = ''
      if (tagsEl) tagsEl.textContent = ''
      if (linksEl) linksEl.textContent = ''
      if (mentionsEl) mentionsEl.textContent = ''
      return
    }

    if (wordsEl) wordsEl.textContent = `${metrics.words} Word${metrics.words === 1 ? '' : 's'}`
    if (charsEl) charsEl.textContent = `${metrics.chars} Char${metrics.chars === 1 ? '' : 's'}`
    if (linesEl) linesEl.textContent = `${metrics.lines} Line${metrics.lines === 1 ? '' : 's'}`
    if (tagsEl) tagsEl.textContent = `${metrics.tags} Tag${metrics.tags === 1 ? '' : 's'}`
    if (linksEl)
      linksEl.textContent = `${metrics.wikiLinks} Link${metrics.wikiLinks === 1 ? '' : 's'}`
    if (mentionsEl) {
      mentionsEl.textContent = `${metrics.mentions} Mention${metrics.mentions === 1 ? '' : 's'}`
      ;(mentionsEl as HTMLElement).style.visibility = metrics.mentions > 0 ? 'visible' : 'hidden'
      ;(mentionsEl as HTMLElement).style.display = metrics.mentions > 0 ? 'flex' : 'none'
    }
  }

  setCursor(pos: { ln: number; col: number } | null): void {
    const el = this.container.querySelector('.statusbar__cursor')
    if (el) {
      if (!pos) {
        el.textContent = ''
        return
      }
      el.textContent = `Ln ${pos.ln}, Col ${pos.col}`
    }
  }

  private attachSyncEvents(): void {
    const syncButton = this.container.querySelector('.statusbar__sync-button') as HTMLElement
    const syncMenu = this.container.querySelector('.statusbar__sync-menu') as HTMLElement
    const menuItems = this.container.querySelectorAll<HTMLElement>('.statusbar__sync-menu-item')

    if (syncButton && syncMenu) {
      syncButton.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()

        const isOpen = syncMenu.classList.contains('is-open')

        if (!isOpen) {
          const buttonRect = syncButton.getBoundingClientRect()
          syncMenu.style.bottom = `${window.innerHeight - buttonRect.top + 4}px`
          syncMenu.style.right = `${window.innerWidth - buttonRect.right}px`
          syncMenu.style.left = 'auto'
          syncMenu.style.top = 'auto'
        }

        syncMenu.classList.toggle('is-open')
      })

      syncMenu.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation()
      })

      if (
        !(syncMenu as HTMLElement & { __clickOutsideAttached?: boolean }).__clickOutsideAttached
      ) {
        const handleClickOutside = (e: MouseEvent): void => {
          if (!syncMenu.contains(e.target as Node) && !syncButton.contains(e.target as Node)) {
            syncMenu.classList.remove('is-open')
          }
        }
        document.addEventListener('click', handleClickOutside)
        ;(syncMenu as HTMLElement & { __clickOutsideAttached?: boolean }).__clickOutsideAttached =
          true
      }
    }

    menuItems.forEach((item) => {
      item.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const action = (item as HTMLElement).dataset.action
        if (action === 'backup' || action === 'restore') {
          syncButton.classList.add('is-syncing')
          this.container.dispatchEvent(
            new CustomEvent('sync-action', { detail: { action }, bubbles: true })
          )

          // Auto-remove syncing class after 2 seconds (or wait for event)
          setTimeout(() => syncButton.classList.remove('is-syncing'), 2000)
        }
        syncMenu.classList.remove('is-open')
      })
    })
  }

  private updateStatusText(): void {
    if (this.statusText && !this.statusTimeout) {
      this.statusText.textContent = this.version ? `v${this.version}` : ''
    }
  }

  setStatus(text: string): void {
    if (text === 'Ready' || text === 'Autosaved' || text === 'Settings auto-saved') {
      return
    }

    if (this.statusText) {
      if (this.statusTimeout) {
        clearTimeout(this.statusTimeout)
      }

      this.statusText.textContent = text

      this.statusTimeout = setTimeout(() => {
        this.statusTimeout = null
        if (this.version) {
          this.statusText.textContent = `v${this.version}`
        } else {
          VersionFetcher.fetchVersion()
            .then((v) => {
              this.version = v
              if (!this.statusTimeout) {
                this.statusText.textContent = `v${v}`
              }
            })
            .catch(() => {
              if (!this.statusTimeout) {
                this.statusText.textContent = ''
              }
            })
        }
      }, 3000)
    }
  }

  setMeta(text: string): void {
    if (text && text.startsWith('📁')) {
      if (this.metaText) {
        this.metaText.textContent = ''
      }
      return
    }

    if (this.metaText) {
      this.metaText.textContent = text
    }
  }

  private attachGitTooltip(): void {
    if (!this.gitBranchEl || !this.tooltip) return

    const el = this.gitBranchEl

    el.addEventListener('mouseenter', () => {
      if (!this.tooltip) return

      const metadata = gitService.getMetadata()
      const summary = gitService.getSummary()
      if (!metadata.branch) return

      const content = `
        <div class="rich-tooltip__header">
          <span class="rich-tooltip__title">${metadata.repoName || 'Local Repository'}</span>
          <span class="rich-tooltip__badge">${metadata.branch}</span>
        </div>
        <div class="rich-tooltip__body">
          ${
            metadata.remote
              ? `
            <div class="rich-tooltip__row">
              <a href="${metadata.remote}" class="rich-tooltip__link" target="_blank" style="color: var(--accent); text-decoration: none; border-bottom: 1px dashed rgba(86, 156, 214, 0.4); padding-bottom: 1px;">${metadata.remote}</a>
            </div>
          `
              : ''
          }
          <div class="rich-tooltip__stats">
            <div class="rich-tooltip__stat modified" title="Modified">${summary.modified} M</div>
            <div class="rich-tooltip__stat added" title="Added/Untracked">${summary.added} A</div>
            <div class="rich-tooltip__stat deleted" title="Deleted">${summary.deleted} D</div>
          </div>
        </div>
        <div class="rich-tooltip__footer">Click for Source Control actions</div>
      `

      this.tooltip.setCompact(false)
      this.tooltip.show(el, content)
    })

    el.addEventListener('mouseleave', () => {
      this.tooltip?.hide()
    })
  }

  private attachGitEvents(): void {
    window.addEventListener('git-status-changed', () => {
      this.updateGitInfo()
    })

    // Attach Git tooltip
    this.attachGitTooltip()

    // Attach tooltips to all other statusbar items
    this.container.querySelectorAll('.statusbar__item').forEach((item) => {
      const el = item as HTMLElement

      // Skip git item as it's handled separately
      if (el.classList.contains('statusbar__git')) return

      el.addEventListener('mouseenter', () => {
        if (!this.tooltip) return

        let content = ''
        const cl = el.classList

        if (cl.contains('statusbar__version')) {
          content = `
            <div class="rich-tooltip__header">
              <span class="rich-tooltip__title">Knowledge Hub</span>
              <span class="rich-tooltip__badge">v${this.version || '0.0.0'}</span>
            </div>
            <div class="rich-tooltip__body">
              <div class="rich-tooltip__row"> Saboor Hamedi &bull; Assistant Agent</div>
            </div>
            <div class="rich-tooltip__footer">Professional knowledge base system</div>
          `
        } else if (cl.contains('statusbar__words')) {
          content = `<div class="rich-tooltip__title">Word Count</div><div class="rich-tooltip__body">Total words in active document.</div>`
        } else if (cl.contains('statusbar__chars')) {
          content = `<div class="rich-tooltip__title">Char Count</div><div class="rich-tooltip__body">Total characters including spaces.</div>`
        } else if (cl.contains('statusbar__lines')) {
          content = `<div class="rich-tooltip__title">Line Count</div><div class="rich-tooltip__body">Total lines in the editor.</div>`
        } else if (cl.contains('statusbar__tags')) {
          const count = el.textContent?.split(' ')[0] || '0'
          content = `<div class="rich-tooltip__title">Hashtags</div><div class="rich-tooltip__body"><b>${count}</b> unique tags detected in this file.</div>`
        } else if (cl.contains('statusbar__links')) {
          const count = el.textContent?.split(' ')[0] || '0'
          content = `<div class="rich-tooltip__title">WikiLinks</div><div class="rich-tooltip__body"><b>${count}</b> internal note connections found.</div>`
        } else if (cl.contains('statusbar__mentions')) {
          const count = el.textContent?.split(' ')[0] || '0'
          content = `<div class="rich-tooltip__title">Mentions</div><div class="rich-tooltip__body"><b>${count}</b> @mentions found in the text.</div>`
        } else if (cl.contains('statusbar__cursor')) {
          content = `<div class="rich-tooltip__title">Cursor Position</div><div class="rich-tooltip__body">Current line and column in the editor.</div>`
        }

        if (content) {
          this.tooltip.setCompact(true)
          this.tooltip.show(el, content)
        }
      })

      el.addEventListener('mouseleave', () => {
        this.tooltip?.hide()
      })
    })
  }

  private updateGitInfo(): void {
    if (!this.gitBranchEl) return

    const metadata = gitService.getMetadata()
    const branchEl = this.gitBranchEl.querySelector('.statusbar__git-branch')

    if (metadata && metadata.branch) {
      this.gitBranchEl.style.display = 'flex'
      this.gitBranchEl.classList.remove('is-init-needed')
      if (branchEl) branchEl.textContent = metadata.branch
      // Remove standard title to avoid double tooltips
      this.gitBranchEl.removeAttribute('title')
    } else {
      // Not a git repo
      this.gitBranchEl.style.display = 'flex'
      this.gitBranchEl.classList.add('is-init-needed')
      if (branchEl) branchEl.textContent = 'Initialize'
      this.gitBranchEl.title = 'Click to initialize Git repository'

      // Clean listener to avoid duplicates
      const newEl = this.gitBranchEl.cloneNode(true) as HTMLElement
      this.gitBranchEl.parentNode?.replaceChild(newEl, this.gitBranchEl)
      this.gitBranchEl = newEl

      this.gitBranchEl.addEventListener('click', async () => {
        const success = await window.api.gitInit()
        if (success) {
          notificationManager.show('Git repository initialized', 'success')
          gitService.refreshStatus()
        } else {
          notificationManager.show('Failed to initialize Git', 'error')
        }
      })

      // Re-attach tooltip event listeners after cloning
      this.attachGitTooltip()
    }
  }
}
