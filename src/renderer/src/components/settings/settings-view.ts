import { state } from '../../core/state'
import { modalManager } from '../modal/modal'
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
  Cpu,
  Volume2,
  Gauge,
  Layout,
  Frame,
  Pipette,
  PanelLeft,
  Activity,
  Search,
  X
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
  public render(): void {
    // Restore active section from settings if available
    if (state.settings?.activeSettingsSection) {
      this.activeSection = state.settings.activeSettingsSection
    }

    this.container.innerHTML = `
      <div class="settings-view">
        <aside class="settings-view__sidebar">
          <div class="settings-view__sidebar-title">Settings</div>
          <div class="settings-sidebar-search">
             <div class="settings-sidebar-search__icon">${this.createLucideIcon(Search, 14)}</div>
             <input
               type="text"
               class="settings-search__input"
               placeholder="Filter settings..."
               value="${this.searchQuery}"
               spellcheck="false"
             />
             ${
               this.searchQuery
                 ? `<button class="settings-sidebar-search__clear" id="settings-search-clear" title="Clear search">${this.createLucideIcon(X, 14)}</button>`
                 : ''
             }
          </div>
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
          <button class="settings-view__sidebar-item ${this.activeSection === 'terminal' ? 'is-active' : ''}" data-section-tab="terminal">
            ${codicons.terminal} Terminal
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'tab' ? 'is-active' : ''}" data-section-tab="tab">
            ${this.createLucideIcon(Layout, 16)} Tab
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'security' ? 'is-active' : ''}" data-section-tab="security">
            ${codicons.lock} Security
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'sidebar' ? 'is-active' : ''}" data-section-tab="sidebar">
            ${this.createLucideIcon(PanelLeft, 16)} Sidebar
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'activityBar' ? 'is-active' : ''}" data-section-tab="activityBar">
            ${this.createLucideIcon(Activity, 16)} Activity Bar
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'search' ? 'is-active' : ''}" data-section-tab="search">
            ${this.createLucideIcon(Search, 16)} Search UI
          </button>
        </aside>

        <div class="settings-view__content">

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
                  <div class="settings-color-group">
                    <input type="number" data-setting="fontSize" min="10" max="40" value="${state.settings?.fontSize || 14}" style="width: 80px; background: transparent; border: none; padding: 0 4px; font-family: inherit; font-size: 13px; color: var(--text-strong); outline: none;" />
                  </div>
                </div>
              </div>

              <!-- Caret Thickness -->
              <div class="settings-row" data-search="caret width set the max width for the editor caret">
                <div class="settings-row__icon">${this.createLucideIcon(Scan, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Caret Thickness</label>
                  <p class="settings-row__hint">Set the width of the editor's insertion point cursor.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <input type="number" data-setting="caretMaxWidth" min="1" max="10" value="${state.settings?.caretMaxWidth ?? 2}" style="width: 80px; background: transparent; border: none; padding: 0 4px; font-family: inherit; font-size: 13px; color: var(--text-strong); outline: none;" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Editor Theme Section -->
            <div class="settings-divider" style="margin-top: 24px;"></div>
            <div class="settings-view__section-header" style="border: none; margin-top: 8px;">
                <h3 class="settings-view__section-title">Editor Aesthetic</h3>
                <p class="settings-row__hint" style="margin-top: 4px; padding-left: 0;">Choose your preferred styling for the writing workspace.</p>
            </div>
            
            <div class="settings-row">
              <div class="settings-row__icon">${this.createLucideIcon(Palette, 18)}</div>
              <div class="settings-row__info">
                <label class="settings-row__label">Workspace Theme</label>
                <p class="settings-row__hint">A specialized skin for your notes.</p>
              </div>
              <div class="settings-row__action">
                ${this.renderEditorThemeSelector()}
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
                <h2 class="settings-view__section-title">Global UI Appearance</h2>
            </div>

            <div class="settings-list">
              <!-- Application Theme (Global) -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(Palette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">App Surface Theme</label>
                  <p class="settings-row__hint">Overall window coloring and UI density.</p>
                </div>
                <div class="settings-row__action">
                  <select class="settings-select" data-setting="theme" style="width: 140px;">
                    <option value="dark" ${state.settings?.theme === 'dark' ? 'selected' : ''}>Hub Dark</option>
                    <option value="light" ${state.settings?.theme === 'light' ? 'selected' : ''}>Hub Light</option>
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
                  <div class="settings-color-group">
                    <input type="number" data-setting="autoSaveDelay" min="300" max="10000" step="100" value="${state.settings?.autoSaveDelay || 800}" style="width: 80px; background: transparent; border: none; padding: 0 4px; font-family: inherit; font-size: 13px; color: var(--text-strong); outline: none;" />
                  </div>
                </div>
              </div>

              <!-- TTS Divider -->
              <div class="settings-divider"></div>
              <div class="settings-view__section-header" style="border: none; margin-top: 8px;">
                <h3 class="settings-view__section-title">Reading Aloud (TTS)</h3>
              </div>

              <!-- TTS Voice -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(Volume2, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Preferred Voice</label>
                  <p class="settings-row__hint">Select your favorite narrator from available system voices.</p>
                </div>
                <div class="settings-row__action" style="flex: 1; justify-content: flex-end; display: flex;">
                  <select class="settings-select" data-setting="ttsVoice" id="view-tts-voice-select" style="max-width: 250px;">
                  </select>
                </div>
              </div>

              <!-- TTS Speed -->
              <div class="settings-row">
                <div class="settings-row__icon">${this.createLucideIcon(Gauge, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Reading Speed</label>
                  <p class="settings-row__hint">Adjust how fast the narrator speaks (0.5x - 2.0x).</p>
                </div>
                <div class="settings-row__action" style="display: flex; align-items: center; gap: 12px; min-width: 200px;">
                  <input type="range" class="settings-input" data-setting="ttsSpeed" min="0.5" max="2.0" step="0.1" value="${state.settings?.ttsSpeed || 1.0}" style="flex: 1; padding: 0;" oninput="this.nextElementSibling.textContent = parseFloat(this.value).toFixed(1) + 'x'" />
                  <span style="font-size: 11px; opacity: 0.7; min-width: 32px; text-align: right; font-family: var(--font-mono);">${Number(state.settings?.ttsSpeed || 1.0).toFixed(1)}x</span>
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
                  <select class="settings-select" data-setting="aiProvider">
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
                    <select class="settings-select" id="view-general-model-select" data-setting="aiModel">
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

          <!-- Terminal Section -->
          <div class="settings-view__section ${this.activeSection === 'terminal' ? 'is-active' : ''}" data-section="terminal">
            <div class="settings-view__section-header">
              <h2 class="settings-view__section-title">Terminal Configuration</h2>
            </div>

            <div class="settings-list">
              <!-- Font Size -->
              <div class="settings-row" data-search="terminal font size">
                <div class="settings-row__icon">${this.createLucideIcon(Type, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Font Size</label>
                  <p class="settings-row__hint">Size of the terminal text (px).</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <input type="number" data-setting="terminalFontSize" min="10" max="36" value="${state.settings?.terminalFontSize || 14}" style="width: 80px; background: transparent; border: none; padding: 0 4px; font-family: inherit; font-size: 13px; color: var(--text-strong); outline: none;" />
                  </div>
                </div>
              </div>

               <!-- Font Family -->
              <div class="settings-row" data-search="terminal font family">
                <div class="settings-row__icon">${this.createLucideIcon(Type, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Font Family</label>
                  <p class="settings-row__hint">Font family for the terminal.</p>
                </div>
                <div class="settings-row__action" style="flex: 1; max-width: 250px;">
                   <input type="text" class="settings-input" data-setting="terminalFontFamily" value="${state.settings?.terminalFontFamily || 'Consolas, monospace'}" placeholder='Consolas, "Courier New", monospace' />
                </div>
              </div>
              
              <div class="settings-divider"></div>
              <div class="settings-view__section-header" style="border: none; margin-top: 8px;">
                <h3 class="settings-view__section-title">Terminal Colors</h3>
              </div>

               <!-- Frame Color -->
               <div class="settings-row" data-search="terminal frame color">
                <div class="settings-row__icon">${this.createLucideIcon(Layout, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Frame Color</label>
                  <p class="settings-row__hint">Color of the terminal window frame.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.terminalFrameColor || '#1e1e1e'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="terminalFrameColor" value="${state.settings?.terminalFrameColor || '#1e1e1e'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

              <!-- Background Color -->
              <div class="settings-row" data-search="terminal background color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Background Color</label>
                  <p class="settings-row__hint">Background color of the terminal.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.terminalBackground || '#1e1e1e'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="terminalBackground" value="${state.settings?.terminalBackground || '#1e1e1e'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

              <!-- Foreground Color -->
              <div class="settings-row" data-search="terminal text color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Text Color</label>
                  <p class="settings-row__hint">Default text color.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.terminalForeground || '#cccccc'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="terminalForeground" value="${state.settings?.terminalForeground || '#cccccc'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>
              
              <!-- Cursor Color -->
              <div class="settings-row" data-search="terminal cursor color">
                <div class="settings-row__icon">${this.createLucideIcon(Scan, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Cursor Color</label>
                  <p class="settings-row__hint">Color of the terminal cursor.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.terminalCursor || '#ffffff'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="terminalCursor" value="${state.settings?.terminalCursor || '#ffffff'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Search Input Section -->
          <div class="settings-view__section ${this.activeSection === 'search' ? 'is-active' : ''}" data-section="search">
            <div class="settings-view__section-header">
              <h2 class="settings-view__section-title">Search Input Styling</h2>
              <p class="settings-row__hint" style="margin-top: 4px; padding-left: 0;">Customize the appearance of search inputs across terminal, editor, and global search.</p>
            </div>

            <div class="settings-list">
              <!-- Background Color -->
              <div class="settings-row" data-search="search input background color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Background Color</label>
                  <p class="settings-row__hint">Background color of the search input field.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.searchInput?.backgroundColor || '#3c3c3c'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="searchInput.backgroundColor" value="${state.settings?.searchInput?.backgroundColor || '#3c3c3c'}" placeholder="#HEX" maxlength="9" />
                  </div>
                </div>
              </div>

              <!-- Border Color -->
              <div class="settings-row" data-search="search input border color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Border Color</label>
                  <p class="settings-row__hint">Border color of the search input.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.searchInput?.borderColor || 'rgba(255, 255, 255, 0.1)'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="searchInput.borderColor" value="${state.settings?.searchInput?.borderColor || 'rgba(255, 255, 255, 0.1)'}" placeholder="#HEX or rgba()" />
                  </div>
                </div>
              </div>

              <!-- Focus Border Color -->
              <div class="settings-row" data-search="search input focus border color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Focus Border Color</label>
                  <p class="settings-row__hint">Border color when input is focused.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.searchInput?.focusBorderColor || '#007acc'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="searchInput.focusBorderColor" value="${state.settings?.searchInput?.focusBorderColor || '#007acc'}" placeholder="#HEX" maxlength="9" />
                  </div>
                </div>
              </div>

              <!-- Text Color -->
              <div class="settings-row" data-search="search input text color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Text Color</label>
                  <p class="settings-row__hint">Color of the search text.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.searchInput?.textColor || '#ffffff'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="searchInput.textColor" value="${state.settings?.searchInput?.textColor || '#ffffff'}" placeholder="#HEX" maxlength="9" />
                  </div>
                </div>
              </div>

              <!-- Placeholder Color -->
              <div class="settings-row" data-search="search input placeholder color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Placeholder Color</label>
                  <p class="settings-row__hint">Color of the placeholder text.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.searchInput?.placeholderColor || '#858585'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="searchInput.placeholderColor" value="${state.settings?.searchInput?.placeholderColor || '#858585'}" placeholder="#HEX" maxlength="9" />
                  </div>
                </div>
              </div>

              <div class="settings-divider"></div>
              <div class="settings-view__section-header" style="border: none; margin-top: 8px;">
                <h3 class="settings-view__section-title">Button Colors</h3>
              </div>

              <!-- Button Color -->
              <div class="settings-row" data-search="search button color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Button Color</label>
                  <p class="settings-row__hint">Color of search action buttons.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.searchInput?.buttonColor || '#cccccc'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="searchInput.buttonColor" value="${state.settings?.searchInput?.buttonColor || '#cccccc'}" placeholder="#HEX" maxlength="9" />
                  </div>
                </div>
              </div>

              <!-- Button Hover Color -->
              <div class="settings-row" data-search="search button hover color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Button Hover Color</label>
                  <p class="settings-row__hint">Color of buttons on hover.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.searchInput?.buttonHoverColor || '#ffffff'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="searchInput.buttonHoverColor" value="${state.settings?.searchInput?.buttonHoverColor || '#ffffff'}" placeholder="#HEX" maxlength="9" />
                  </div>
                </div>
              </div>

              <!-- Button Active Color -->
              <div class="settings-row" data-search="search button active color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Button Active Color</label>
                  <p class="settings-row__hint">Color of active/selected buttons.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.searchInput?.buttonActiveColor || '#007acc'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="searchInput.buttonActiveColor" value="${state.settings?.searchInput?.buttonActiveColor || '#007acc'}" placeholder="#HEX" maxlength="9" />
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Tab Section -->
          <div class="settings-view__section ${this.activeSection === 'tab' ? 'is-active' : ''}" data-section="tab">
            <div class="settings-view__section-header">
              <h2 class="settings-view__section-title">Tab Customization</h2>
            </div>

            <div class="settings-list">
              <!-- Border Position -->
              <div class="settings-row" data-search="tab border position top bottom left right">
                <div class="settings-row__icon">${this.createLucideIcon(Frame, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Border Position</label>
                  <p class="settings-row__hint">Choose which side the active tab border appears on.</p>
                </div>
                <div class="settings-row__action">
                  <select class="settings-select" data-setting="tab.borderPosition" style="width: 120px;">
                    <option value="top" ${state.settings?.tab?.borderPosition === 'top' ? 'selected' : ''}>Top</option>
                    <option value="bottom" ${state.settings?.tab?.borderPosition === 'bottom' ? 'selected' : ''}>Bottom</option>
                    <option value="left" ${state.settings?.tab?.borderPosition === 'left' ? 'selected' : ''}>Left</option>
                    <option value="right" ${state.settings?.tab?.borderPosition === 'right' ? 'selected' : ''}>Right</option>
                  </select>
                </div>
              </div>

              <!-- Compact Mode -->
              <div class="settings-row" data-search="tab compact mode smaller tabs">
                <div class="settings-row__icon">${this.createLucideIcon(Zap, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Compact Tabs</label>
                  <p class="settings-row__hint">Reduce tab height and padding for more screen space.</p>
                </div>
                <div class="settings-row__action">
                  <label class="settings-toggle">
                    <input type="checkbox" data-setting="tab.compactMode" ${state.settings?.tab?.compactMode ? 'checked' : ''} />
                    <span class="settings-toggle__slider"></span>
                  </label>
                </div>
              </div>

              <div class="settings-divider"></div>
              <div class="settings-view__section-header" style="border: none; margin-top: 8px;">
                <h3 class="settings-view__section-title">Colors & Aesthetics</h3>
              </div>

              <!-- Tab Background -->
              <div class="settings-row" data-search="tab background color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Background Color</label>
                  <p class="settings-row__hint">Define the base background for the tab bar.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.tab?.backgroundColor || '#1e1e1e'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="tab.backgroundColor" value="${state.settings?.tab?.backgroundColor || '#1e1e1e'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

              <!-- Border Color -->
              <div class="settings-row" data-search="tab border color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Border Color</label>
                  <p class="settings-row__hint">Define the color of the accent border.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.tab?.borderColor || '#007acc'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="tab.borderColor" value="${state.settings?.tab?.borderColor || '#007acc'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

              <!-- Active Tab Color -->
              <div class="settings-row" data-search="active tab background color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Active Tab Color</label>
                  <p class="settings-row__hint">Background color for the currently focused tab.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.tab?.activeTabColor || '#2d2d2d'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="tab.activeTabColor" value="${state.settings?.tab?.activeTabColor || '#2d2d2d'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

              <!-- Inactive Tab Color -->
              <div class="settings-row" data-search="inactive tab background color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Inactive Tab Color</label>
                  <p class="settings-row__hint">Background color for non-focused tabs.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.tab?.inactiveTabColor || '#1e1e1e'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="tab.inactiveTabColor" value="${state.settings?.tab?.inactiveTabColor || '#1e1e1e'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

              <!-- Text Colors -->
              <div class="settings-row" data-search="active tab text color">
                <div class="settings-row__icon">${this.createLucideIcon(Type, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Active Text Color</label>
                  <p class="settings-row__hint">Label color for the active tab.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.tab?.activeTextColor || '#ffffff'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="tab.activeTextColor" value="${state.settings?.tab?.activeTextColor || '#ffffff'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

              <div class="settings-row" data-search="inactive tab text color">
                <div class="settings-row__icon">${this.createLucideIcon(Type, 18)}</div>
                <div class="settings-row__info">
                  <label class="settings-row__label">Inactive Text Color</label>
                  <p class="settings-row__hint">Label color for background tabs.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.tab?.inactiveTextColor || '#969696'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="tab.inactiveTextColor" value="${state.settings?.tab?.inactiveTextColor || '#969696'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Security Section -->
          <div class="settings-view__section ${this.activeSection === 'security' ? 'is-active' : ''}" data-section="security">
            ${this.securitySection.render()}
          </div>

          <!-- Sidebar Section -->
          <div class="settings-view__section ${this.activeSection === 'sidebar' ? 'is-active' : ''}" data-section="sidebar">
            <div class="settings-view__section-header">
              <h2 class="settings-view__section-title">Sidebar Customization</h2>
            </div>
            
            <div class="settings-list">
              <!-- Background Color -->
              <div class="settings-row" data-search="sidebar background color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                   <label class="settings-row__label">Background Color</label>
                   <p class="settings-row__hint">Base background for the explorer panel.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.sidebar?.backgroundColor || '#252526'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="sidebar.backgroundColor" value="${state.settings?.sidebar?.backgroundColor || '#252526'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

              <!-- Border Color -->
              <div class="settings-row" data-search="sidebar border color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                   <label class="settings-row__label">Border Color</label>
                   <p class="settings-row__hint">Color of the divider between sidebar and editor.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.sidebar?.borderColor || '#333333'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="sidebar.borderColor" value="${state.settings?.sidebar?.borderColor || '#333333'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

              <!-- Text Color -->
              <div class="settings-row" data-search="sidebar text color">
                <div class="settings-row__icon">${this.createLucideIcon(Type, 18)}</div>
                <div class="settings-row__info">
                   <label class="settings-row__label">Text Color</label>
                   <p class="settings-row__hint">Color for file and folder names.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.sidebar?.textColor || '#cccccc'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="sidebar.textColor" value="${state.settings?.sidebar?.textColor || '#cccccc'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

              <!-- Active Item Color -->
              <div class="settings-row" data-search="sidebar active item background">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                   <label class="settings-row__label">Active Item Background</label>
                   <p class="settings-row__hint">Background color for the currently active file.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.sidebar?.activeItemColor || '#37373d'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="sidebar.activeItemColor" value="${state.settings?.sidebar?.activeItemColor || '#37373d'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>
              
              <!-- Active Text Color -->
              <div class="settings-row" data-search="sidebar active text color">
                <div class="settings-row__icon">${this.createLucideIcon(Type, 18)}</div>
                <div class="settings-row__info">
                   <label class="settings-row__label">Active Text Color</label>
                   <p class="settings-row__hint">Text color for the currently active file.</p>
                </div>
                <div class="settings-row__action">
                   <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                       <div class="settings-color-swatch" style="background-color: ${state.settings?.sidebar?.activeTextColor || '#ffffff'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="sidebar.activeTextColor" value="${state.settings?.sidebar?.activeTextColor || '#ffffff'}" placeholder="#HEX" maxlength="7" />
                   </div>
                </div>
              </div>

              <!-- Font Size -->
              <div class="settings-row" data-search="sidebar font size">
                <div class="settings-row__icon">${this.createLucideIcon(Type, 18)}</div>
                <div class="settings-row__info">
                   <label class="settings-row__label">Font Size</label>
                   <p class="settings-row__hint">Size of text in the file explorer (px).</p>
                </div>
                <div class="settings-row__action">
                   <div class="settings-color-group">
                     <input type="number" data-setting="sidebar.fontSize" min="10" max="24" value="${state.settings?.sidebar?.fontSize || 13}" style="width: 80px; background: transparent; border: none; padding: 0 4px; font-family: inherit; font-size: 13px; color: var(--text-strong); outline: none;" />
                   </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Activity Bar Section -->
          <div class="settings-view__section ${this.activeSection === 'activityBar' ? 'is-active' : ''}" data-section="activityBar">
             <div class="settings-view__section-header">
              <h2 class="settings-view__section-title">Activity Bar Customization</h2>
            </div>

            <div class="settings-list">
               <!-- Background Color -->
              <div class="settings-row" data-search="activity bar background color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                   <label class="settings-row__label">Background Color</label>
                   <p class="settings-row__hint">Base background for the activity bar.</p>
                </div>
                <div class="settings-row__action">
                  <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.activityBar?.backgroundColor || '#333333'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="activityBar.backgroundColor" value="${state.settings?.activityBar?.backgroundColor || '#333333'}" placeholder="#HEX" maxlength="7" />
                  </div>
                </div>
              </div>

              <!-- Border Color -->
              <div class="settings-row" data-search="activity bar border color">
                <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                <div class="settings-row__info">
                   <label class="settings-row__label">Border Color</label>
                   <p class="settings-row__hint">Color of the border separating activity bar.</p>
                </div>
                <div class="settings-row__action">
                   <div class="settings-color-group">
                    <div class="settings-color-wrapper">
                      <div class="settings-color-swatch" style="background-color: ${state.settings?.activityBar?.borderColor || '#252526'}"></div>
                    </div>
                    <input type="text" class="settings-input settings-color-text" data-setting="activityBar.borderColor" value="${state.settings?.activityBar?.borderColor || '#252526'}" placeholder="#HEX" maxlength="7" />
                   </div>
                </div>
              </div>

               <!-- Active Item Color -->
              <div class="settings-row" data-search="activity bar active item color">
                 <div class="settings-row__icon">${this.createLucideIcon(Pipette, 18)}</div>
                 <div class="settings-row__info">
                   <label class="settings-row__label">Active Item Background</label>
                    <p class="settings-row__hint">Background color for the selected view icon.</p>
                 </div>
                 <div class="settings-row__action">
                    <div class="settings-color-group">
                      <div class="settings-color-wrapper">
                        <div class="settings-color-swatch" style="background-color: ${state.settings?.activityBar?.activeItemColor || '#333333'}"></div>
                      </div>
                      <input type="text" class="settings-input settings-color-text" data-setting="activityBar.activeItemColor" value="${state.settings?.activityBar?.activeItemColor || '#333333'}" placeholder="#HEX" maxlength="7" />
                    </div>
                 </div>
              </div>

               <!-- Active Icon Color -->
              <div class="settings-row" data-search="activity bar active icon color">
                 <div class="settings-row__icon">${this.createLucideIcon(Palette, 18)}</div>
                 <div class="settings-row__info">
                   <label class="settings-row__label">Active Icon Color</label>
                    <p class="settings-row__hint">Color of the icon when selected.</p>
                 </div>
                 <div class="settings-row__action">
                    <div class="settings-color-group">
                      <div class="settings-color-wrapper">
                         <div class="settings-color-swatch" style="background-color: ${state.settings?.activityBar?.activeIconColor || '#ffffff'}"></div>
                      </div>
                      <input type="text" class="settings-input settings-color-text" data-setting="activityBar.activeIconColor" value="${state.settings?.activityBar?.activeIconColor || '#ffffff'}" placeholder="#HEX" maxlength="7" />
                    </div>
                 </div>
              </div>

               <!-- Inactive Icon Color -->
              <div class="settings-row" data-search="activity bar inactive icon color">
                 <div class="settings-row__icon">${this.createLucideIcon(Palette, 18)}</div>
                 <div class="settings-row__info">
                   <label class="settings-row__label">Inactive Icon Color</label>
                    <p class="settings-row__hint">Color of unselected icons.</p>
                 </div>
                 <div class="settings-row__action">
                    <div class="settings-color-group">
                      <div class="settings-color-wrapper">
                        <div class="settings-color-swatch" style="background-color: ${state.settings?.activityBar?.inactiveIconColor || '#6e6e6e'}"></div>
                      </div>
                      <input type="text" class="settings-input settings-color-text" data-setting="activityBar.inactiveIconColor" value="${state.settings?.activityBar?.inactiveIconColor || '#6e6e6e'}" placeholder="#HEX" maxlength="7" />
                    </div>
                 </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `
    this.attachEvents()
    if (this.activeSection === 'vault') {
      void this.loadRecentVaults()
    }
    void this.updateModelDropdowns()
    this.updateTTSVoices()
    this.filterSettings()
  }

  private updateTTSVoices(): void {
    const select = this.container.querySelector('#view-tts-voice-select') as HTMLSelectElement
    if (!select) return

    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => this.updateTTSVoices()
      return
    }

    const currentVoice = state.settings?.ttsVoice
    select.innerHTML = '' // Remove all placeholders

    // 1. Cloud Voices (Top Priority)
    if (state.settings?.openaiApiKey) {
      const g = document.createElement('optgroup')
      g.label = 'Premium Cloud Voices'
      const v = ['alloy', 'nova', 'shimmer', 'onyx', 'fable', 'echo']
      v.forEach((name) => {
        const opt = document.createElement('option')
        opt.value = `openai:${name}`
        opt.textContent = `ChatGPT ${name.charAt(0).toUpperCase() + name.slice(1)}`
        if (currentVoice === opt.value) opt.selected = true
        g.appendChild(opt)
      })
      select.appendChild(g)
    }

    // 2. System Voices (Restored with clean names)
    if (voices.length > 0) {
      const systemG = document.createElement('optgroup')
      systemG.label = 'System Voices'
      voices.forEach((voice) => {
        const option = document.createElement('option')
        option.value = voice.voiceURI
        const cleanName = voice.name
          .replace(/Microsoft |Desktop |Natural | - /g, ' ')
          .replace(/\(.*?\)/g, '')
          .trim()
        option.textContent = `${cleanName} (${voice.lang.split('-')[0].toUpperCase()})`
        if (voice.voiceURI === currentVoice) option.selected = true
        systemG.appendChild(option)
      })
      select.appendChild(systemG)
    }

    // 3. Fallback if no OpenAI and no system voices (rare)
    if (select.options.length === 0) {
      const opt = document.createElement('option')
      opt.value = ''
      opt.textContent = 'Setup OpenAI for Voice...'
      select.appendChild(opt)
    }
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

    const clearBtn = this.container.querySelector('#settings-search-clear')
    clearBtn?.addEventListener('click', () => {
      this.searchQuery = ''
      if (searchInput) {
        searchInput.value = ''
        searchInput.focus()
      }
      this.filterSettings()
      // We don't call render here to keep focus, but the X will disappear on next render
      clearBtn.remove()
    })

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (searchInput.value) {
          searchInput.value = ''
          this.searchQuery = ''
          this.filterSettings()
          // Re-render to remove the X button
          this.render()
          // Refocus after render
          const newInput = this.container.querySelector(
            '.settings-search__input'
          ) as HTMLInputElement
          newInput?.focus()
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

          // Soft Update: Toggle classes instead of full destructive render
          this.container.querySelectorAll('[data-section-tab]').forEach((t) => {
            t.classList.toggle('is-active', (t as HTMLElement).dataset.sectionTab === section)
          })

          this.container.querySelectorAll('[data-section]').forEach((s) => {
            const isTarget = (s as HTMLElement).dataset.section === section
            s.classList.toggle('is-active', isTarget)
          })

          // Reset scroll position for the content area
          const contentArea = this.container.querySelector('.settings-view__content')
          if (contentArea) {
            contentArea.scrollTop = 0
          }

          if (section === 'vault') {
            void this.loadRecentVaults()
          }
        }
      })
    })

    // Setting changes - using 'input' for instant feedback (especially for colors)
    this.container.querySelectorAll('[data-setting]').forEach((input) => {
      const handleInput = (e: Event): void => {
        const el = e.target as HTMLInputElement | HTMLSelectElement
        const settingPath = el.dataset.setting
        if (!settingPath) return

        let value: any
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
          value = el.checked
        } else if (el instanceof HTMLInputElement && el.type === 'number') {
          value = parseInt(el.value) || 0
          if (settingPath === 'caretMaxWidth') {
            if (value < 1) value = 1
            if (value > 10) value = 10
            el.value = String(value)
          }
        } else if (el instanceof HTMLInputElement && el.classList.contains('settings-color-text')) {
          let val = el.value
          if (val && !val.startsWith('#')) {
            const start = el.selectionStart
            el.value = '#' + val
            if (start !== null) el.setSelectionRange(start + 1, start + 1)
            val = el.value
          }
          value = val

          // Update swatch color hint
          const group = el.closest('.settings-color-group')
          const swatch = group?.querySelector('.settings-color-swatch') as HTMLElement
          if (swatch && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
            swatch.style.backgroundColor = val
          }
        } else {
          value = el.value
        }

        if (settingPath.includes('.')) {
          const [parent, child] = settingPath.split('.')
          const parentSetting = parent as keyof AppSettings
          this.onSettingChange?.({
            [parentSetting]: {
              ...((state.settings?.[parentSetting] as any) || {}),
              [child]: value
            }
          })
        } else {
          const setting = settingPath as keyof AppSettings
          this.onSettingChange?.({ [setting]: value })

          if (setting === 'aiProvider') {
            this.onSettingChange?.({ aiModel: '' })
            this.render()
          }
        }
      }

      input.addEventListener('input', handleInput)
      input.addEventListener('change', handleInput)
    })

    // Custom Dropdown Logic (for Editor Theme)
    const customDropdown = this.container.querySelector('.settings-custom-dropdown')
    const trigger = customDropdown?.querySelector('.settings-custom-dropdown__trigger')

    if (customDropdown && trigger) {
      const closeDropdown = (): void => {
        customDropdown.classList.remove('is-open')
        document.removeEventListener('click', handleGlobalClick)
        document.removeEventListener('keydown', handleKeydown)
      }

      const handleGlobalClick = (e: MouseEvent): void => {
        if (!customDropdown.contains(e.target as Node)) {
          closeDropdown()
        }
      }

      const handleKeydown = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
          closeDropdown()
        }
      }

      trigger.addEventListener('click', (e) => {
        e.stopPropagation()

        const isOpen = customDropdown.classList.contains('is-open')
        if (isOpen) {
          closeDropdown()
        } else {
          // Smart Flipping
          const rect = trigger.getBoundingClientRect()
          const spaceBelow = window.innerHeight - rect.bottom
          if (spaceBelow < 220) {
            customDropdown.classList.add('is-flipped')
          } else {
            customDropdown.classList.remove('is-flipped')
          }

          customDropdown.classList.add('is-open')
          document.addEventListener('click', handleGlobalClick)
          document.addEventListener('keydown', handleKeydown)
        }
      })

      customDropdown.querySelectorAll('.settings-custom-dropdown__item').forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation()
          const themeId = (item as HTMLElement).dataset.themeId
          if (themeId) {
            this.onSettingChange?.({ editorTheme: themeId })

            // Manual UI Update (to avoid re-render jump/close)
            const targetTheme = themes[themeId]
            if (targetTheme && trigger) {
              const label =
                targetTheme.id === 'dark'
                  ? 'Dark'
                  : targetTheme.id === 'light'
                    ? 'Light'
                    : targetTheme.name.split(' ')[0]
              const triggerContent = trigger.querySelector('div')
              if (triggerContent) {
                triggerContent.innerHTML = `
                   <div class="settings-custom-dropdown__preview-dot" style="background: ${targetTheme.colors['--primary']};"></div>
                   ${label}
                 `
              }
            }

            // Update selected class in list
            customDropdown
              .querySelectorAll('.settings-custom-dropdown__item')
              .forEach((i) => i.classList.remove('is-selected'))
            item.classList.add('is-selected')
          }
        })
      })
    }

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
      } catch {
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
      } catch {
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

      modalManager.open({
        title: 'Restore Vault',
        content:
          'This will replace your current local notes with the version from GitHub. This action cannot be undone. Are you sure you want to proceed?',
        buttons: [
          {
            label: 'Okay',
            variant: 'primary',
            onClick: async (m) => {
              m.close()
              try {
                notificationManager.show('Restoring backup...', 'info', { title: 'Sync' })
                const result = await window.api.syncRestore(token, gistId)
                if (result.success && result.data) {
                  // Trigger restore via custom event that app.ts listens to
                  window.dispatchEvent(
                    new CustomEvent('restore-vault', { detail: { backupData: result.data } })
                  )
                  notificationManager.show('Vault restored successfully', 'success', {
                    title: 'Sync'
                  })
                } else {
                  notificationManager.show(result.message || 'Restore failed', 'error', {
                    title: 'Sync'
                  })
                }
              } catch {
                notificationManager.show('Restore failed', 'error', { title: 'Sync' })
              }
            }
          },
          {
            label: 'Cancel',
            variant: 'ghost',
            onClick: (m) => m.close()
          }
        ]
      })
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

        modalManager.open({
          title: 'Remove Vault',
          content: `Are you sure you want to remove this vault from your recent list?<br/><br/><code style="font-size: 11px; opacity: 0.7;">${this.escapeHtml(path)}</code>`,
          size: 'md',
          buttons: [
            {
              label: 'Remove',
              variant: 'danger',
              onClick: async (m) => {
                m.setLoading(true)
                try {
                  await vaultService.removeRecentVault(path)
                  await this.loadRecentVaults()
                  m.close()
                } catch (error) {
                  m.setLoading(false)
                  console.error('[SettingsView] Failed to remove recent vault:', error)
                }
              }
            },
            { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() }
          ]
        })
      })
    })
  }

  private filterSettings(): void {
    const query = this.searchQuery.trim().toLowerCase()
    const isSearching = query !== ''

    const sections = this.container.querySelectorAll(
      '.settings-view__section'
    ) as NodeListOf<HTMLElement>
    const rows = this.container.querySelectorAll(
      '.settings-row, .settings-field'
    ) as NodeListOf<HTMLElement>

    requestAnimationFrame(() => {
      // 1. Filter rows
      rows.forEach((row) => {
        // textContent is faster than innerText (no layout trigger)
        const searchText = (row.dataset.search || row.textContent || '').toLowerCase()
        const matches = !isSearching || searchText.includes(query)
        row.style.display = matches ? '' : 'none'
      })

      // 2. Handle section visibility
      sections.forEach((section) => {
        if (isSearching) {
          const sectionRows = section.querySelectorAll(
            '.settings-row, .settings-field'
          ) as NodeListOf<HTMLElement>
          let hasVisibleRow = false
          // Use for loop for early exit (faster than forEach)
          for (let i = 0; i < sectionRows.length; i++) {
            if (sectionRows[i].style.display !== 'none') {
              hasVisibleRow = true
              break
            }
          }
          section.style.display = hasVisibleRow ? 'block' : 'none'
        } else {
          // Normal tab behavior
          section.style.display = section.dataset.section === this.activeSection ? 'block' : 'none'
        }
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

  private renderEditorThemeSelector(): string {
    const currentThemeId = state.settings?.editorTheme || state.settings?.theme || 'dark'
    const currentTheme = themes[currentThemeId] || themes['dark']

    // Shorten names to just the first word, special case for defaults
    const shorten = (name: string, id: string): string =>
      id === 'dark' ? 'Dark' : id === 'light' ? 'Light' : name.split(' ')[0]

    return `
      <div class="settings-custom-dropdown">
        <button class="settings-custom-dropdown__trigger">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="settings-custom-dropdown__preview-dot" style="background: ${currentTheme.colors['--primary']};"></div>
            ${shorten(currentTheme.name, currentTheme.id)}
          </div>
        </button>
        <div class="settings-custom-dropdown__menu">
          <div class="settings-custom-dropdown__list">
            ${Object.values(themes)
              .map((t) => {
                const isSelected = t.id === currentThemeId
                return `
                <div class="settings-custom-dropdown__item ${isSelected ? 'is-selected' : ''}" data-theme-id="${t.id}">
                  <div class="settings-custom-dropdown__preview-dot" style="background: ${t.colors['--primary']};"></div>
                  <span>${shorten(t.name, t.id)}</span>
                  <div class="settings-custom-dropdown__selected-dot"></div>
                </div>
              `
              })
              .join('')}
          </div>
        </div>
      </div>
    `
  }
}
