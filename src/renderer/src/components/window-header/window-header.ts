import './window-header.css'
import { codicons } from '../../utils/codicons'

interface ElectronAPI {
  window: {
    minimize: () => void
    maximize: () => void
    unmaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }
}

export class WindowHeader {
  private container: HTMLElement
  private title: string

  constructor(containerId: string, title = 'Knowledge Hub') {
    this.container = document.getElementById(containerId) as HTMLElement
    this.title = title
    this.mount()
    this.attachEvents()
  }

  private mount(): void {
    const header = document.createElement('div')
    header.className = 'window-header'
    header.innerHTML = `
      <div class="window-header__brand">
        <span class="window-header__logo" style="margin-right: 8px; color: var(--text-soft); display: flex; align-items: center;">
          ${codicons.fileCode}
        </span>
        <span class="window-header__title">${this.title}</span>
      </div>
      <div class="window-header__controls">
        <button class="wh-btn wh-min" title="Minimize" aria-label="Minimize">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button class="wh-btn wh-max" title="Maximize" aria-label="Maximize">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>
        </button>
        <button class="wh-btn wh-close" title="Close" aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `
    // Insert at the very top of the container
    this.container.insertAdjacentElement('afterbegin', header)
  }

  private attachEvents(): void {
    const header = this.container.querySelector('.window-header') as HTMLElement
    const minBtn = header.querySelector('.wh-min') as HTMLButtonElement
    const maxBtn = header.querySelector('.wh-max') as HTMLButtonElement
    const closeBtn = header.querySelector('.wh-close') as HTMLButtonElement

    minBtn.addEventListener('click', () => {
      const api = (window as unknown as { api: ElectronAPI }).api
      if (api?.window?.minimize) api.window.minimize()
    })

    const updateMaxButton = async (): Promise<void> => {
      const api = (window as unknown as { api: ElectronAPI }).api
      if (api?.window?.isMaximized) {
        const isMax = await api.window.isMaximized()
        maxBtn.title = isMax ? 'Restore' : 'Maximize'
      }
    }

    maxBtn.addEventListener('click', async () => {
      const api = (window as unknown as { api: ElectronAPI }).api
      if (api?.window) {
        const isMax = await api.window.isMaximized()
        if (isMax) {
          await api.window.unmaximize()
        } else {
          await api.window.maximize()
        }
        await updateMaxButton()
      }
    })

    closeBtn.addEventListener('click', () => {
      const api = (window as unknown as { api: ElectronAPI }).api
      if (api?.window?.close) api.window.close()
    })

    // Initialize state
    void updateMaxButton()
  }
}
