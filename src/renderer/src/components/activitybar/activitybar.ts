import { state } from '../../core/state'
import { codicons } from '../../utils/codicons'
import './activitybar.css'

export class ActivityBar {
  private container: HTMLElement
  private onViewChange?: (view: 'notes' | 'search' | 'settings' | 'theme' | 'graph') => void
  
  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
    this.attachEvents()
  }

  setViewChangeHandler(handler: (view: 'notes' | 'search' | 'settings' | 'theme' | 'graph') => void): void {
    this.onViewChange = handler
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="activitybar__top">
        <button class="activitybar__item is-active" data-view="notes" title="Explorer">
          ${codicons.files}
        </button>
        <button class="activitybar__item" data-view="search" title="Search">
          ${codicons.search}
        </button>
        <button class="activitybar__item" data-view="graph" title="Graph View">
          <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor"><circle cx="4" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="4" r="2"/><path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
      </div>
      <div class="activitybar__bottom">
        <button class="activitybar__item" data-view="theme" title="Theme">
          ${codicons.palette}
        </button>
        <button class="activitybar__item" data-view="settings" title="Settings">
          ${codicons.settingsGear}
        </button>
      </div>
    `
  }

  private attachEvents(): void {
    this.container.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const button = target.closest('.activitybar__item') as HTMLButtonElement
      if (!button) return

      const view = button.dataset.view as 'notes' | 'search' | 'settings' | 'theme' | 'graph'
      if (!view) return

      // Do NOT set active for modal actions (theme, settings is also kinda modal but treated as view in previous logic)
      // theme is a modal popup, don't change active view status
      if (view === 'theme') {
        this.onViewChange?.(view)
        return
      }

      // Update active state
      this.container.querySelectorAll('.activitybar__item').forEach((item) => {
        item.classList.remove('is-active')
      })
      button.classList.add('is-active')

      state.activeView = view as any
      this.onViewChange?.(view)
    })
  }
}
