//
import { notificationManager } from '../renderer/src/components/notification/notification'

declare global {
  interface Window {
    api?: unknown
    electron?: unknown
  }
}

export type UpdateState = 'idle' | 'checking' | 'progress' | 'restart'

class UpdateApp {
  public state: UpdateState = 'idle'
  public progress: number = 0
  private listeners: Array<(state: UpdateState, progress: number) => void> = []
  private updateTimeout: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.wireUpdateEvents()
  }

  public checkForUpdate(): void {
    this.state = 'checking'
    this.progress = 0
    this.emit()
    (window.api as unknown as { requestUpdate?: () => void })?.requestUpdate?.()
    notificationManager.show('Checking for updates...', 'info', { title: 'Update' })
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout)
    }
    this.updateTimeout = setTimeout(() => {
      if (this.state === 'checking') {
        this.state = 'idle'
        this.emit()
        notificationManager.show('No update found (timeout).', 'info', { title: 'Update' })
      }
      this.updateTimeout = null
    }, 8000)
  }

  public onStateChange(listener: (state: UpdateState, progress: number) => void): void {
    this.listeners.push(listener)
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn(this.state, this.progress))
  }

  private wireUpdateEvents(): void {
    window.electron && typeof window.electron === 'object' &&
      (window.electron as any).ipcRenderer?.on?.('update:available', () => {
        this.state = 'progress'
        this.progress = 0
        this.emit()
        notificationManager.show('Update available. Downloading...', 'info', { title: 'Update' })
        if (this.updateTimeout) {
          clearTimeout(this.updateTimeout)
          this.updateTimeout = null
        }
      })



    window.electron && typeof window.electron === 'object' &&
      (window.electron as any).ipcRenderer?.on?.('update:not-available', () => {
        this.state = 'idle'
        this.progress = 0
        this.emit()
        notificationManager.show('No update available.', 'info', { title: 'Update' })
        if (this.updateTimeout) {
          clearTimeout(this.updateTimeout)
          this.updateTimeout = null
        }
      })
    window.electron && typeof window.electron === 'object' &&
      (window.electron as any).ipcRenderer?.on?.('update:progress', (_event: unknown, progressObj: { percent?: number }) => {
        this.state = 'progress'
        this.progress = progressObj.percent || 0
        this.emit()
      })
    window.electron && typeof window.electron === 'object' &&
      (window.electron as any).ipcRenderer?.on?.('update:downloaded', () => {
        this.state = 'restart'
        this.progress = 100
        this.emit()
        notificationManager.show('Update downloaded. Click to restart.', 'info', { title: 'Update' })
        if (this.updateTimeout) {
          clearTimeout(this.updateTimeout)
          this.updateTimeout = null
        }
      })
    window.electron && typeof window.electron === 'object' &&
      (window.electron as any).ipcRenderer?.on?.('update:error', (_event: unknown, errMsg: unknown) => {
        this.state = 'idle'
        this.progress = 0
        this.emit()
        notificationManager.show(`Update error: ${errMsg}`, 'error', { title: 'Update' })
        if (this.updateTimeout) {
          clearTimeout(this.updateTimeout)
          this.updateTimeout = null
        }
      })
  }
}

export const updateApp = new UpdateApp()
