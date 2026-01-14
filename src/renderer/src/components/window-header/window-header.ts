import './window-header.css'

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
        <span class="window-header__title">${this.title}</span>
      </div>
      <div class="window-header__controls">
        <button class="wh-btn wh-min" title="Minimize" aria-label="Minimize">–</button>
        <button class="wh-btn wh-max" title="Maximize" aria-label="Maximize">□</button>
        <button class="wh-btn wh-close" title="Close" aria-label="Close">×</button>
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
      void window.api.window.minimize()
    })

    const updateMaxButton = async (): Promise<void> => {
      const isMax = await window.api.window.isMaximized()
      maxBtn.textContent = isMax ? '❐' : '□'
      maxBtn.title = isMax ? 'Restore' : 'Maximize'
      maxBtn.setAttribute('aria-label', isMax ? 'Restore' : 'Maximize')
    }

    maxBtn.addEventListener('click', async () => {
      const isMax = await window.api.window.isMaximized()
      if (isMax) {
        await window.api.window.unmaximize()
      } else {
        await window.api.window.maximize()
      }
      await updateMaxButton()
    })

    closeBtn.addEventListener('click', () => {
      void window.api.window.close()
    })

    // Initialize state
    void updateMaxButton()
  }
}
