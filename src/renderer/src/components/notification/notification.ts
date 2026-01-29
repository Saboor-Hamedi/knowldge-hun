import { codicons } from '../../utils/codicons'
import './notification.css'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface NotificationOptions {
  title?: string
  duration?: number
}

export class NotificationManager {
  private static instance: NotificationManager
  private container: HTMLElement

  private constructor() {
    this.container = document.createElement('div')
    this.container.className = 'notification-container'
    document.body.appendChild(this.container)
  }

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager()
    }
    return NotificationManager.instance
  }

  private currentUpdateNotification: HTMLElement | null = null
  private currentUpdateTimeout: ReturnType<typeof setTimeout> | null = null

  public show(
    message: string,
    type: NotificationType = 'info',
    options: NotificationOptions = {}
  ): void {
    const { title, duration = 4000 } = options
    const isUpdate = title === 'Update' || title === 'Sync'

    // Ensure success notifications stick around longer
    const finalDuration = type === 'success' ? Math.max(duration, 6000) : duration

    let notification: HTMLElement
    if (isUpdate && this.currentUpdateNotification) {
      // Update content in place
      notification = this.currentUpdateNotification

      // Stop any removal process and reset animations
      notification.style.animation = 'none'
      void notification.offsetHeight // Trigger reflow
      notification.style.animation = ''

      notification.className = `notification notification--${type}`

      const iconDiv = notification.querySelector('.notification__icon') as HTMLElement
      const contentDiv = notification.querySelector('.notification__content') as HTMLElement
      if (iconDiv) iconDiv.innerHTML = this.getIcon(type, title, message)
      if (contentDiv) {
        contentDiv.innerHTML = `
          ${title ? `<div class="notification__title">${title}</div>` : ''}
          <div class="notification__message">${message}</div>
        `
      }

      // Re-attach close listener
      const closeBtn = notification.querySelector('.notification__close') as HTMLButtonElement
      if (closeBtn) closeBtn.onclick = () => this.remove(notification)

      // ALWAYS clear previous timeout for updatable notifications
      if (this.currentUpdateTimeout) {
        clearTimeout(this.currentUpdateTimeout)
        this.currentUpdateTimeout = null
      }
    } else {
      notification = document.createElement('div')
      notification.className = `notification notification--${type}`
      const icon = this.getIcon(type, title, message)
      notification.innerHTML = `
        <div class="notification__icon">
          ${icon}
        </div>
        <div class="notification__content">
          ${title ? `<div class="notification__title">${title}</div>` : ''}
          <div class="notification__message">${message}</div>
        </div>
        <button class="notification__close">
          ${codicons.close}
        </button>
      `
      const closeBtn = notification.querySelector('.notification__close') as HTMLButtonElement
      closeBtn.onclick = () => this.remove(notification)
      this.container.appendChild(notification)
      if (isUpdate) {
        this.currentUpdateNotification = notification
      }
    }

    if (finalDuration > 0) {
      if (isUpdate) {
        if (this.currentUpdateTimeout) {
          clearTimeout(this.currentUpdateTimeout)
        }
        this.currentUpdateTimeout = setTimeout(() => {
          this.remove(notification)
          if (this.currentUpdateNotification === notification) {
            this.currentUpdateNotification = null
            this.currentUpdateTimeout = null
          }
        }, finalDuration)
      } else {
        setTimeout(() => {
          this.remove(notification)
        }, finalDuration)
      }
    }
  }

  private remove(element: HTMLElement): void {
    if (!element.isConnected) return

    // Clear tracking references if this is the active update notification
    if (this.currentUpdateNotification === element) {
      this.currentUpdateNotification = null
      if (this.currentUpdateTimeout) {
        clearTimeout(this.currentUpdateTimeout)
        this.currentUpdateTimeout = null
      }
    }

    element.style.animation = 'fadeOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
    element.addEventListener(
      'animationend',
      () => {
        if (element.isConnected) {
          this.container.removeChild(element)
        }
      },
      { once: true }
    )
  }

  private getIcon(type: NotificationType, title?: string, message?: string): string {
    const isSyncing =
      message &&
      (message.toLowerCase().includes('checking') ||
        message.toLowerCase().includes('restoring') ||
        message.toLowerCase().includes('backing up') ||
        message.toLowerCase().includes('indexing'))

    // Show spinner for active operations
    if ((title === 'Update' || title === 'Sync') && isSyncing) {
      return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="transform-origin:center;animation:notification-spin 1s linear infinite;"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" fill="none" opacity="0.2"/><path d="M15 8a7 7 0 01-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
    }

    if (title === 'Update' || title === 'Sync') {
      if (type === 'success') return codicons.check || ''
      if (type === 'error') return codicons.error || ''
      return codicons.cloudDownload || ''
    }

    switch (type) {
      case 'error':
        return codicons.error || ''
      case 'warning':
        return codicons.warning || ''
      case 'success':
        return codicons.check || ''
      default:
        return codicons.info || ''
    }
  }
}

export const notificationManager = NotificationManager.getInstance()
