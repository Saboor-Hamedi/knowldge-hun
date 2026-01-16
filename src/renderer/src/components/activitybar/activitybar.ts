import { state } from '../../core/state'
import { codicons } from '../../utils/codicons'
import './activitybar.css'

export class ActivityBar {
  private container: HTMLElement
  private onViewChange?: (view: 'notes' | 'search' | 'settings' | 'theme' | 'graph' | null) => void
  
  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
    this.attachEvents()
  }

  setViewChangeHandler(handler: (view: 'notes' | 'search' | 'settings' | 'theme' | 'graph' | null) => void): void {
    this.onViewChange = handler
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="activitybar__top">
        <button class="activitybar__item is-active" data-view="notes" title="Explorer">
          <span class="activitybar__icon">${codicons.files}</span>
        </button>
        <button class="activitybar__item" data-view="search" title="Search">
          <span class="activitybar__icon">${codicons.search}</span>
        </button>
        <button class="activitybar__item" data-view="graph" title="Graph View">
          <span class="activitybar__icon">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <circle cx="4" cy="4" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <circle cx="12" cy="4" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
          </span>
        </button>
      </div>
      <div class="activitybar__bottom">
        <button class="activitybar__item" data-view="theme" title="Theme">
          <span class="activitybar__icon">${codicons.palette}</span>
        </button>
        <button class="activitybar__item" data-view="settings" title="Settings">
          <span class="activitybar__icon">${codicons.settingsGear}</span>
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

      // Toggle behavior: if already active, deactivate and close sidebar
      if (button.classList.contains('is-active')) {
        button.classList.remove('is-active')
        state.activeView = 'notes' // Default or fallback? Or we should probably not change state or set it to something else?
        // Actually state.activeView type is limited. Let's just emit null.
        this.onViewChange?.(null)
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
