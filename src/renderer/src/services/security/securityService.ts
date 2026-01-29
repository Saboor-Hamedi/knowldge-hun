import { state } from '../../core/state'
import { modalManager } from '../../components/modal/modal'
import type { AppSettings } from '../../core/types'
import { keyboardManager } from '../../core/keyboardManager'
import { notificationManager } from '../../components/notification/notification'
import './security.css'

/**
 * SECURITY ARCHITECTURE OVERVIEW:
 *
 * This service manages the "Firewall" (Login) system and vault encryption status.
 * It sits between the user and the application data, ensuring the UI
 * is completely isolated until authorized.
 *
 * CORE CONNECTIONS:
 * - state.ts: Watches for 'passwordHash' in global settings to decide if locking is needed.
 * - app.ts: Calls 'requestUnlock' during initial application startup.
 * - keyboardManager.ts: Temporarily disabled during lock to kill background shortcuts.
 * - layout.css: Provides .security-firewall and .is-blurred classes for visual isolation.
 * - security-section.ts: The UI component in Settings that calls 'setPassword/removePassword'.
 */
export class SecurityService {
  // Session-volatile flag. If false, firewall is shown.
  private isUnlocked = false

  /**
   * Check if a password is set in settings.
   * Pulls from: state.ts -> AppSettings
   */
  hasPassword(): boolean {
    return !!(state.settings as AppSettings)?.passwordHash
  }

  /**
   * Status check for the app.
   * If no password exists, it's considered perpetually unlocked.
   */
  isAppUnlocked(): boolean {
    if (!this.hasPassword()) return true
    return this.isUnlocked
  }

  /**
   * Entry point for the Login Screen (Firewall).
   * Called by: app.ts (during App.init)
   */
  async requestUnlock(): Promise<boolean> {
    if (!this.hasPassword()) return true
    if (this.isUnlocked) return true

    return new Promise((resolve) => {
      this.showFirewall({
        onSuccess: () => {
          this.isUnlocked = true
          resolve(true)
        }
      })
    })
  }

  /**
   * Renders the Hardware-Accelerated Firewall Overlay.
   * Uses: layout.css for blur and glassmorphism styling.
   *
   * This method manually manipulates the DOM to ensure it overlays even
   * logic-based components.
   */
  private async showFirewall(options: { onSuccess: () => void }): Promise<void> {
    // 0. Prevent duplicate firewalls
    if (document.querySelector('.security-firewall')) return

    // 1. Apply instant visual isolation
    const app = document.querySelector('.vscode-shell')
    if (app) {
      app.classList.add('is-blurred')
      // Disable transitions to prevent flickering during lock
      Object.assign((app as HTMLElement).style, {
        transition: 'none',
        filter: 'blur(20px) grayscale(0.2)'
      })
    }

    // 2. Create the standalone Login Screen
    const firewall = document.createElement('div')
    firewall.className = 'security-firewall'

    // Critical inline styles to prevent startup flicker/misalignment
    Object.assign(firewall.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483647',
      display: 'grid',
      placeItems: 'center',
      background: 'rgba(10, 15, 25, 0.9)',
      backdropFilter: 'blur(30px) saturate(150%)',
      webkitBackdropFilter: 'blur(30px) saturate(150%)'
    })

    firewall.tabIndex = 0

    // Display the computer user name
    const username = await window.api.getUsername().catch(() => 'User')

    firewall.innerHTML = `
      <div class="security-firewall__content">
        <div class="security-firewall__profile">
          <div class="security-firewall__avatar">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="security-firewall__username">${username}</div>
        </div>
        
        <div class="security-firewall__input-group">
          <input type="password" class="security-firewall__input" placeholder="Password" autofocus autocomplete="current-password">
          <button class="security-firewall__btn security-firewall__btn--primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <div class="security-firewall__error"></div>
        </div>
      </div>
    `

    document.body.appendChild(firewall)

    const input = firewall.querySelector('.security-firewall__input') as HTMLInputElement
    const btn = firewall.querySelector('.security-firewall__btn--primary') as HTMLButtonElement
    const errorDisplay = firewall.querySelector('.security-firewall__error') as HTMLElement

