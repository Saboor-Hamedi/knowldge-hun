import { state } from '../../core/state'
import type { AppSettings } from '../../core/types'
import { codicons } from '../../utils/codicons'
import { themes } from '../../core/themes'
import { vaultService } from '../../services/vaultService'
import type { VaultInfo } from '../../services/vaultService'
import { notificationManager } from '../notification/notification'
import { createElement, CloudUpload, CloudDownload } from 'lucide'
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

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
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
          <button class="settings-view__sidebar-item ${this.activeSection === 'vault' ? 'is-active' : ''}" data-section-tab="vault">
            ${codicons.folderRoot} Vault
          </button>
          <button class="settings-view__sidebar-item ${this.activeSection === 'sync' ? 'is-active' : ''}" data-section-tab="sync">
            ${this.createLucideIcon(CloudUpload, 16)} Sync
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
                <h2 class="settings-view__section-title">Editor</h2>
            </div>

            <!-- Font Size -->
            <div class="settings-field" data-search="font size controls the editor font size px">
              <div class="settings-field__info">
                <label class="settings-field__label">Font Size</label>
                <p class="settings-field__hint">Controls the editor font size (px).</p>
              </div>
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

            <!-- Caret Width -->
            <div class="settings-field" data-search="caret width set the max width for the editor caret">
              <div class="settings-field__info">
                <label class="settings-field__label">Caret Width</label>
                <p class="settings-field__hint">Set the max width for the editor caret.</p>
              </div>
              <div class="settings-field__control">
                <input
                  type="number"
                  class="settings-input"
                  data-setting="caretMaxWidth"
                  min="1"
                  max="10"
                  value="${state.settings?.caretMaxWidth ?? 2}"
                />
              </div>
            </div>
          </div>

          <!-- Editor Options Section -->
          <div class="settings-view__section ${this.activeSection === 'editor-options' ? 'is-active' : ''}" data-section="editor-options">
            <div class="settings-view__section-header">
                <h2 class="settings-view__section-title">Editor Options</h2>
            </div>

            <!-- Caret Toggle -->
            <div class="settings-field" data-search="caret show or hide the editor caret">
              <div class="settings-field__info">
                <label class="settings-field__label">Caret</label>
                <p class="settings-field__hint">Show or hide the editor caret.</p>
              </div>
              <div class="settings-field__control">
                <label class="settings-toggle">
                  <input
                    type="checkbox"
                    data-setting="caretEnabled"
                    ${state.settings?.caretEnabled ? 'checked' : ''}
                  />
                  <span class="settings-toggle__slider"></span>
                  <span class="settings-toggle__label">Show caret</span>
                </label>
              </div>
            </div>

            <!-- Line Numbers -->
            <div class="settings-field" data-search="line numbers show or hide the line numbers in the gutter">
              <div class="settings-field__info">
                <label class="settings-field__label">Line Numbers</label>
                <p class="settings-field__hint">Show or hide the line numbers in the gutter.</p>
              </div>
              <div class="settings-field__control">
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
            </div>

            <!-- Word Wrap -->
            <div class="settings-field" data-search="word wrap wrap long lines to fit the editor width">
              <div class="settings-field__info">
                <label class="settings-field__label">Word Wrap</label>
                <p class="settings-field__hint">Wrap long lines to fit the editor width.</p>
              </div>
              <div class="settings-field__control">
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
            </div>

            <!-- Minimap -->
            <div class="settings-field" data-search="minimap show the minimap for quick navigation">
              <div class="settings-field__info">
                <label class="settings-field__label">Minimap</label>
                <p class="settings-field__hint">Show the minimap for quick navigation.</p>
              </div>
              <div class="settings-field__control">
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
          </div>

          <!-- Appearance Section -->
          <div class="settings-view__section ${this.activeSection === 'appearance' ? 'is-active' : ''}" data-section="appearance">
               <div class="settings-view__section-header">
                <h2 class="settings-view__section-title">Appearance</h2>
            </div>

            <div class="settings-field">
              <div class="settings-field__info">
                <label class="settings-field__label">Color Theme</label>
                <p class="settings-field__hint">Select your preferred color scheme for the entire application.</p>
              </div>
              <div class="settings-field__control">
                <select class="settings-input" data-setting="theme">
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

          <!-- Behavior Section -->
          <div class="settings-view__section ${this.activeSection === 'behavior' ? 'is-active' : ''}" data-section="behavior">
            <div class="settings-view__section-header">
                <h2 class="settings-view__section-title">Behavior</h2>
            </div>

            <div class="settings-field">
              <div class="settings-field__info">
                <label class="settings-field__label">Auto Save</label>
                <p class="settings-field__hint">Automatically save your notes as you type.</p>
              </div>
              <div class="settings-field__control">
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
            </div>

            <div class="settings-field">
              <div class="settings-field__info">
                <label class="settings-field__label">Auto Save Delay</label>
                <p class="settings-field__hint">Millisecond delay after your last keystroke before saving.</p>
              </div>
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
              <div class="settings-field__info">
                <label class="settings-field__label">DeepSeek API Key</label>
                <p class="settings-field__hint">Your DeepSeek API key for AI chat functionality. Get one at <a href="https://platform.deepseek.com" target="_blank" style="color: var(--primary);">platform.deepseek.com</a></p>
              </div>
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

          <!-- Vault Section -->
          <div class="settings-view__section ${this.activeSection === 'vault' ? 'is-active' : ''}" data-section="vault">
            <div class="settings-view__section-header">
              <h2 class="settings-view__section-title">Vault Management</h2>
            </div>

            <div class="settings-field">
              <div class="settings-field__info">
                <label class="settings-field__label">Current Vault</label>
                <p class="settings-field__hint">The folder where your notes are stored.</p>
              </div>
              <div class="settings-field__control" style="grid-column: 1 / -1;">
                <div class="settings-vault-path">
                  <div class="settings-vault-path__display" id="settings-vault-path-display">
                    ${state.vaultPath || 'No vault selected'}
                  </div>
                  <button class="settings-button settings-button--secondary" id="settings-vault-reveal" title="Reveal in File Explorer">
                    ${codicons.folderOpened} Reveal
                  </button>
                </div>
              </div>
            </div>

            <div class="settings-field">
              <div class="settings-field__info">
                <label class="settings-field__label">Change Vault</label>
                <p class="settings-field__hint">Select a different folder for your notes.</p>
              </div>
              <div class="settings-field__control">
                <button class="settings-button settings-button--primary" id="settings-vault-change">
                  ${codicons.newFolder} Change Vault Folder
                </button>
              </div>
            </div>

            <div class="settings-field">
              <div class="settings-field__info">
                <label class="settings-field__label">Recent Vaults</label>
                <p class="settings-field__hint">Quickly switch between recently used vaults.</p>
              </div>
              <div class="settings-field__control" style="grid-column: 1 / -1;">
                <div class="settings-vault-list" id="settings-vault-list">
                  <div class="settings-vault-list__loading">Loading recent vaults...</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sync Section -->
          <div class="settings-view__section ${this.activeSection === 'sync' ? 'is-active' : ''}" data-section="sync">
            <div class="settings-view__section-header">
              <h2 class="settings-view__section-title">GitHub Gist Sync</h2>
            </div>

            <div class="settings-field">
              <div class="settings-field__info">
                <label class="settings-field__label">GitHub Personal Access Token</label>
                <p class="settings-field__hint">Your GitHub token for Gist access. Create one at <a href="https://github.com/settings/tokens" target="_blank">github.com/settings/tokens</a></p>
              </div>
              <div class="settings-field__control">
                <input
                  type="password"
                  class="settings-input"
                  data-setting="gistToken"
                  placeholder="ghp_..."
                  value="${(state.settings as any)?.gistToken || ''}"
                />
                <button class="settings-button settings-button--secondary" id="settings-sync-test-token" style="margin-top: 8px;">
                  Test Token
                </button>
              </div>
            </div>

            <div class="settings-field">
              <div class="settings-field__info">
                <label class="settings-field__label">Gist ID</label>
                <p class="settings-field__hint">The Gist ID where your backup is stored (auto-filled after first backup).</p>
              </div>
              <div class="settings-field__control">
                <input
                  type="text"
                  class="settings-input"
                  data-setting="gistId"
                  placeholder="Auto-filled after backup"
                  value="${(state.settings as any)?.gistId || ''}"
                  readonly
                />
              </div>
            </div>

            <div class="settings-field">
              <div class="settings-field__info">
                <label class="settings-field__label">Sync Actions</label>
                <p class="settings-field__hint">Backup your entire vault to GitHub Gist or restore from a previous backup.</p>
              </div>
              <div class="settings-field__control">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <button class="settings-button settings-button--primary" id="settings-sync-backup">
                    ${this.createLucideIcon(CloudUpload, 16)} Backup to Gist
                  </button>
                  <button class="settings-button settings-button--secondary" id="settings-sync-restore">
                    ${this.createLucideIcon(CloudDownload, 16)} Restore from Gist
                  </button>
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
      container.innerHTML = '<div class="settings-vault-list__empty">No recent vaults</div>'
      return
    }

    container.innerHTML = this.recentVaults
      .map((vault) => {
        const statusIcon = vault.exists
          ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6" fill="#10b981"/><path d="M6 8l2 2 4-4" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6" fill="#ef4444"/><path d="M6 6l4 4M10 6l-4 4" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>'
        const statusClass = vault.exists ? '' : 'settings-vault-item--missing'
        const isCurrent = vault.path === state.vaultPath
        const vaultIcon = isCurrent ? codicons.folderRoot : codicons.folder

        return `
        <div class="settings-vault-item ${statusClass} ${isCurrent ? 'settings-vault-item--current' : ''}" data-vault-path="${this.escapeHtml(vault.path)}">
          <div class="settings-vault-item__header">
            <div class="settings-vault-item__icon">${vaultIcon}</div>
            <div class="settings-vault-item__status">${statusIcon}</div>
            ${
              !isCurrent
                ? `
              <button class="settings-vault-item__delete" data-action="delete" data-path="${this.escapeHtml(vault.path)}" title="Remove from recent vaults">
                ${codicons.trash}
              </button>
            `
                : ''
            }
          </div>
          <div class="settings-vault-item__body">
            <div class="settings-vault-item__name">
              ${this.escapeHtml(vault.name)}
              ${isCurrent ? '<span class="settings-vault-item__badge">Current</span>' : ''}
            </div>
            <div class="settings-vault-item__path">${this.escapeHtml(vault.path)}</div>
          </div>
          <div class="settings-vault-item__footer">
            ${
              vault.exists
                ? `
              <button class="settings-vault-item__action" data-action="select" data-path="${this.escapeHtml(vault.path)}">
                Open
              </button>
            `
                : `
              <button class="settings-vault-item__action" data-action="locate" data-path="${this.escapeHtml(vault.path)}">
                Locate
              </button>
            `
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

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
