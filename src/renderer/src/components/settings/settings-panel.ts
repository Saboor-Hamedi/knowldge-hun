import { state } from '../../core/state'
import type { AppSettings } from '../../core/types'
import { codicons } from '../../utils/codicons'
import { themes } from '../../core/themes'
import './settings-panel.css'

export class SettingsPanel {
  private container: HTMLElement
  private isOpen = false
  private currentSettings: Partial<AppSettings> = {}
  private onSettingChange?: (settings: Partial<AppSettings>) => void

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
  }

  setSettingChangeHandler(handler: (settings: Partial<AppSettings>) => void): void {
    this.onSettingChange = handler
  }

  open(): void {
    if (this.isOpen) return
    if (!state.settings) return

    this.isOpen = true
    this.currentSettings = { ...state.settings }
    this.updateUI()
    this.container.classList.add('settings-panel--open')
    this.attachEventListeners()
  }

  close(): void {
    this.isOpen = false
    this.container.classList.remove('settings-panel--open')
    this.currentSettings = {}
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="settings-panel__overlay"></div>
      <div class="settings-panel__content">
        <div class="settings-panel__header">
          <div class="settings-panel__header-top">
            <div class="settings-panel__brand">
              ${codicons.settingsGear}
              <h2 class="settings-panel__title">Settings</h2>
            </div>
            <button class="settings-panel__close" aria-label="Close settings">
              ${codicons.close}
            </button>
          </div>
          <div class="settings-panel__tabs">
            <button class="settings-panel__tab is-active" data-tab="editor">
              ${codicons.edit} <span>Editor</span>
            </button>
            <button class="settings-panel__tab" data-tab="appearance">
              ${codicons.paintbrush} <span>Appearance</span>
            </button>
            <button class="settings-panel__tab" data-tab="behavior">
              ${codicons.settingsGear} <span>Behavior</span>
            </button>
          </div>
        </div>

        <div class="settings-panel__body">
          <!-- Editor Tab -->
          <div class="settings-panel__section is-active" data-section="editor">
            <h3 class="settings-panel__section-title">Editor Settings</h3>
            
            <div class="settings-field">
              <label class="settings-field__label">Font Size</label>
              <div class="settings-field__input-group">
                <input 
                  type="number" 
                  class="settings-field__input" 
                  data-setting="fontSize"
                  min="10"
                  max="24"
                  value="14"
                />
                <span class="settings-field__unit">px</span>
              </div>
              <p class="settings-field__hint">Range: 10-24px</p>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">Line Numbers</label>
              <label class="settings-field__checkbox">
                <input 
                  type="checkbox" 
                  class="settings-field__checkbox-input" 
                  data-setting="lineNumbers"
                  checked
                />
                <span class="settings-field__checkbox-label">Show line numbers</span>
              </label>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">Word Wrap</label>
              <label class="settings-field__checkbox">
                <input 
                  type="checkbox" 
                  class="settings-field__checkbox-input" 
                  data-setting="wordWrap"
                  checked
                />
                <span class="settings-field__checkbox-label">Wrap long lines</span>
              </label>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">Minimap</label>
              <label class="settings-field__checkbox">
                <input 
                  type="checkbox" 
                  class="settings-field__checkbox-input" 
                  data-setting="minimap"
                />
                <span class="settings-field__checkbox-label">Show minimap</span>
              </label>
            </div>
          </div>

          <!-- Appearance Tab -->
          <div class="settings-panel__section" data-section="appearance">
            <h3 class="settings-panel__section-title">Appearance</h3>
            
            <div class="settings-field">
              <label class="settings-field__label">Theme</label>
              <select class="settings-field__input" data-setting="theme">
                ${Object.values(themes).map(theme => `
                  <option value="${theme.id}">${theme.name}</option>
                `).join('')}
              </select>
            </div>

            <div class="settings-info">
              <p>Select a theme to customize the look and feel.</p>
            </div>
          </div>

          <!-- Behavior Tab -->
          <div class="settings-panel__section" data-section="behavior">
            <h3 class="settings-panel__section-title">Behavior Settings</h3>
            
            <div class="settings-field">
              <label class="settings-field__label">Auto-save</label>
              <label class="settings-field__checkbox">
                <input 
                  type="checkbox" 
                  class="settings-field__checkbox-input" 
                  data-setting="autoSave"
                  checked
                />
                <span class="settings-field__checkbox-label">Save files automatically</span>
              </label>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">Auto-save Delay</label>
              <div class="settings-field__input-group">
                <input 
                  type="number" 
                  class="settings-field__input" 
                  data-setting="autoSaveDelay"
                  min="300"
                  max="5000"
                  step="100"
                  value="800"
                />
                <span class="settings-field__unit">ms</span>
              </div>
              <p class="settings-field__hint">Range: 300-5000ms. Delay after typing before auto-saving</p>
            </div>
          </div>
        </div>

        <div class="settings-panel__footer">
          <button class="settings-button settings-button--secondary" data-action="reset">
            Reset to Defaults
          </button>
          <div class="settings-panel__footer-actions">
            <button class="settings-button settings-button--ghost" data-action="cancel">
              Cancel
            </button>
            <button class="settings-button settings-button--primary" data-action="save">
              Save
            </button>
          </div>
        </div>
      </div>
    `
  }

  private updateUI(): void {
    if (!state.settings) return

    // Update all input fields
    const inputs = this.container.querySelectorAll('[data-setting]')
    inputs.forEach((input: Element) => {
      const setting = (input as HTMLInputElement).dataset.setting
      if (!setting) return

      const value = state.settings?.[setting as keyof AppSettings]
      
      if ((input as HTMLInputElement).type === 'checkbox') {
        (input as HTMLInputElement).checked = Boolean(value)
      } else if ((input as HTMLInputElement).type === 'number') {
        (input as HTMLInputElement).value = String(value || 0)
      } else {
        (input as HTMLInputElement).value = String(value || '')
      }
    })
  }

  private attachEventListeners(): void {
    // Tab switching
    this.container.querySelectorAll('.settings-panel__tab').forEach((tab) => {
      tab.addEventListener('click', (e) => this.switchTab(e.target as HTMLElement))
    })

    // Input changes
    this.container.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener('change', (e) => this.handleSettingChange(e.target as HTMLInputElement))
      input.addEventListener('input', (e) => this.handleSettingChange(e.target as HTMLInputElement))
    })

    // Action buttons
    this.container.querySelector('[data-action="close"]')?.addEventListener('click', () => this.close())
    this.container.querySelector('[data-action="cancel"]')?.addEventListener('click', () => this.close())
    this.container.querySelector('[data-action="save"]')?.addEventListener('click', () => this.save())
    this.container.querySelector('[data-action="reset"]')?.addEventListener('click', () => this.reset())

    // Close button in header
    this.container.querySelector('.settings-panel__close')?.addEventListener('click', () => this.close())

    // Close on overlay click
    this.container.querySelector('.settings-panel__overlay')?.addEventListener('click', () => this.close())

    // Prevent close on content click
    this.container.querySelector('.settings-panel__content')?.addEventListener('click', (e) => {
      e.stopPropagation()
    })

    // ESC key to close
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close()
        document.removeEventListener('keydown', escHandler)
      }
    }
    document.addEventListener('keydown', escHandler)
  }

  private switchTab(tabElement: HTMLElement): void {
    const tabName = tabElement.dataset.tab
    if (!tabName) return

    // Update active tab
    this.container.querySelectorAll('.settings-panel__tab').forEach((t) => {
      t.classList.remove('is-active')
    })
    tabElement.classList.add('is-active')

    // Update active section
    this.container.querySelectorAll('.settings-panel__section').forEach((s) => {
      s.classList.remove('is-active')
    })
    const section = this.container.querySelector(`[data-section="${tabName}"]`)
    if (section) section.classList.add('is-active')
  }

  private handleSettingChange(input: HTMLInputElement): void {
    const setting = input.dataset.setting as keyof AppSettings
    if (!setting) return

    let value: any
    if (input.type === 'checkbox') {
      value = input.checked
    } else if (input.type === 'number') {
      value = parseInt(input.value) || 0
    } else {
      value = input.value
    }

    this.currentSettings[setting] = value
  }

  private async save(): Promise<void> {
    try {
      const updated = await window.api.updateSettings(this.currentSettings)
      state.settings = updated
      this.onSettingChange?.(this.currentSettings)
      this.close()
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert(`Failed to save settings: ${(error as Error).message}`)
    }
  }

  private async reset(): Promise<void> {
    if (!confirm('Reset all settings to defaults?')) return

    try {
      const defaults = await window.api.resetSettings()
      state.settings = defaults
      this.currentSettings = { ...defaults }
      this.updateUI()
      this.onSettingChange?.(defaults)
    } catch (error) {
      console.error('Failed to reset settings:', error)
      alert(`Failed to reset settings: ${(error as Error).message}`)
    }
  }
}
