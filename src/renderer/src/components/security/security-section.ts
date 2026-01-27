import { securityService } from '../../services/security/securityService'
import { notificationManager } from '../notification/notification'
import { modalManager } from '../modal/modal'
import { createElement, KeyRound, ShieldCheck, ShieldAlert, LogOut, Info } from 'lucide'

/**
 * SECURITY UI COMPONENT:
 *
 * This component provides the user interface within the "Settings" panel
 * to manage the application's login system.
 */
export class SecuritySection {
  private createLucideIcon(IconComponent: unknown, size: number = 16): string {
    const svgElement = createElement(IconComponent, {
      size: size,
      'stroke-width': 1.5,
      stroke: 'currentColor',
      color: 'currentColor'
    })
    return svgElement?.outerHTML || ''
  }

  render(): string {
    const hasPassword = securityService.hasPassword()

    return `
      <div class="settings-view__section-header security-header">
        <div class="security-header__title">
          <h2 class="settings-view__section-title">Security & Privacy</h2>
          <div class="security-tooltip">
            ${this.createLucideIcon(Info, 14)}
            <span class="security-tooltip__content">
              <strong>Airlock Technology</strong>: Intercepts all hardware events at the driver level to prevent data leaks when locked.
            </span>
          </div>
        </div>
      </div>

      <div class="settings-list">
        <!-- Vault Protection Row -->
        <div class="settings-row">
          <div class="settings-row__icon">${this.createLucideIcon(ShieldCheck, 18)}</div>
          <div class="settings-row__info">
            <label class="settings-row__label">Vault Protection</label>
            <p class="settings-row__hint">Require a master password on startup and for sensitive actions.</p>
          </div>
          <div class="settings-row__action">
            <label class="settings-toggle">
              <input type="checkbox" id="security-lock-toggle" ${hasPassword ? 'checked' : ''} />
              <span class="settings-toggle__slider"></span>
            </label>
          </div>
        </div>

        ${
          hasPassword
            ? `
        <!-- Change Password Row -->
        <div class="settings-row">
          <div class="settings-row__icon">${this.createLucideIcon(KeyRound, 18)}</div>
          <div class="settings-row__info">
            <label class="settings-row__label">Change Credentials</label>
            <p class="settings-row__hint">Update your local application password.</p>
          </div>
          <div class="settings-row__action">
            <button class="settings-button settings-button--sm settings-button--secondary" id="security-change-password">
              Update
            </button>
          </div>
        </div>
        `
            : `
        <div class="security-alert-box">
          <div class="security-alert-box__icon">${this.createLucideIcon(ShieldAlert, 18)}</div>
          <span>Vault is currently unprotected and visible to anyone with access to this device.</span>
        </div>
        `
        }

        <div class="settings-divider"></div>

        <!-- Session Control Row -->
        <div class="settings-row">
          <div class="settings-row__icon">${this.createLucideIcon(LogOut, 18)}</div>
          <div class="settings-row__info">
            <label class="settings-row__label">Lock Session</label>
            <p class="settings-row__hint">Immediately terminate current session and return to login screen.</p>
          </div>
          <div class="settings-row__action">
            <button class="settings-button settings-button--sm settings-button--primary" id="security-lock-now">
              Lock Now
            </button>
          </div>
        </div>
      </div>

      <style>
        .security-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .security-header__title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .security-tooltip {
          position: relative;
          color: var(--text-muted);
          cursor: help;
          display: flex;
          align-items: center;
          transition: color 0.2s ease;
        }

        .security-tooltip:hover {
          color: var(--primary);
        }

        .security-tooltip__content {
          position: absolute;
          bottom: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%) translateY(5px);
          width: 220px;
          background: var(--panel-strong);
          border: 1px solid var(--border);
          padding: 12px;
          border-radius: 8px;
          font-size: 11px;
          line-height: 1.5;
          color: var(--text-soft);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          pointer-events: none;
          opacity: 0;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 100;
        }

        .security-tooltip:hover .security-tooltip__content {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        .security-alert-box {
          margin: 8px 16px;
          padding: 10px 14px;
          background: rgba(248, 113, 113, 0.05);
          border: 1px solid rgba(248, 113, 113, 0.15);
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #fca5a5;
          font-size: 11px;
        }

        .security-alert-box__icon {
          flex-shrink: 0;
        }
      </style>
    `
  }

  attachEvents(container: HTMLElement, onUpdate: () => void): void {
    const toggle = container.querySelector('#security-lock-toggle') as HTMLInputElement
    const changeBtn = container.querySelector('#security-change-password')
    const lockNowBtn = container.querySelector('#security-lock-now')

    toggle?.addEventListener('change', async () => {
      const isEnabling = toggle.checked

      if (isEnabling) {
        this.promptSetPassword(
          () => {
            notificationManager.show('Password protection enabled', 'success')
            onUpdate()
          },
          () => {
            onUpdate() // Revert toggle state on cancel
          }
        )
      } else {
        const verified = await securityService.verifyAction()
        if (verified) {
          await securityService.removePassword()
          notificationManager.show('Password protection disabled', 'success')
          onUpdate()
        } else {
          onUpdate() // Revert toggle state if verification fails/cancelled
        }
      }
    })

    changeBtn?.addEventListener('click', async () => {
      const verified = await securityService.verifyAction()
      if (verified) {
        this.promptSetPassword(() => {
          notificationManager.show('Password changed successfully', 'success')
        })
      }
    })

    lockNowBtn?.addEventListener('click', async () => {
      void securityService.promptAndLock()
    })
  }

  private promptSetPassword(onSuccess: () => void, onCancel?: () => void): void {
    modalManager.open({
      title: 'Setup Vault Protection',
      content: 'Choose a master password. This password stays on your machine.',
      size: 'sm',
      inputs: [
        { name: 'p1', label: 'New Password', type: 'password', required: true },
        { name: 'p2', label: 'Confirm Password', type: 'password', required: true }
      ],
      buttons: [
        {
          label: 'Cancel',
          variant: 'ghost',
          onClick: (m) => {
            m.close()
            onCancel?.()
          }
        },
        {
          label: 'Protect Vault',
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

            await securityService.setPassword(p1)
            m.close()
            onSuccess()
          }
        }
      ]
    })
  }
}
