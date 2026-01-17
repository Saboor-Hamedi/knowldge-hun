import { state } from '../../core/state'
import type { AppSettings } from '../../core/types'
import { codicons } from '../../utils/codicons'
import { themes } from '../../core/themes'
import './settings-view.css'

export class SettingsView {
  private container: HTMLElement
  private onSettingChange?: (settings: Partial<AppSettings>) => void
  private activeSection: string = 'editor'

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
  }

  setSettingChangeHandler(handler: (settings: Partial<AppSettings>) => void): void {
    this.onSettingChange = handler
  }

  update(): void {
    this.render()
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="settings-view">
        <aside class="settings-view__sidebar">
          <div class="settings-view__sidebar-title">Settings</div>
          <button class="settings-view__sidebar-item ${this.activeSection === 'editor' ? 'is-active' : ''}" data-section-tab="editor">
            ${codicons.edit} Editor
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'appearance' ? 'is-active' : ''}" data-section-tab="appearance">
            ${codicons.paintbrush} Appearance
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'behavior' ? 'is-active' : ''}" data-section-tab="behavior">
            ${codicons.settingsGear} Behavior
          </button>
        </aside>

        <div class="settings-view__content">
          <header class="settings-view__header">
            <h1 class="settings-view__title">Settings</h1>
            <p class="settings-view__subtitle">Configure your workspace and editor experience.</p>
          </header>

          <!-- Editor Section -->
          <div class="settings-view__section ${this.activeSection === 'editor' ? 'is-active' : ''}" data-section="editor">
            <div class="settings-view__section-header">
                <h2 class="settings-view__section-title">Editor</h2>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">Font Size</label>
              <p class="settings-field__hint">Controls the font size in pixels.</p>
              <div class="settings-field__control">
                <input
                  type="number"
                  class="settings-input"
                  data-setting="fontSize"
                  min="10"
                  max="40"
                  value="${state.settings?.fontSize || 14}"
                />
              </div>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">Line Numbers</label>
              <p class="settings-field__hint">Show or hide line numbers in the editor gutter.</p>
              <label class="settings-toggle">
                <input
                  type="checkbox"
                  data-setting="lineNumbers"
                  ${state.settings?.lineNumbers ? 'checked' : ''}
                />
                <span class="settings-toggle__slider"></span>
                <span class="settings-toggle__label">Enable line numbers</span>
              </label>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">Word Wrap</label>
              <p class="settings-field__hint">Wrap long lines to fit the editor width.</p>
              <label class="settings-toggle">
                <input
                  type="checkbox"
                  data-setting="wordWrap"
                  ${state.settings?.wordWrap ? 'checked' : ''}
                />
                <span class="settings-toggle__slider"></span>
                <span class="settings-toggle__label">Enable word wrap</span>
              </label>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">Minimap</label>
              <p class="settings-field__hint">Controls whether the minimap is shown.</p>
              <label class="settings-toggle">
                <input
                  type="checkbox"
                  data-setting="minimap"
                  ${state.settings?.minimap ? 'checked' : ''}
                />
                <span class="settings-toggle__slider"></span>
                <span class="settings-toggle__label">Show minimap</span>
              </label>
            </div>
          </div>

          <!-- Appearance Section -->
          <div class="settings-view__section ${this.activeSection === 'appearance' ? 'is-active' : ''}" data-section="appearance">
               <div class="settings-view__section-header">
                <h2 class="settings-view__section-title">Appearance</h2>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">Color Theme</label>
              <p class="settings-field__hint">Select your preferred color scheme for the entire application.</p>
              <div class="settings-field__control">
                <select class="settings-input" data-setting="theme">
                  ${Object.values(themes).map(t => `
                    <option value="${t.id}" ${state.settings?.theme === t.id ? 'selected' : ''}>${t.name}</option>
                  `).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- Behavior Section -->
          <div class="settings-view__section ${this.activeSection === 'behavior' ? 'is-active' : ''}" data-section="behavior">
            <div class="settings-view__section-header">
                <h2 class="settings-view__section-title">Behavior</h2>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">Auto Save</label>
              <p class="settings-field__hint">Automatically save your notes as you type.</p>
              <label class="settings-toggle">
                <input
                  type="checkbox"
                  data-setting="autoSave"
                  ${state.settings?.autoSave ? 'checked' : ''}
                />
                <span class="settings-toggle__slider"></span>
                <span class="settings-toggle__label">Enable Auto Save</span>
              </label>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">Auto Save Delay</label>
              <p class="settings-field__hint">Millisecond delay after your last keystroke before saving.</p>
              <div class="settings-field__control">
                <input
                  type="number"
                  class="settings-input"
                  data-setting="autoSaveDelay"
                  min="300"
                  max="10000"
                  step="100"
                  value="${state.settings?.autoSaveDelay || 800}"
                />
              </div>
            </div>

            <div class="settings-field">
              <label class="settings-field__label">DeepSeek API Key</label>
              <p class="settings-field__hint">Your DeepSeek API key for AI chat functionality. Get one at <a href="https://platform.deepseek.com" target="_blank" style="color: var(--primary);">platform.deepseek.com</a></p>
              <div class="settings-field__control">
                <input
                  type="password"
                  class="settings-input"
                  data-setting="deepseekApiKey"
                  placeholder="sk-..."
                  value="${(state.settings as any)?.deepseekApiKey || ''}"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    `
    this.attachEvents()
  }

  private attachEvents(): void {
    // Tab switching
    this.container.querySelectorAll('[data-section-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            const section = (tab as HTMLElement).dataset.sectionTab
            if (section) {
                this.activeSection = section
                this.render()
            }
        })
    })

    // Setting changes
    this.container.querySelectorAll('[data-setting]').forEach(input => {
        input.addEventListener('change', (e) => {
            const el = e.target as HTMLInputElement | HTMLSelectElement
            const setting = el.dataset.setting as keyof AppSettings
            if (!setting) return

            let value: any
            if (el instanceof HTMLInputElement && el.type === 'checkbox') {
                value = el.checked
            } else if (el instanceof HTMLInputElement && el.type === 'number') {
                value = parseInt(el.value) || 0
            } else {
                value = el.value
            }

            this.onSettingChange?.({ [setting]: value })
        })
    })
  }

  show(): void {
    this.container.style.display = 'block'
    this.render()
  }

  hide(): void {
    this.container.style.display = 'none'
  }
}
