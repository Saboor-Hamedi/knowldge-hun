import { state } from '../../core/state'
import type { AppSettings } from '../../core/types'
import { codicons } from '../../utils/codicons'
import { themes } from '../../core/themes'
import { vaultService } from '../../services/vaultService'
import type { VaultInfo } from '../../services/vaultService'
import { notificationManager } from '../notification/notification'
import {
  createElement,
  CloudUpload,
  CloudDownload,
  Github,
  Key,
  ListOrdered,
  WrapText,
  Scan,
  FolderSync,
  FolderOpen,
  PlusCircle,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Type,
  Palette,
  Timer,
  Save,
  Sparkles,
  Zap,
  Cpu
} from 'lucide'
import { renderShortcutItems } from '../../utils/shortcutUtils'
import { SecuritySection } from '../security/security-section'
import './settings-view.css'

export interface VaultSettingsCallbacks {
  onVaultChange: () => Promise<void>
  onVaultReveal: () => Promise<void>
  onVaultSelected: (path: string) => Promise<void>
  onVaultLocated: (originalPath: string, newPath: string) => Promise<void>
}

export class SettingsView {
  private container: HTMLElement
  private onSettingChange?: (settings: Partial<AppSettings>) => void
  private vaultCallbacks?: VaultSettingsCallbacks
  private activeSection: string = 'editor'
  private recentVaults: VaultInfo[] = []
  private searchQuery: string = ''
  private searchTimeout?: number
  private securitySection: SecuritySection

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.securitySection = new SecuritySection()

