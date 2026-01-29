import { state } from '../../core/state'
import { notificationManager } from '../../components/notification/notification'
import { modalManager } from '../../components/modal/modal'
import { VaultHandler } from '../../handlers/VaultHandler'

export class SyncHandler {
  constructor(private vaultHandler: VaultHandler) {}

  public async backupVault(): Promise<void> {
    const settings = (await window.api.getSettings()) as any
    const { gistToken, gistId } = settings
    if (!gistToken) {
      return notificationManager.show('GitHub token missing in settings', 'warning', {
        title: 'Sync'
      })
    }

    notificationManager.show('Backing up vault...', 'info', { title: 'Sync' })
    try {
      const vaultData = await window.api.listNotes()
      const notes = (
        await Promise.all(
          vaultData.filter((n) => n.type !== 'folder').map((n) => window.api.loadNote(n.id))
        )
      ).filter((n) => n !== null)

      const res = await window.api.syncBackup(gistToken, gistId, notes)
      if (res.success) {
        notificationManager.show(res.message, 'success', { title: 'Sync' })
        if (res.gistId) await window.api.updateSettings({ gistId: res.gistId } as any)
      } else {
        notificationManager.show(res.message, 'error', { title: 'Sync' })
      }
    } catch (err: any) {
      console.error('Backup failed:', err)
      notificationManager.show('Backup process failed', 'error', { title: 'Sync' })
    }
  }

  public async restoreVault(): Promise<void> {
    const settings = (await window.api.getSettings()) as any
    const { gistToken, gistId } = settings
    if (!gistToken) {
      return notificationManager.show('GitHub token missing in settings', 'warning', {
        title: 'Sync'
      })
    }
    if (!gistId) {
      return notificationManager.show('No Gist ID found to restore from', 'warning', {
        title: 'Sync'
      })
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
              const res = await window.api.syncRestore(gistToken, gistId)
              if (res.success && res.data) {
                await this.restoreVaultFromBackup(res.data)
                notificationManager.show('Restore completed successfully', 'success', {
                  title: 'Sync',
                  duration: 6000
                })
              } else {
                notificationManager.show(res.message || 'Restore failed', 'error', {
                  title: 'Sync',
                  duration: 0
                })
              }
            } catch (err: any) {
              console.error('Restore action failed:', err)
              notificationManager.show(
                `Restore failed: ${err.message || 'Unknown error'}`,
                'error',
                { title: 'Sync', duration: 0 }
              )
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
  }

  public async restoreVaultFromBackup(backupData: any): Promise<void> {
    if (!backupData || !backupData.notes || !Array.isArray(backupData.notes)) {
      throw new Error('Invalid backup data format')
    }

    await this.vaultHandler.refreshNotes()

    const notes = backupData.notes
    console.log(`[Restore] Starting restoration of ${notes.length} notes...`)
    const createdFolders = new Set<string>()
    let successCount = 0
    let failCount = 0

    for (const backupNote of notes) {
      try {
        const folderPath = backupNote.path || undefined
        const noteTitle = backupNote.title || backupNote.id

        const existingNote = state.notes.find(
          (n) => n.id.toLowerCase() === backupNote.id.toLowerCase()
        )

        if (existingNote) {
          console.log(`[Restore] Updating existing note: ${backupNote.id}`)
          await window.api.saveNote({
            id: existingNote.id,
            title: noteTitle,
            content: backupNote.content || '',
            path: folderPath,
            updatedAt: backupNote.updatedAt || Date.now(),
            createdAt: backupNote.createdAt || existingNote.createdAt || Date.now()
          })
        } else {
          console.log(`[Restore] Creating new note: ${noteTitle} in ${folderPath || 'root'}`)
          if (folderPath && !createdFolders.has(folderPath)) {
            const folderParts = folderPath.split('/')
            let currentPath = ''
            for (const folderName of folderParts) {
              const nextPath = currentPath ? `${currentPath}/${folderName}` : folderName
              if (!createdFolders.has(nextPath)) {
                try {
                  const folderExists = state.notes.some(
                    (n) => n.type === 'folder' && n.path === nextPath
                  )
                  if (!folderExists) {
                    console.log(`[Restore] Creating folder: ${nextPath}`)
                    await window.api.createFolder(folderName, currentPath || undefined)
                  }
                  createdFolders.add(nextPath)
                } catch (err) {
                  console.warn(`[Restore] Folder creation failed or exists: ${nextPath}`, err)
                  createdFolders.add(nextPath)
                }
              }
              currentPath = nextPath
            }
          }

          const created = await window.api.createNote(noteTitle, folderPath)
          await window.api.saveNote({
            id: created.id,
            title: noteTitle,
            content: backupNote.content || '',
            path: folderPath,
            updatedAt: backupNote.updatedAt || Date.now(),
            createdAt: backupNote.createdAt || Date.now()
          })
        }
        successCount++
      } catch (error) {
        failCount++
        console.error(`[Restore] Failed to restore note ${backupNote.id}:`, error)
      }
    }

    console.log(`[Restore] Finished. Success: ${successCount}, Failed: ${failCount}`)
    await this.vaultHandler.refreshNotes()
    this.vaultHandler.components.sidebar.renderTree()

    if (state.activeId) {
      const activeNote = state.notes.find((n) => n.id === state.activeId)
      if (activeNote) {
        const noteData = await window.api.loadNote(activeNote.id)
        if (noteData) void this.vaultHandler.components.editor.loadNote(noteData)
      }
    }

    void this.vaultHandler.backgroundIndexVault()
  }
}
