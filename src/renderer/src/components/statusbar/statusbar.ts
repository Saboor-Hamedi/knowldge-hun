import './statusbar.css'
import { VersionFetcher } from '../../utils/versionFetcher'
import { createElement, CloudUpload, CloudDownload, RefreshCw } from 'lucide'
import { state } from '../../core/state'
import { ContextMenu } from '../contextmenu/contextmenu'

export class StatusBar {
  private container: HTMLElement
  private statusText: HTMLElement
  private metaText: HTMLElement
  private version: string | null = null
  private statusTimeout: NodeJS.Timeout | null = null
  private contextMenu: ContextMenu

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.contextMenu = new ContextMenu()
    this.render()
    this.statusText = this.container.querySelector('.statusbar__left') as HTMLElement
    const rightContainer = this.container.querySelector('.statusbar__right') as HTMLElement
    this.metaText = rightContainer?.querySelector('.statusbar__meta') as HTMLElement
    this.updateStatusText()
    this.attachSyncEvents()
    this.initContextMenu()
    this.updateVisibility()

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
    const svgElement = createElement(IconComponent as any, {
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
      <span class="statusbar__left statusbar__item statusbar__version"></span>
      <span class="statusbar__right">
        <span class="statusbar__item statusbar__words" style="visibility: hidden;"></span>
        <span class="statusbar__item statusbar__chars" style="visibility: hidden;"></span>
        <span class="statusbar__item statusbar__lines" style="visibility: hidden;"></span>
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
      e.stopPropagation()

      const s = state.settings?.statusbar || {
        words: true,
        chars: true,
        lines: true,
        cursor: true,
        sync: true,
        version: true
      }

      this.contextMenu.show(e.clientX, e.clientY, [
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
      cursor: true,
      sync: true,
      version: true
    }

    const updated = {
      ...current,
      [key]: !((current as Record<string, boolean | undefined>)[key] !== false)
    }

    state.settings = {
      ...state.settings!,
      statusbar: updated
    }

    await window.api.updateSettings({ statusbar: updated } as any)
    this.updateVisibility()
  }

  public updateVisibility(): void {
    const s = state.settings?.statusbar || {
      words: true,
      chars: true,
      lines: true,
      cursor: true,
      sync: true,
      version: true
    }

    const wordsEl = this.container.querySelector('.statusbar__words') as HTMLElement
    const charsEl = this.container.querySelector('.statusbar__chars') as HTMLElement
    const linesEl = this.container.querySelector('.statusbar__lines') as HTMLElement
    const cursorEl = this.container.querySelector('.statusbar__cursor') as HTMLElement
    const syncEl = this.container.querySelector('.statusbar__sync') as HTMLElement
    const versionEl = this.container.querySelector('.statusbar__version') as HTMLElement

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
  }

  setMetrics(metrics: { words: number; chars: number; lines: number } | null): void {
    const wordsEl = this.container.querySelector('.statusbar__words')
    const charsEl = this.container.querySelector('.statusbar__chars')
    const linesEl = this.container.querySelector('.statusbar__lines')

    if (!metrics) {
      if (wordsEl) wordsEl.textContent = ''
      if (charsEl) charsEl.textContent = ''
      if (linesEl) linesEl.textContent = ''
      return
    }

    if (wordsEl) wordsEl.textContent = `Words ${metrics.words}`
    if (charsEl) charsEl.textContent = `Chars ${metrics.chars}`
    if (linesEl) linesEl.textContent = `Lines ${metrics.lines}`
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
    const menuItems = this.container.querySelectorAll('.statusbar__sync-menu-item')

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
          this.container.dispatchEvent(
            new CustomEvent('sync-action', { detail: { action }, bubbles: true })
          )
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
}