    this.render()
  }

  setSettingChangeHandler(handler: (settings: Partial<AppSettings>) => void): void {
    this.onSettingChange = handler
  }

  setVaultCallbacks(callbacks: VaultSettingsCallbacks): void {
    this.vaultCallbacks = callbacks
  }

  update(): void {
    this.render()
  }

  private createLucideIcon(IconComponent: any, size: number = 16): string {
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

  // create the settings view HTML ->tab
  private render(): void {
    // Restore active section from settings if available
    if (state.settings?.activeSettingsSection) {
      this.activeSection = state.settings.activeSettingsSection
    }

    this.container.innerHTML = `
      <div class="settings-view">
        <aside class="settings-view__sidebar">
          <div class="settings-view__sidebar-title">Settings</div>
          <button class="settings-view__sidebar-item ${this.activeSection === 'editor' ? 'is-active' : ''}" data-section-tab="editor">
            ${codicons.edit} Editor
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'editor-options' ? 'is-active' : ''}" data-section-tab="editor-options">
            ${codicons.settingsGear} Editor Options
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'appearance' ? 'is-active' : ''}" data-section-tab="appearance">
            ${codicons.paintbrush} Appearance
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'behavior' ? 'is-active' : ''}" data-section-tab="behavior">
            ${codicons.settingsGear} Behavior
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'ai' ? 'is-active' : ''}" data-section-tab="ai">
            ${codicons.sparkles} AI
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'vault' ? 'is-active' : ''}" data-section-tab="vault">
            ${codicons.folderRoot} Vault
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'sync' ? 'is-active' : ''}" data-section-tab="sync">
            ${this.createLucideIcon(CloudUpload, 16)} Sync
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'shortcuts' ? 'is-active' : ''}" data-section-tab="shortcuts">
            ${codicons.keyboard} Shortcuts
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'security' ? 'is-active' : ''}" data-section-tab="security">
            ${codicons.lock} Security
          </button>
        </aside>

        <div class="settings-view__content">

          <!-- Search Bar -->
          <div class="settings-search">
            <input
              type="text"
              class="settings-search__input"
              placeholder="Search settings..."
              value="${this.searchQuery}"
            />
          </div>

          <!-- Editor Section -->
          <div class="settings-view__section ${this.activeSection === 'editor' ? 'is-active' : ''}" data-section="editor">
            <div class="settings-view__section-header">
                <h2 class="settings-view__section-title">Typography & Display</h2>
            </div>

            <div class="settings-list">
              <!-- Font Size -->
              <div class="settings-row" data-search="font size controls the editor font size px">
                <div class="settings-row__icon">${this.createLucideIcon(Type, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Font Size</label>
                  <p class="settings-row__hint">Adjust the primary display size for your notes (px).</p>
                </div>
                <div class="settings-row__action">
                  <input type="number" class="settings-input" data-setting="fontSize" min="10" max="40" value="${state.settings?.fontSize || 14}" style="width: 80px;" />
                </div>
              </div>

              <!-- Caret Width -->
              <div class="settings-row" data-search="caret width set the max width for the editor caret">
                <div class="settings-row__icon">${this.createLucideIcon(Scan, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Caret Thickness</label>
                  <p class="settings-row__hint">Set the width of the editor's insertion point cursor.</p>
                </div>
                <div class="settings-row__action">
                  <input type="number" class="settings-input" data-setting="caretMaxWidth" min="1" max="10" value="${state.settings?.caretMaxWidth ?? 2}" style="width: 80px;" />
                </div>
              </div>
            </div>
          </div>

          <!-- Editor Options Section -->
          <div class="settings-view__section ${this.activeSection === 'editor-options' ? 'is-active' : ''}" data-section="editor-options">
            <div class="settings-view__section-header">
                <h2 class="settings-view__section-title">Editor Experience</h2>
            </div>

            <div class="settings-list">
              <!-- Caret Toggle -->
              <div class="settings-row" data-search="caret show or hide the editor caret">
                <div class="settings-row__icon">${this.createLucideIcon(Eye, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Caret Visibility</label>
                  <p class="settings-row__hint">Toggle the high-visibility focus cursor in the editor.</p>
                </div>
                <div class="settings-row__action">
                  <label class="settings-toggle">
                    <input type="checkbox" data-setting="caretEnabled" ${state.settings?.caretEnabled ? 'checked' : ''} />
                    <span class="settings-toggle__slider"></span>
                  </label>
                </div>
              </div>

              <!-- Line Numbers -->
              <div class="settings-row" data-search="line numbers show or hide the line numbers in the gutter">
                <div class="settings-row__icon">${this.createLucideIcon(ListOrdered, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Line Numbers</label>
                  <p class="settings-row__hint">Display indices on the left gutter for better navigation.</p>
                </div>
                <div class="settings-row__action">
                  <label class="settings-toggle">
                    <input type="checkbox" data-setting="lineNumbers" ${state.settings?.lineNumbers ? 'checked' : ''} />
                    <span class="settings-toggle__slider"></span>
                  </label>
                </div>
              </div>

              <!-- Word Wrap -->
              <div class="settings-row" data-search="word wrap wrap long lines to fit the editor width">
                <div class="settings-row__icon">${this.createLucideIcon(WrapText, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Word Wrap</label>
                  <p class="settings-row__hint">Soft-wrap long lines to fit within the editor's horizontal bounds.</p>
                </div>
                <div class="settings-row__action">
                  <label class="settings-toggle">
                    <input type="checkbox" data-setting="wordWrap" ${state.settings?.wordWrap ? 'checked' : ''} />
                    <span class="settings-toggle__slider"></span>
                  </label>
                </div>
              </div>

              <!-- Minimap -->
              <div class="settings-row" data-search="minimap show the minimap for quick navigation">
                <div class="settings-row__icon">${this.createLucideIcon(Scan, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Code Minimap</label>
                  <p class="settings-row__hint">Show a high-level overview scrollbar on the far right.</p>
                </div>
                <div class="settings-row__action">
                  <label class="settings-toggle">
                    <input type="checkbox" data-setting="minimap" ${state.settings?.minimap ? 'checked' : ''} />
                    <span class="settings-toggle__slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Appearance Section -->
          <div class="settings-view__section ${this.activeSection === 'appearance' ? 'is-active' : ''}" data-section="appearance">
               <div class="settings-view__section-header">
                <h2 class="settings-view__section-title">Interface Customization</h2>
            </div>

            <div class="settings-list">
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(Palette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Color Theme</label>
                  <p class="settings-row__hint">Choose an aesthetic that matches your workflow and mood.</p>
                </div>
                <div class="settings-row__action">
                  <select class="settings-input" data-setting="theme" style="width: 140px;">
                    ${Object.values(themes)
                      .map(
                        (t) => `
                      <option value="${t.id}" ${state.settings?.theme === t.id ? 'selected' : ''}>${t.name}</option>
                    `
                      )
                      .join('')}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Behavior Section -->
          <div class="settings-view__section ${this.activeSection === 'behavior' ? 'is-active' : ''}" data-section="behavior">
            <div class="settings-view__section-header">
                <h2 class="settings-view__section-title">Application Behavior</h2>
            </div>

            <div class="settings-list">
              <!-- Auto Save Toggle -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(Save, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Persistence Mode</label>
                  <p class="settings-row__hint">Automatically commit changes to your vault as you type.</p>
                </div>
                <div class="settings-row__action">
                  <label class="settings-toggle">
                    <input type="checkbox" data-setting="autoSave" ${state.settings?.autoSave ? 'checked' : ''} />
                    <span class="settings-toggle__slider"></span>
                  </label>
                </div>
              </div>

              <!-- Auto Save Delay -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(Timer, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Save Throttle</label>
                  <p class="settings-row__hint">Delay (ms) before triggering the auto-save sequence.</p>
                </div>
                <div class="settings-row__action">
                  <input type="number" class="settings-input" data-setting="autoSaveDelay" min="300" max="10000" step="100" value="${state.settings?.autoSaveDelay || 800}" style="width: 80px;" />
                </div>
              </div>
            </div>
          </div>

          <!-- AI Section -->
          <div class="settings-view__section ${this.activeSection === 'ai' ? 'is-active' : ''}" data-section="ai">
            <div class="settings-view__section-header">
                <h2 class="settings-view__section-title">Intelligent Features</h2>
            </div>

            <div class="settings-list">
              <!-- AI Provider -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(Zap, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Primary Engine</label>
                  <p class="settings-row__hint">Select which intelligence service powers your AI features.</p>
                </div>
                <div class="settings-row__action" style="flex: 1; max-width: 250px;">
                  <select class="settings-input" data-setting="aiProvider">
                    <option value="deepseek" ${state.settings?.aiProvider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                    <option value="openai" ${state.settings?.aiProvider === 'openai' ? 'selected' : ''}>OpenAI (GPT-4o)</option>
                    <option value="claude" ${state.settings?.aiProvider === 'claude' ? 'selected' : ''}>Anthropic Claude</option>
                    <option value="grok" ${state.settings?.aiProvider === 'grok' ? 'selected' : ''}>xAI Grok</option>
                    <option value="ollama" ${state.settings?.aiProvider === 'ollama' ? 'selected' : ''}>Ollama (Local)</option>
                  </select>
                </div>
              </div>

              <!-- Provider Specific Keys -->
              <!-- DeepSeek -->
              <div class="settings-ai-provider-group" style="display: ${state.settings?.aiProvider === 'deepseek' || !state.settings?.aiProvider ? 'block' : 'none'}">
                <div class="settings-row">
                  <div class="settings-row__icon">${this.createLucideIcon(Key, 18)}</div>
                  <div class="settings-row__info">
                    <label class="settings-row__label">DeepSeek Token</label>
                    <p class="settings-row__hint">Secure access key from platform.deepseek.com</p>
                  </div>
                  <div class="settings-row__action" style="flex: 1; max-width: 250px;">
                    <input type="password" class="settings-input" data-setting="deepseekApiKey" placeholder="sk-..." value="${state.settings?.deepseekApiKey || ''}" />
                  </div>
                </div>
              </div>

              <!-- OpenAI -->
              <div class="settings-ai-provider-group" style="display: ${state.settings?.aiProvider === 'openai' ? 'block' : 'none'}">
                <div class="settings-row">
                  <div class="settings-row__icon">${this.createLucideIcon(Key, 18)}</div>
                  <div class="settings-row__info">
                    <label class="settings-row__label">OpenAI Token</label>
                    <p class="settings-row__hint">Secure access key from platform.openai.com</p>
                  </div>
                  <div class="settings-row__action" style="flex: 1; max-width: 250px;">
                    <input type="password" class="settings-input" data-setting="openaiApiKey" placeholder="sk-..." value="${state.settings?.openaiApiKey || ''}" />
                  </div>
                </div>
              </div>

              <!-- Claude -->
              <div class="settings-ai-provider-group" style="display: ${state.settings?.aiProvider === 'claude' ? 'block' : 'none'}">
                <div class="settings-row">
                  <div class="settings-row__icon">${this.createLucideIcon(Key, 18)}</div>
                  <div class="settings-row__info">
                    <label class="settings-row__label">Anthropic Token</label>
                    <p class="settings-row__hint">Secure access key from console.anthropic.com</p>
                  </div>
                  <div class="settings-row__action" style="flex: 1; max-width: 250px;">
                    <input type="password" class="settings-input" data-setting="claudeApiKey" placeholder="sk-ant-..." value="${state.settings?.claudeApiKey || ''}" />
                  </div>
                </div>
              </div>

              <!-- Grok -->
              <div class="settings-ai-provider-group" style="display: ${state.settings?.aiProvider === 'grok' ? 'block' : 'none'}">
                <div class="settings-row">
                  <div class="settings-row__icon">${this.createLucideIcon(Key, 18)}</div>
                  <div class="settings-row__info">
                    <label class="settings-row__label">xAI Token</label>
                    <p class="settings-row__hint">Secure access key from console.x.ai</p>
                  </div>
                  <div class="settings-row__action" style="flex: 1; max-width: 250px;">
                    <input type="password" class="settings-input" data-setting="grokApiKey" placeholder="xai-..." value="${state.settings?.grokApiKey || ''}" />
                  </div>
                </div>
              </div>

              <!-- Ollama -->
              <div class="settings-ai-provider-group" style="display: ${state.settings?.aiProvider === 'ollama' ? 'block' : 'none'}">
                <div class="settings-row">
                  <div class="settings-row__icon">${this.createLucideIcon(Cpu, 18)}</div>
                  <div class="settings-row__info">
                    <label class="settings-row__label">Local Server</label>
                    <p class="settings-row__hint">Base URL for your Ollama instance (e.g., http://localhost:11434).</p>
                  </div>
                  <div class="settings-row__action" style="flex: 1; max-width: 250px;">
                    <input type="text" class="settings-input" data-setting="ollamaBaseUrl" placeholder="http://localhost:11434" value="${state.settings?.ollamaBaseUrl || ''}" />
                  </div>
                </div>
              </div>

              <!-- Model Logic -->
              <div id="view-general-model-section" style="display: ${state.settings?.aiProvider !== 'ollama' ? 'block' : 'none'}">
                <div class="settings-row">
                  <div class="settings-row__icon">${this.createLucideIcon(Sparkles, 18)}</div>
                  <div class="settings-row__info">
                    <label class="settings-row__label">Model Version</label>
                    <p class="settings-row__hint">Select the specific neural model to use for generations.</p>
                  </div>
                  <div class="settings-row__action" style="flex: 1; max-width: 250px;">
                    <select class="settings-input" id="view-general-model-select" data-setting="aiModel">
                      <option value="">Default (Provider Recommended)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Vault Section -->
          <div class="settings-view__section ${this.activeSection === 'vault' ? 'is-active' : ''}" data-section="vault">
            <div class="settings-view__section-header">
              <h2 class="settings-view__section-title">Vault Configuration</h2>
            </div>

            <div class="settings-list">
              <!-- Current Vault Path Row -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(FolderSync, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Active Vault Path</label>
                  <div class="settings-vault-active-path" id="settings-vault-path-display">${state.vaultPath || 'No vault selected'}</div>
                </div>
                <div class="settings-row__action">
                  <button class="settings-button settings-button--sm settings-button--secondary" id="settings-vault-reveal">
                    ${this.createLucideIcon(FolderOpen, 14)} Reveal
                  </button>
                </div>
              </div>

              <!-- Switch Vault Row -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(PlusCircle, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Switch or Initialize</label>
                  <p class="settings-row__hint">Select a different folder or create a new vault location.</p>
                </div>
                <div class="settings-row__action">
                  <button class="settings-button settings-button--sm settings-button--primary" id="settings-vault-change">
                    Change Folder
                  </button>
                </div>
              </div>

              <div class="settings-divider"></div>
              <div class="settings-view__section-header" style="border: none; margin-top: 8px;">
                <h3 class="settings-view__section-title">Recent Vaults</h3>
              </div>

              <div class="settings-recent-vaults" id="settings-vault-list">
                <div class="settings-vault-list__loading">Indexing recent locations...</div>
              </div>
            </div>
          </div>

          <!-- Sync Section -->
          <div class="settings-view__section ${this.activeSection === 'sync' ? 'is-active' : ''}" data-section="sync">
            <div class="settings-view__section-header">
              <h2 class="settings-view__section-title">Cloud Sync (GitHub)</h2>
            </div>
            
            <div class="settings-list">
              <!-- Gist Token Row -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(Github, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Access Token</label>
                  <p class="settings-row__hint">GitHub Personal Access Token with 'gist' scope.</p>
                </div>
                <div class="settings-row__action" style="flex: 1; max-width: 400px; display: flex; gap: 8px;">
                  <input type="password" class="settings-input" data-setting="gistToken" placeholder="ghp_..." value="${(state.settings as any)?.gistToken || ''}">
                  <button class="settings-button settings-button--sm settings-button--secondary" id="settings-sync-test-token">Test</button>
                </div>
              </div>

              <!-- Gist ID Row -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(Key, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Gist Identifier</label>
                  <p class="settings-row__hint">Auto-filled after your first successful backup.</p>
                </div>
                <div class="settings-row__action" style="flex: 1; max-width: 400px;">
                  <input type="text" class="settings-input" data-setting="gistId" value="${(state.settings as any)?.gistId || ''}" readonly>
                </div>
              </div>

              <div class="settings-divider"></div>

              <!-- Backup Row -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(CloudUpload, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Push Backup</label>
                  <p class="settings-row__hint">Upload current vault contents to your secure Gist.</p>
                </div>
                <div class="settings-row__action">
                  <button class="settings-button settings-button--sm settings-button--primary" id="settings-sync-backup">
                    Backup Now
                  </button>
                </div>
              </div>

              <!-- Restore Row -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(CloudDownload, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Pull Recovery</label>
                  <p class="settings-row__hint">Overwrite local data with the latest cloud backup.</p>
                </div>
                <div class="settings-row__action">
                  <button class="settings-button settings-button--sm settings-button--secondary" id="settings-sync-restore">
                    Restore
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Shortcuts Section -->
          <div class="settings-view__section ${this.activeSection === 'shortcuts' ? 'is-active' : ''}" data-section="shortcuts">
            <div class="settings-view__section-header">
              <h2 class="settings-view__section-title">Keyboard Shortcuts</h2>
            </div>
            <div class="settings-shortcuts">
              ${renderShortcutItems()}
            </div>
          </div>

          <!-- Security Section -->
          <div class="settings-view__section ${this.activeSection === 'security' ? 'is-active' : ''}" data-section="security">
            ${this.securitySection.render()}
          </div>

        </div>
      </div>
    `
    this.attachEvents()
    if (this.activeSection === 'vault') {
      void this.loadRecentVaults()
    }
    void this.updateModelDropdowns()
    this.filterSettings()
  }

  private attachEvents(): void {
    // Search input with debouncing
    const searchInput = this.container.querySelector('.settings-search__input') as HTMLInputElement
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase()
      // Clear previous timeout
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
      }
      // Debounce for 150ms
      this.searchTimeout = window.setTimeout(() => {
        this.filterSettings()
      }, 150)
    })

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (searchInput.value) {
          searchInput.value = ''
          this.searchQuery = ''
          this.filterSettings()
          e.stopPropagation()
        } else {
          searchInput.blur()
        }
      }
    })

    // Tab switching
    this.container.querySelectorAll('[data-section-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        const section = (tab as HTMLElement).dataset.sectionTab
        if (section) {
          this.activeSection = section

          // Persist the active section
          if (state.settings) {
            state.settings.activeSettingsSection = section
            this.onSettingChange?.({ activeSettingsSection: section })
          }

          this.render()
          if (section === 'vault') {
            void this.loadRecentVaults()
          }
        }
      })
    })

    // Setting changes
    this.container.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener('change', (e) => {
        const el = e.target as HTMLInputElement | HTMLSelectElement
        const setting = el.dataset.setting as keyof AppSettings
        if (!setting) return

        let value: any
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
          value = el.checked
        } else if (el instanceof HTMLInputElement && el.type === 'number') {
          value = parseInt(el.value) || 0
          // Clamp caret width to allowed range when present
          if (setting === 'caretMaxWidth') {
            if (value < 1) value = 1
            if (value > 10) value = 10
            el.value = String(value)
          }
        } else {
          value = el.value
        }

        this.onSettingChange?.({ [setting]: value })

        // Special case: if AI provider changes, re-render to show appropriate fields
        if (setting === 'aiProvider') {
          // Clear model to prevent "Model Not Found"
          this.onSettingChange?.({ aiModel: '' })
          this.render()
        }
      })
    })

    // Vault actions
    const changeBtn = this.container.querySelector('#settings-vault-change')
    changeBtn?.addEventListener('click', () => {
      if (this.vaultCallbacks) {
        void this.vaultCallbacks.onVaultChange()
      }
    })

    const revealBtn = this.container.querySelector('#settings-vault-reveal')
    revealBtn?.addEventListener('click', () => {
      if (this.vaultCallbacks) {
        void this.vaultCallbacks.onVaultReveal()
      }
    })

    // Sync actions
    const testTokenBtn = this.container.querySelector('#settings-sync-test-token')
    testTokenBtn?.addEventListener('click', async () => {
      const tokenInput = this.container.querySelector(
        '[data-setting="gistToken"]'
      ) as HTMLInputElement
      const token = tokenInput?.value || ''
      if (!token) {
        notificationManager.show('Please enter a GitHub token first', 'warning')
        return
      }
      testTokenBtn.textContent = 'Testing...'
      testTokenBtn.setAttribute('disabled', 'true')
      try {
        const result = await window.api.syncTestToken(token)
        if (result.valid) {
          notificationManager.show(result.message, 'success')
        } else {
          notificationManager.show(result.message, 'error')
        }
      } catch (error) {
        notificationManager.show('Failed to test token', 'error')
      } finally {
        testTokenBtn.textContent = 'Test Token'
        testTokenBtn.removeAttribute('disabled')
      }
    })

    const backupBtn = this.container.querySelector('#settings-sync-backup')
    backupBtn?.addEventListener('click', async () => {
      const tokenInput = this.container.querySelector(
        '[data-setting="gistToken"]'
      ) as HTMLInputElement
      const token = tokenInput?.value || ''
      if (!token) {
        notificationManager.show('Please enter a GitHub token first', 'warning')
        return
      }
      backupBtn.textContent = 'Backing up...'
      backupBtn.setAttribute('disabled', 'true')
      try {
        const vaultData = await window.api.listNotes()
        const notes = await Promise.all(
          vaultData.filter((n) => n.type !== 'folder').map((n) => window.api.loadNote(n.id))
        )
        const allNotes = notes.filter((n) => n !== null)
        const gistId = (state.settings as any)?.gistId
        const result = await window.api.syncBackup(token, gistId, allNotes)
        if (result.success) {
          notificationManager.show(result.message, 'success')
          if (result.gistId) {
            this.onSettingChange?.({ gistId: result.gistId } as Partial<AppSettings>)
          }
        } else {
          notificationManager.show(result.message, 'error')
        }
      } catch (error) {
        notificationManager.show('Backup failed', 'error')
      } finally {
        backupBtn.innerHTML = `${this.createLucideIcon(CloudUpload, 16)} Backup to Gist`
        backupBtn.removeAttribute('disabled')
      }
    })

    const restoreBtn = this.container.querySelector('#settings-sync-restore')
    restoreBtn?.addEventListener('click', async () => {
      const tokenInput = this.container.querySelector(
        '[data-setting="gistToken"]'
      ) as HTMLInputElement
      const token = tokenInput?.value || ''
      const gistId = (state.settings as any)?.gistId
      if (!token) {
        notificationManager.show('Please enter a GitHub token first', 'warning')
        return
      }
      if (!gistId) {
        notificationManager.show('No Gist ID configured. Please backup first.', 'warning')
        return
      }
      if (!confirm('Restore will replace your current vault. Continue?')) {
        return
      }
      restoreBtn.textContent = 'Restoring...'
      restoreBtn.setAttribute('disabled', 'true')
      try {
        const result = await window.api.syncRestore(token, gistId)
        if (result.success && result.data) {
          // Trigger restore via custom event that app.ts listens to
          window.dispatchEvent(
            new CustomEvent('restore-vault', { detail: { backupData: result.data } })
          )
          notificationManager.show('Vault restored successfully', 'success')
        } else {
          notificationManager.show(result.message, 'error')
        }
      } catch (error) {
        notificationManager.show('Restore failed', 'error')
      } finally {
        restoreBtn.innerHTML = `${this.createLucideIcon(CloudDownload, 16)} Restore from Gist`
        restoreBtn.removeAttribute('disabled')
      }
    })

    // View Ollama Refresh Button
    this.container
      .querySelector('#view-refresh-ollama-models')
      ?.addEventListener('click', async (e) => {
        e.preventDefault()
        const btn = e.currentTarget as HTMLButtonElement
        const select = this.container.querySelector(
          '#view-ollama-model-select'
        ) as HTMLSelectElement
        if (!select || !btn) return

        const originalText = btn.textContent
        btn.textContent = '...'
        btn.disabled = true

        try {
          const { aiProviderManager } = await import('../../services/ai/provider-manager')
          const baseUrl = (
            this.container.querySelector('[data-setting="ollamaBaseUrl"]') as HTMLInputElement
          )?.value
          const models = await aiProviderManager.listModels({ baseUrl })

          select.innerHTML = '<option value="">Select a model...</option>'
          models.forEach((model) => {
            const option = document.createElement('option')
            option.value = model
            option.textContent = model
            if (model === state.settings?.aiModel) option.selected = true
            select.appendChild(option)
          })

          // If current model is not in list but we have one, keep it as an option
          if (state.settings?.aiModel && !models.includes(state.settings.aiModel)) {
            const option = document.createElement('option')
            option.value = state.settings.aiModel
            option.textContent = state.settings.aiModel
            option.selected = true
            select.appendChild(option)
          }

          // Trigger change to sync with settings
          this.onSettingChange?.({ aiModel: select.value })
        } catch (err) {
          console.error('Failed to fetch Ollama models:', err)
          notificationManager.show('Failed to connect to Ollama server', 'error')
        } finally {
          btn.textContent = originalText
          btn.disabled = false
        }
      })

    // Security events
    this.securitySection.attachEvents(this.container, () => this.render())
  }

  private async loadRecentVaults(): Promise<void> {
    const listEl = this.container.querySelector('#settings-vault-list') as HTMLElement
    if (!listEl) return

    try {
      this.recentVaults = await vaultService.getRecentVaults()
      this.renderVaultList(listEl)
    } catch (error) {
      console.error('[SettingsView] Failed to load recent vaults:', error)
      listEl.innerHTML =
        '<div class="settings-vault-list__error">Failed to load recent vaults</div>'
    }
  }

  private renderVaultList(container: HTMLElement): void {
    if (this.recentVaults.length === 0) {
      container.innerHTML =
        '<div class="settings-vault-list__empty">No recent vaults encountered.</div>'
      return
    }

    container.innerHTML = this.recentVaults
      .map((vault) => {
        const isCurrent = vault.path === state.vaultPath
        const statusIcon = vault.exists
          ? this.createLucideIcon(CheckCircle2, 14)
          : this.createLucideIcon(AlertCircle, 14)

        const statusColor = vault.exists ? '#10b981' : '#ef4444'

        return `
        <div class="vault-row ${isCurrent ? 'is-active' : ''} ${!vault.exists ? 'is-missing' : ''}">
          <div class="vault-row__status" style="color: ${statusColor}">${statusIcon}</div>
          <div class="vault-row__info">
            <div class="vault-row__name">
              ${this.escapeHtml(vault.name)}
              ${isCurrent ? '<span class="vault-row__badge">Active</span>' : ''}
            </div>
            <div class="vault-row__path" title="${this.escapeHtml(vault.path)}">${this.escapeHtml(vault.path)}</div>
          </div>
          <div class="vault-row__actions">
            ${
              vault.exists
                ? isCurrent
                  ? `<span class="vault-row__current-label">${this.createLucideIcon(CheckCircle2, 14)} Using</span>`
                  : `
                <button class="vault-row__btn vault-row__btn--open" data-action="select" data-path="${this.escapeHtml(vault.path)}">
                  Switch Vault
                </button>
              `
                : `
                <button class="vault-row__btn vault-row__btn--locate" data-action="locate" data-path="${this.escapeHtml(vault.path)}">
                  Locate
                </button>
              `
            }
            ${
              !isCurrent
                ? `
              <button class="vault-row__btn vault-row__btn--delete" data-action="delete" data-path="${this.escapeHtml(vault.path)}" title="Remove record">
                  ${this.createLucideIcon(Trash2, 14)}
              </button>
            `
                : ''
            }
          </div>
        </div>
      `
      })
      .join('')

    // Attach click handlers
    container.querySelectorAll('[data-action="select"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const path = (e.currentTarget as HTMLElement).dataset.path
        if (path && this.vaultCallbacks) {
          void this.vaultCallbacks.onVaultSelected(path)
        }
      })
    })

    // Attach locate handlers for missing vaults
    container.querySelectorAll('[data-action="locate"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const path = (e.currentTarget as HTMLElement).dataset.path
        if (!path || !this.vaultCallbacks) return

        // Try to locate the moved vault
        const foundPath = await vaultService.locateMovedVault(path)
        if (foundPath && this.vaultCallbacks.onVaultLocated) {
          await this.vaultCallbacks.onVaultLocated(path, foundPath)
          // Reload the list to show updated status
          await this.loadRecentVaults()
        } else {
          // If not found, show choose dialog
          if (this.vaultCallbacks.onVaultChange) {
            await this.vaultCallbacks.onVaultChange()
          }
        }
      })
    })

    // Attach delete handlers
    container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const path = (e.currentTarget as HTMLElement).dataset.path
        if (!path) return

        try {
          await vaultService.removeRecentVault(path)
          await this.loadRecentVaults()
        } catch (error) {
          console.error('[SettingsView] Failed to remove recent vault:', error)
        }
      })
    })
  }

  private filterSettings(): void {
    const fields = this.container.querySelectorAll('.settings-field') as NodeListOf<HTMLElement>
    // Use requestAnimationFrame for smooth UI updates
    requestAnimationFrame(() => {
      fields.forEach((field) => {
        const searchText = field.dataset.search || ''
        const matches =
          this.searchQuery === '' || searchText.toLowerCase().includes(this.searchQuery)
        field.style.display = matches ? '' : 'none'
      })
    })
  }

  updateVaultPath(): void {
    const pathDisplay = this.container.querySelector('#settings-vault-path-display') as HTMLElement
    if (pathDisplay) {
      pathDisplay.textContent = state.vaultPath || 'No vault selected'
    }
    // Reload recent vaults to update current badge
    if (this.activeSection === 'vault') {
      void this.loadRecentVaults()
    }
  }

  show(): void {
    this.container.style.display = 'block'
    this.render()
    // Update vault path when showing settings
    this.updateVaultPath()
  }

  hide(): void {
    this.container.style.display = 'none'
  }

  private async updateModelDropdowns(): Promise<void> {
    const providerType = state.settings?.aiProvider || 'deepseek'
    const select = this.container.querySelector('#view-general-model-select') as HTMLSelectElement
    if (!select || providerType === 'ollama') return

    try {
      const { AIProviderFactory } = await import('../../services/ai/factory')
      const provider = AIProviderFactory.getProvider(providerType as any)
      const models = provider.supportedModels

      select.innerHTML = '<option value="">Default (Provider Recommended)</option>'
      models.forEach((model) => {
        const option = document.createElement('option')
        option.value = model
        option.textContent = model
        if (model === state.settings?.aiModel) option.selected = true
        select.appendChild(option)
      })
    } catch (err) {
      console.error('[SettingsView] Failed to update models:', err)
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