    /**
     * GLOBAL EVENT ISOLATION (THE "AIRLOCK"):
     * This interceptor blocks all interactions from reaching the app background.
     * Captured phase (true) ensures we catch events before any other component.
     */
    const blockEvents = (e: Event): void => {
      const target = e.target as HTMLElement
      // Exception: Window management buttons (Min/Max/Close) in the header
      const isHeaderControl = target?.closest('.wh-min, .wh-max, .wh-close, .window-header')
      const isActivityBar = target?.closest('.activitybar') // 🔓 ALLOWED per user request
      const isFirewallInput = target?.classList.contains('security-firewall__input')
      const isFirewallBtn = target?.classList.contains('security-firewall__btn')

      // Allow only window controls, activity bar, and firewall interaction
      if (isHeaderControl || isActivityBar || isFirewallInput || isFirewallBtn) {
        // Even for firewall input, block CMD/CTRL shortcuts that might toggle background panels
        if (e instanceof KeyboardEvent && (e.ctrlKey || e.metaKey || e.altKey)) {
          e.preventDefault()
          e.stopPropagation()
        }
        return
      }

      // Kill the event before it bubbles down to the main app logic
      e.preventDefault()
      e.stopPropagation()
    }

    // 3. Disable the global shortcut registry (keyboardManager.ts)
    // This prevents things like Ctrl+B (Sidebar) from firing.
    keyboardManager.setEnabled(false)

    // Apply the Airlock listeners
    window.addEventListener('keydown', blockEvents, true)
    window.addEventListener('mousedown', blockEvents, true)
    window.addEventListener('contextmenu', blockEvents, true)

