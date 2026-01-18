import './statusbar.css'
import { VersionFetcher } from '../../utils/versionFetcher'
import { createElement, CloudUpload, CloudDownload } from 'lucide'

export class StatusBar {
  private container: HTMLElement
  private statusText: HTMLElement
  private metaText: HTMLElement
  private versionEl: HTMLElement | null = null
  private version: string | null = null

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
    this.statusText = this.container.querySelector('.statusbar__left') as HTMLElement
    const rightContainer = this.container.querySelector('.statusbar__right') as HTMLElement
    this.metaText = rightContainer?.querySelector('.statusbar__meta') as HTMLElement
    this.versionEl = rightContainer?.querySelector('.statusbar__version') as HTMLElement || null
    this.updateStatusText()
    this.attachSyncEvents()

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

  private createLucideIcon(IconComponent: any, size: number = 14): string {
    const svgElement = createElement(IconComponent, {
      size: size,
      'stroke-width': 1.5,
      stroke: 'currentColor',
      color: 'currentColor'
    })
    if (svgElement && svgElement.outerHTML) {
      return svgElement.outerHTML
    }
    return ''
  }

  private render(): void {
    const uploadIcon = this.createLucideIcon(CloudUpload, 14)
    const downloadIcon = this.createLucideIcon(CloudDownload, 14)

    this.container.innerHTML = `
      <span class="statusbar__left">Ready</span>
      <span class="statusbar__right">
        <div class="statusbar__sync">
          <button class="statusbar__sync-button" title="Sync">
            ${uploadIcon}
          </button>
          <div class="statusbar__sync-menu">
            <button class="statusbar__sync-menu-item" data-action="backup">
              <span class="statusbar__sync-menu-icon">${uploadIcon}</span>
              <span>Backup to Gist</span>
            </button>
            <button class="statusbar__sync-menu-item" data-action="restore">
              <span class="statusbar__sync-menu-icon">${downloadIcon}</span>
              <span>Restore from Gist</span>
            </button>
          </div>
        </div>
        <span class="statusbar__meta"></span>
        <span class="statusbar__version"></span>
      </span>
    `
  }

  private attachSyncEvents(): void {
    const syncButton = this.container.querySelector('.statusbar__sync-button') as HTMLElement
    const syncMenu = this.container.querySelector('.statusbar__sync-menu') as HTMLElement
    const menuItems = this.container.querySelectorAll('.statusbar__sync-menu-item')

    if (syncButton && syncMenu) {
      // Remove any existing listeners to avoid duplicates
      const newButton = syncButton.cloneNode(true) as HTMLElement
      syncButton.parentNode?.replaceChild(newButton, syncButton)

      newButton.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        syncMenu.classList.toggle('is-open')
      })

      syncMenu.addEventListener('click', (e) => {
        e.stopPropagation()
      })

      // Close menu when clicking outside (only attach once)
      if (!(syncMenu as any).__clickOutsideAttached) {
        const handleClickOutside = (e: MouseEvent) => {
          if (!syncMenu.contains(e.target as Node) && !newButton.contains(e.target as Node)) {
            syncMenu.classList.remove('is-open')
          }
        }
        document.addEventListener('click', handleClickOutside)
        ;(syncMenu as any).__clickOutsideAttached = true
      }
    }

    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        const action = (item as HTMLElement).dataset.action
        if (action === 'backup' || action === 'restore') {
          this.container.dispatchEvent(new CustomEvent('sync-action', { detail: { action }, bubbles: true }))
        }
        syncMenu.classList.remove('is-open')
      })
    })
  }

  private updateStatusText(): void {
    // Keep the main status text (left) for runtime messages and
    // always display the app version in the dedicated version element.
    if (this.versionEl) {
      this.versionEl.textContent = this.version ? `v${this.version}` : ''
    }
  }

  setStatus(text: string): void {
    if (this.statusText) {
      this.statusText.textContent = text
    }
  }

  setMeta(text: string): void {
    if (this.metaText) {
      this.metaText.textContent = text
    }
  }
}
