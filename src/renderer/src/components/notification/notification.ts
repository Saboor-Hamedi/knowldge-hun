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

  public show(message: string, type: NotificationType = 'info', options: NotificationOptions = {}): void {
    const { title, duration = 4000 } = options

    const notification = document.createElement('div')
    notification.className = `notification notification--${type}`

    const icon = this.getIcon(type)
    
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

    if (duration > 0) {
      setTimeout(() => {
        this.remove(notification)
      }, duration)
    }
  }

  private remove(element: HTMLElement): void {
    if (!element.isConnected) return
    
    element.style.animation = 'fadeOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
    element.addEventListener('animationend', () => {
        if (element.isConnected) {
            this.container.removeChild(element)
        }
    })
  }

  private getIcon(type: NotificationType): string {
    switch (type) {
      case 'error': return codicons.error || '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zM4 8a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7A.5.5 0 014 8z"/></svg>'
      case 'warning': return codicons.warning || '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 14h14L8 1z"/></svg>'
      case 'success': return codicons.check || '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>'
      default: return codicons.info || '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM8 4a1 1 0 100-2 1 1 0 000 2zm.75 3.5a.75.75 0 00-1.5 0v4a.75.75 0 001.5 0v-4z"/></svg>'
    }
  }
}

export const notificationManager = NotificationManager.getInstance()
