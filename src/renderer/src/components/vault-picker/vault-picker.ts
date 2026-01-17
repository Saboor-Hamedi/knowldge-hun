import { vaultService } from '../../services/vaultService'
import type { VaultInfo } from '../../services/vaultService'
import './vault-picker.css'

export interface VaultPickerCallbacks {
  onVaultSelected: (path: string) => Promise<void>
  onVaultLocated: (originalPath: string, newPath: string) => Promise<void>
  onChooseNew: () => Promise<void>
}

export class VaultPicker {
  private container: HTMLElement
  private modal: HTMLElement | null = null
  private callbacks: VaultPickerCallbacks | null = null
  private isOpen = false

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
  }

  setCallbacks(callbacks: VaultPickerCallbacks): void {
    this.callbacks = callbacks
  }

  async show(validationError?: { path: string; error: string; suggestion?: string }): Promise<void> {
    if (!this.modal) return
    this.isOpen = true
    this.modal.classList.add('is-open')

    // Load recent vaults
    const recentVaults = await vaultService.getRecentVaults()
    await this.renderVaultList(recentVaults, validationError)
  }

  hide(): void {
    if (!this.modal) return
    this.isOpen = false
    this.modal.classList.remove('is-open')
  }

  private render(): void {
    this.modal = document.createElement('div')
    this.modal.className = 'vault-picker-modal'
    this.modal.innerHTML = `
      <div class="vault-picker-content">
        <div class="vault-picker-header">
          <h2 class="vault-picker-title">Select Vault</h2>
          <button class="vault-picker-close" id="vault-picker-close" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </div>
        <div class="vault-picker-body">
          <div class="vault-picker-error" id="vault-picker-error" style="display: none;"></div>
          <div class="vault-picker-list" id="vault-picker-list"></div>
          <div class="vault-picker-actions">
            <button class="vault-picker-button vault-picker-button--primary" id="vault-picker-choose">
              Choose New Vault Folder
            </button>
          </div>
        </div>
      </div>
    `
    this.container.appendChild(this.modal)

    // Attach events
    const closeBtn = this.modal.querySelector('#vault-picker-close') as HTMLElement
    closeBtn?.addEventListener('click', () => this.hide())

    const chooseBtn = this.modal.querySelector('#vault-picker-choose') as HTMLElement
    chooseBtn?.addEventListener('click', () => {
      if (this.callbacks) {
        void this.callbacks.onChooseNew()
      }
    })

    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide()
      }
    })
  }

  private async renderVaultList(vaults: VaultInfo[], validationError?: { path: string; error: string; suggestion?: string }): Promise<void> {
    const list = this.modal?.querySelector('#vault-picker-list') as HTMLElement
    const errorDiv = this.modal?.querySelector('#vault-picker-error') as HTMLElement
    if (!list) return

    // Show error if provided
    if (validationError && errorDiv) {
      errorDiv.style.display = 'block'
      errorDiv.innerHTML = `
        <div class="vault-picker-error-icon">⚠️</div>
        <div class="vault-picker-error-content">
          <div class="vault-picker-error-title">Vault Not Found</div>
          <div class="vault-picker-error-message">${this.escapeHtml(validationError.error)}</div>
          ${validationError.suggestion ? `<div class="vault-picker-error-suggestion">${this.escapeHtml(validationError.suggestion)}</div>` : ''}
        </div>
      `
    } else if (errorDiv) {
      errorDiv.style.display = 'none'
    }

    if (vaults.length === 0) {
      list.innerHTML = `
        <div class="vault-picker-empty">
          <div class="vault-picker-empty-icon">📁</div>
          <div class="vault-picker-empty-text">No recent vaults</div>
          <div class="vault-picker-empty-hint">Choose a vault folder to get started</div>
        </div>
      `
      return
    }

    list.innerHTML = vaults.map((vault, index) => {
      const statusIcon = vault.exists ? '✅' : '❌'
      const statusText = vault.exists ? 'Available' : 'Not found'
      const lastOpened = vault.lastOpened ? new Date(vault.lastOpened).toLocaleDateString() : ''

      return `
        <div class="vault-picker-item ${!vault.exists ? 'vault-picker-item--missing' : ''}" data-index="${index}" data-path="${this.escapeHtml(vault.path)}">
          <div class="vault-picker-item-main">
            <div class="vault-picker-item-icon">📁</div>
            <div class="vault-picker-item-info">
              <div class="vault-picker-item-name">${this.escapeHtml(vault.name)}</div>
              <div class="vault-picker-item-path">${this.escapeHtml(vault.path)}</div>
              ${lastOpened ? `<div class="vault-picker-item-meta">Last opened: ${lastOpened}</div>` : ''}
            </div>
            <div class="vault-picker-item-status">
              <span class="vault-picker-item-status-icon">${statusIcon}</span>
              <span class="vault-picker-item-status-text">${statusText}</span>
            </div>
          </div>
          ${!vault.exists ? `
            <div class="vault-picker-item-actions">
              <button class="vault-picker-item-action" data-action="locate" data-path="${this.escapeHtml(vault.path)}">
                🔍 Locate
              </button>
            </div>
          ` : ''}
        </div>
      `
    }).join('')

    // Attach click handlers
    const items = list.querySelectorAll('.vault-picker-item')
    items.forEach(item => {
      const path = (item as HTMLElement).dataset.path
      if (!path) return

      // Click on item to select
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        // Don't trigger if clicking on action button
        if (target.closest('.vault-picker-item-action')) return

        const vault = vaults.find(v => v.path === path)
        if (vault?.exists && this.callbacks) {
          void this.callbacks.onVaultSelected(path)
        }
      })

      // Locate button handler
      const locateBtn = item.querySelector('[data-action="locate"]') as HTMLElement
      locateBtn?.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!this.callbacks) return

        // Try to locate the moved vault
        const foundPath = await vaultService.locateMovedVault(path)
        if (foundPath) {
          await this.callbacks.onVaultLocated(path, foundPath)
        } else {
          // If not found, show choose dialog
          await this.callbacks.onChooseNew()
        }
      })
    })
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
