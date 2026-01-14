import './statusbar.css'

export class StatusBar {
  private container: HTMLElement
  private statusText: HTMLElement
  private metaText: HTMLElement

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
    this.statusText = this.container.querySelector('.statusbar__left') as HTMLElement
    this.metaText = this.container.querySelector('.statusbar__right') as HTMLElement
  }

  private render(): void {
    this.container.innerHTML = `
      <span class="statusbar__left">Ready</span>
      <span class="statusbar__right"></span>
    `
  }

  setStatus(text: string): void {
    this.statusText.textContent = text
  }

  setMeta(text: string): void {
    this.metaText.textContent = text
  }
}
