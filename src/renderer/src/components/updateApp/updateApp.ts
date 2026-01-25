// --- Main process update logic ---
import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

export function setupUpdateApp(mainWindow: BrowserWindow) {
  ipcMain.on('app:update', () => {
    autoUpdater.checkForUpdates()
  })

  autoUpdater.on('update-available', async () => {
    // Backup sessions before update
    try {
      await mainWindow.webContents.executeJavaScript(`
        if (window.sessionBackupService) {
          window.sessionBackupService.backupBeforeUpdate()
        }
      `)
    } catch (error) {
      console.error('Failed to backup sessions before update:', error)
    }

    mainWindow.webContents.send('update:available')
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update:not-available')
  })

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('update:progress', progressObj)
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update:downloaded')
    autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send(
      'update:error',
      err == null ? 'unknown' : err.message || err.toString()
    )
  })
}