    const handleUnlock = async (): Promise<void> => {
      const password = input.value
      if (!password) {
        input.classList.add('is-invalid')
        setTimeout(() => input.classList.remove('is-invalid'), 500)
        return
      }

      // Visual feedback during hashing/crypto work
      btn.disabled = true
      btn.innerHTML = `<span class="security-firewall__spinner"></span>`

      const isValid = await this.verifyPassword(password)
      if (isValid) {
        //  RESTORE APPLICATION STATE
        keyboardManager.setEnabled(true)
        window.removeEventListener('keydown', blockEvents, true)
        window.removeEventListener('mousedown', blockEvents, true)
        window.removeEventListener('contextmenu', blockEvents, true)

        firewall.classList.add('is-leaving')
        const appShell = document.querySelector('.vscode-shell') as HTMLElement
        if (appShell) {
          appShell.classList.remove('is-blurred')
          appShell.style.filter = ''
          appShell.style.transition = ''
        }

        // Remove from DOM after transition finishes
        setTimeout(() => {
          firewall.remove()
          options.onSuccess()
        }, 400)
      } else {
        // Handle incorrect attempt
        btn.disabled = false
        btn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        `
        input.classList.add('is-invalid')
        errorDisplay.textContent = 'Wrong password'
        input.value = ''
        input.focus()
        setTimeout(() => input.classList.remove('is-invalid'), 500)
      }
    }

    btn.addEventListener('click', handleUnlock)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        handleUnlock()
      }
    })

    // Immediate focus for faster typing
    setTimeout(() => input.focus(), 100)
  }

  /**
   * Lightweight password verification for specific actions (like deleting items).
   * Used for "Confirmation Modals" throughout the app.
   */
  async verifyAction(): Promise<boolean> {
    if (!this.hasPassword()) return true

    return new Promise((resolve) => {
      this.promptForPassword({
        title: 'Verify Action',
        message: 'Enter password to confirm this sensitive action.',
        onSuccess: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })
  }

  /**
   * Individual Password Prompt.
   * Connects to: modal.ts (Standard application modal system)
   */
  private promptForPassword(options: {
    title: string
    message: string
    onSuccess: () => void
    onCancel: () => void
  }): void {
    let confirmed = false
    modalManager.open({
      title: options.title,
      content: options.message,
      size: 'sm',
      onClose: () => {
        if (!confirmed) options.onCancel()
      },
      inputs: [
        {
          name: 'password',
          label: 'Password',
          type: 'password',
          placeholder: '••••••••',
          required: true
        }
      ],
      buttons: [
        {
          label: 'Cancel',
          variant: 'ghost',
          onClick: (m) => {
            m.close()
          }
        },
        {
          label: 'Confirm',
          variant: 'primary',
          onClick: async (m) => {
            const values = m.getValues()
            const input = (values.password as string) || ''

            const isValid = await this.verifyPassword(input)
            if (isValid) {
              confirmed = true
              m.close()
              options.onSuccess()
            } else {
              const inputEl = m.findInput('password')
              if (inputEl) {
                inputEl.style.borderColor = '#f87171'
                inputEl.style.boxShadow = '0 0 0 2px rgba(248, 113, 113, 0.1)'

                // Add error message text
                let errorMsg = inputEl.parentElement?.querySelector(
                  '.modal__error-text'
                ) as HTMLElement
                if (!errorMsg) {
                  errorMsg = document.createElement('div')
                  errorMsg.className = 'modal__error-text'
                  errorMsg.style.color = '#f87171'
                  errorMsg.style.fontSize = '12px'
                  errorMsg.style.marginTop = '4px'
                  errorMsg.textContent = 'Wrong password'
                  inputEl.parentElement?.appendChild(errorMsg)
                }

                setTimeout(() => {
                  inputEl.style.borderColor = ''
                  inputEl.style.boxShadow = ''
                  errorMsg?.remove()
                }, 2000)
              }
            }
          }
        }
      ]
    })
  }

  /**
   * One-way cryptographic comparison.
   * Logic: Hash(Input) === StoredHash
   */
  async verifyPassword(password: string): Promise<boolean> {
    const hash = (state.settings as AppSettings)?.passwordHash
    if (!hash) return true

    const computedHash = await this.hashPassword(password)
    return computedHash === hash
  }

  /**
   * Persists a new password to Disk.
   * Path: Main Process -> disk (settings.json)
   */
  async setPassword(password: string): Promise<void> {
    const hash = await this.hashPassword(password)
    // Send to main process via window.api (Electron IPC)
    await window.api.updateSettings({ passwordHash: hash } as Partial<AppSettings>)
    // Update global state immediately (state.ts)
    if (state.settings) {
      state.settings.passwordHash = hash
    }
    this.isUnlocked = true
  }

  /**
   * Clears security protection.
   * Wipe hash from disk and local memory.
   */
  async removePassword(): Promise<void> {
    await window.api.updateSettings({ passwordHash: null } as Partial<AppSettings>)
    if (state.settings) {
      state.settings.passwordHash = null
    }
    this.isUnlocked = true
  }

  /**
   * Cryptographic Hash (SHA-256).
   * Output: 64-character hex string.
   */
  private async hashPassword(password: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Instant lock (used for session timeout or manual lock)
   */
  lock(): void {
    this.isUnlocked = false
  }

  /**
   * High-level flow for locking the session.
   * Logic:
   * 1. If password exists -> lock and reload.
   * 2. If no password -> prompt user to create one first, then lock.
   */
  async promptAndLock(): Promise<void> {
    if (this.hasPassword()) {
      this.lock()
      // Trigger the firewall overlay without a reload
      await this.requestUnlock()
      return
    }

    return new Promise((resolve) => {
      modalManager.open({
        title: 'Setup Vault Protection',
        content: 'You must set a master password before you can lock the application.',
        size: 'sm',
        onClose: () => resolve(),
        inputs: [
          {
            name: 'p1',
            label: 'New Password',
            type: 'password',
            placeholder: '••••••••',
            required: true
          },
          {
            name: 'p2',
            label: 'Confirm Password',
            type: 'password',
            placeholder: '••••••••',
            required: true
          }
        ],
        buttons: [
          { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() },
          {
            label: 'Set Password & Lock',
            variant: 'primary',
            onClick: async (m) => {
              const values = m.getValues()
              const p1 = values.p1 as string
              const p2 = values.p2 as string

              if (p1 !== p2) {
                notificationManager.show('Passwords do not match', 'error')
                return
              }
              if (p1.length < 4) {
                notificationManager.show('Min 4 characters', 'warning')
                return
              }

              await this.setPassword(p1)
              m.close()
              this.lock()
              void this.requestUnlock()
              resolve()
            }
          }
        ]
      })
    })
  }

  /**
   * Securely change the master password via nested verification.
   */
  async promptChangePassword(): Promise<void> {
    if (!this.hasPassword()) {
      return this.promptAndLock()
    }

    // 1. Verify existing password first
    const verified = await this.verifyAction()
    if (!verified) return

    // 2. Prompt for new password
    return new Promise((resolve) => {
      modalManager.open({
        title: 'Change Master Password',
        content: 'Enter your new master password below. This will be used for all future logins.',
        size: 'sm',
        onClose: () => resolve(),
        inputs: [
          {
            name: 'p1',
            label: 'New Password',
            type: 'password',
            placeholder: '••••••••',
            required: true
          },
          {
            name: 'p2',
            label: 'Confirm Password',
            type: 'password',
            placeholder: '••••••••',
            required: true
          }
        ],
        buttons: [
          { label: 'Cancel', variant: 'ghost', onClick: (m) => m.close() },
          {
            label: 'Update Password',
            variant: 'primary',
            onClick: async (m) => {
              const values = m.getValues()
              const p1 = values.p1 as string
              const p2 = values.p2 as string

              if (p1 !== p2) {
                notificationManager.show('Passwords do not match', 'error')
                return
              }
              if (p1.length < 4) {
                notificationManager.show('Min 4 characters', 'warning')
                return
              }

              await this.setPassword(p1)
              notificationManager.show('Password updated successfully', 'success')
              m.close()
              resolve()
            }
          }
        ]
      })
    })
  }
}

// Singleton export - accessible as securityService.
export const securityService = new SecurityService()
