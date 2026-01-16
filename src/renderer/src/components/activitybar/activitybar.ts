import { state } from '../../core/state'
import { codicons } from '../../utils/codicons'
import { updateApp } from '../updateApp/updateApp'
import './activitybar.css'

export class ActivityBar {
  private container: HTMLElement
  private onViewChange?: (view: 'notes' | 'search' | 'settings' | 'theme' | 'graph' | null) => void
  private updateState: 'idle' | 'checking' | 'progress' | 'restart' = 'idle'
  private updateProgress: number = 0
  
  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
    this.attachEvents()
    updateApp.onStateChange((state, progress) => {
      this.updateState = state
      this.updateProgress = progress
      this.render()
    })
  }

  setViewChangeHandler(
    handler: (view: 'notes' | 'search' | 'settings' | 'theme' | 'graph' | null) => void
  ): void {
    this.onViewChange = handler
  }

  private render(): void {
    let updateIcon = ''
    if (this.updateState === 'idle') {
      // Use a circular refresh icon for update (more like VS Code)
      updateIcon = codicons.refresh
        ? codicons.refresh
        : `<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M7.5 1v3.5L4 1v3.5c0 1.93 1.57 3.5 3.5 3.5h1c1.93 0 3.5-1.57 3.5-3.5V1L8.5 4.5V1h-1zm0 14v-3.5L11 15v-3.5c0-1.93-1.57-3.5-3.5-3.5h-1C4.57 8 3 9.57 3 11.5V15l3.5-3.5V15h1z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`
    } else if (this.updateState === 'checking') {
      // Use a circular target/spinner icon for checking
      updateIcon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="#0078d4" stroke-width="2" fill="none" opacity="0.2"/><circle cx="10" cy="10" r="8" stroke="#0078d4" stroke-width="2" fill="none" stroke-dasharray="50.24" stroke-dashoffset="10" style="transform-origin:center;animation:activitybar-spin 1s linear infinite;"/><circle cx="10" cy="10" r="4" stroke="#0078d4" stroke-width="1.5" fill="none"/></svg>`
      // Add spinner animation for activitybar (top-level, once)
      ;(function injectActivitybarSpinnerStyle() {
        const styleId = 'activitybar-spinner-style'
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style')
          style.id = styleId
          style.innerHTML = `@keyframes activitybar-spin { 100% { transform: rotate(360deg); } }`
          document.head.appendChild(style)
        }
      })()
    } else if (this.updateState === 'progress') {
      // Progress: circular progress bar
      const percent = Math.round(this.updateProgress)
      updateIcon = `<svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" stroke="#888" stroke-width="2" fill="none"/>
        <circle cx="10" cy="10" r="8" stroke="#0078d4" stroke-width="2" fill="none"
          stroke-dasharray="${Math.PI * 2 * 8}"
          stroke-dashoffset="${Math.PI * 2 * 8 * (1 - percent / 100)}"
          style="transition: stroke-dashoffset 0.2s"/>
        <text x="10" y="14" text-anchor="middle" font-size="8" fill="#0078d4">${percent}%</text>
      </svg>`
    } else if (this.updateState === 'restart') {
      // Restart icon
      updateIcon = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2v4M10 14v4M4.93 4.93l-2.83-2.83M17.9 17.9l-2.83-2.83M2 10h4M14 10h4M4.93 15.07l-2.83 2.83M17.9 2.1l-2.83 2.83" stroke="#0078d4" stroke-width="1.5"/>
        <circle cx="10" cy="10" r="8" stroke="#0078d4" stroke-width="1.5" fill="none"/>
      </svg>`
    }
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
        <button class="activitybar__item" data-view="update" title="Update">
          <span class="activitybar__icon">${updateIcon}</span>
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

      const view = button.dataset.view as
        | 'notes'
        | 'search'
        | 'settings'
        | 'theme'
        | 'graph'
        | 'update'
      if (!view) return

      if (view === 'update') {
        if (this.updateState === 'restart') {
          updateApp.checkForUpdate() // restart handled by updater
        } else if (this.updateState === 'progress') {
          // Do nothing, update is downloading
        } else {
          updateApp.checkForUpdate()
        }
        return
      }

      // Do NOT set active for modal actions (theme, settings is also kinda modal but treated as view in previous logic)
      if (view === 'theme') {
        this.onViewChange?.(view)
        return
      }

      // Toggle behavior: if already active, deactivate and close sidebar
      if (button.classList.contains('is-active')) {
        button.classList.remove('is-active')
        state.activeView = 'notes'
        this.onViewChange?.(null)
        return
      }

      // Update active state
      this.container.querySelectorAll('.activitybar__item').forEach((item) => {
        item.classList.remove('is-active')
      })
      button.classList.add('is-active')

      state.activeView = view as typeof state.activeView
      this.onViewChange?.(view)
    })
  }

}
