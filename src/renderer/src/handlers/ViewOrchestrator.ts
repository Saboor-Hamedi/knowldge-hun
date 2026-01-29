import { state } from '../core/state'
import { tabService } from '../services/tabService'
import { estimateReadTime, extractWikiLinks, extractTags, timeAgo } from '../utils/helpers'
import { detailsModal } from '../components/details-modal/details-modal'
import type { AppSettings } from '../core/types'

export class ViewOrchestrator {
  constructor(
    private components: {
      editor: {
        layout: () => void
        getValue: () => string
        showEmpty: () => void
        isPreviewMode: boolean
        [key: string]: any
      }
      settingsView: { update: () => void; updateVaultPath: () => void }
      welcomePage: { isVisible: () => boolean; show: () => void; hide: () => void }
      tabBar: { render: () => void }
      statusBar: { setStatus: (msg: string) => void }
      activityBar: { setActiveView: (view: 'notes' | 'search' | 'settings') => void }
      breadcrumbs: { render: () => void }
    }
  ) {}

  public updateViewVisibility(): void {
    const editorCont = document.getElementById('editorContainer')
    const settingsHost = document.getElementById('settingsHost')
    const welcomeHost = document.getElementById('welcomeHost')

    const isWelcomeVisible = this.components.welcomePage.isVisible()

    if (state.activeId === 'settings') {
      if (editorCont) editorCont.style.display = 'none'
      if (settingsHost) settingsHost.style.display = 'flex'
      if (welcomeHost) welcomeHost.style.display = 'none'
    } else if (isWelcomeVisible) {
      if (editorCont) editorCont.style.display = 'none'
      if (settingsHost) settingsHost.style.display = 'none'
      if (welcomeHost) welcomeHost.style.display = 'block'
    } else {
      if (editorCont) editorCont.style.display = 'flex'
      if (settingsHost) settingsHost.style.display = 'none'
      if (welcomeHost) welcomeHost.style.display = 'none'
      this.components.editor.layout()
    }

    // Refresh breadcrumbs whenever visibility state changes
    this.components.breadcrumbs.render()
  }

  public async toggleRightSidebar(): Promise<void> {
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    const rightPanel = document.getElementById('rightPanel') as HTMLElement
    if (!rightPanel || !shell) return

    const isVisible = rightPanel.style.display !== 'none'
    if (isVisible) {
      const currentWidth = parseInt(
        getComputedStyle(shell).getPropertyValue('--right-panel-width') || '270',
        10
      )
      if (currentWidth > 0) {
        void window.api.updateSettings({ rightPanelWidth: currentWidth, rightPanelVisible: false })
      } else {
        void window.api.updateSettings({ rightPanelVisible: false })
      }
      rightPanel.style.display = 'none'
      shell.style.setProperty('--right-panel-width', '0px')
    } else {
      const s = await window.api.getSettings()
      const w = (s as { rightPanelWidth?: number }).rightPanelWidth ?? 270
      rightPanel.style.display = 'block'
      shell.style.setProperty('--right-panel-width', `${Math.max(200, Math.min(800, w))}px`)
      void window.api.updateSettings({ rightPanelVisible: true })
    }
  }

  public showDetailsModal(): void {
    const content = this.components.editor.getValue()
    const words = content.trim()
      ? content
          .trim()
          .split(/\s+/)
          .filter((w: string) => w).length
      : 0
    const chars = content.length
    const lines = content.split('\n').length
    const readTime = estimateReadTime(content)
    const wikiLinks = extractWikiLinks(content).length
    const tags = extractTags(content).length
    const currentNoteId = state.activeId

    if (currentNoteId && currentNoteId !== 'settings') {
      const note = state.notes.find((n) => n.id === currentNoteId)
      if (note) {
        const created = note.createdAt && note.createdAt > 0 ? timeAgo(note.createdAt) : '-'
        const modified = timeAgo(note.updatedAt)
        detailsModal.show({
          words,
          chars,
          lines,
          readTime: `${readTime} min`,
          wikiLinks,
          tags,
          created,
          modified
        })
      }
    } else {
      detailsModal.show({
        words: 0,
        chars: 0,
        lines: 0,
        readTime: '-',
        wikiLinks: 0,
        tags: 0,
        created: '-',
        modified: '-'
      })
    }
  }

  public async openSettings(): Promise<void> {
    this.components.welcomePage.hide()
    state.activeId = 'settings'

    tabService.ensureTab({
      id: 'settings',
      title: 'Settings',
      updatedAt: 0,
      path: undefined,
      type: undefined
    })

    this.components.tabBar.render()
    this.updateViewVisibility()
    this.components.settingsView.update()
    this.components.statusBar.setStatus('Settings Editor')
  }

  public showWelcomePage(): void {
    state.activeId = ''
    this.components.welcomePage.show()
    this.components.editor.showEmpty()
    this.updateViewVisibility()
  }

  public hideWelcomePage(): void {
    this.components.welcomePage.hide()
    this.updateViewVisibility()
  }

  public restoreLayout(settings: AppSettings): void {
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    const rightPanel = document.getElementById('rightPanel') as HTMLElement
    if (!shell || !rightPanel) return

    if (settings.sidebarVisible === false) {
      shell.classList.add('sidebar-hidden')
    } else {
      shell.classList.remove('sidebar-hidden')
    }

    if (settings.rightPanelVisible) {
      rightPanel.style.display = 'block'
      const width = settings.rightPanelWidth ?? 270
      shell.style.setProperty('--right-panel-width', `${width}px`)
    } else {
      rightPanel.style.display = 'none'
      shell.style.setProperty('--right-panel-width', '0px')
    }
  }
}
