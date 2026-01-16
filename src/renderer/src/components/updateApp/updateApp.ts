import { notificationManager } from '../notification/notification'

export type UpdateState = 'idle' | 'checking' | 'progress' | 'restart'

export class UpdateApp {
  public state: UpdateState = 'idle'
  public progress: number = 0
  private listeners: Array<(state: UpdateState, progress: number) => void> = []

  constructor() {
    this.wireUpdateEvents()
  }

  public checkForUpdate() {
    this.state = 'checking'
    this.progress = 0
    this.emit()
    window.api?.requestUpdate?.()
    notificationManager.show('Checking for updates...', 'info', { title: 'Update' })
    setTimeout(() => {
      if (this.state === 'checking') {
        this.state = 'idle'
        this.emit()
        notificationManager.show('No update found (timeout).', 'info', { title: 'Update' })
      }
    }, 8000)
  }

  public onStateChange(listener: (state: UpdateState, progress: number) => void) {
    this.listeners.push(listener)
  }

  private emit() {
    this.listeners.forEach(fn => fn(this.state, this.progress))
  }

  private wireUpdateEvents() {
    window.electron?.ipcRenderer?.on?.('update:available', () => {
      this.state = 'progress'
      this.progress = 0
      this.emit()
      notificationManager.show('Update available. Downloading...', 'info', { title: 'Update' })
    })
    window.electron?.ipcRenderer?.on?.('update:not-available', () => {
      this.state = 'idle'
      this.progress = 0
      this.emit()
      notificationManager.show('No update available.', 'info', { title: 'Update' })
    })
    window.electron?.ipcRenderer?.on?.('update:progress', (_event, progressObj) => {
      this.state = 'progress'
      this.progress = progressObj.percent || 0
      this.emit()
    })
    window.electron?.ipcRenderer?.on?.('update:downloaded', () => {
      this.state = 'restart'
      this.progress = 100
      this.emit()
      notificationManager.show('Update downloaded. Click to restart.', 'info', { title: 'Update' })
    })
    window.electron?.ipcRenderer?.on?.('update:error', (_event, errMsg) => {
      this.state = 'idle'
      this.progress = 0
      this.emit()
      notificationManager.show(`Update error: ${errMsg}`, 'error', { title: 'Update' })
    })
  }
}

export const updateApp = new UpdateApp()
