import './statusbar.css'
import { VersionFetcher } from '../../utils/versionFetcher'

export class StatusBar {
  private container: HTMLElement
  private statusText: HTMLElement
  private metaText: HTMLElement
  private version: string | null = null

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
    this.statusText = this.container.querySelector('.statusbar__left') as HTMLElement
    this.metaText = this.container.querySelector('.statusbar__right') as HTMLElement
    this.updateStatusText()

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

  private render(): void {
    this.container.innerHTML = `
      <span class="statusbar__left">Ready</span>
      <span class="statusbar__right"></span>
    `
  }

  private updateStatusText(): void {
    this.statusText.textContent = this.version ? `v${this.version}` : 'Ready'
  }

  setStatus(text: string): void {
    this.metaText.textContent = text
  }

  setMeta(text: string): void {
    this.metaText.textContent = text
  }
}
