// Initialize window header for frameless window
const container = document.getElementById('app') as HTMLElement
if (container) {
  const header = document.createElement('div')
  header.className = 'window-header'
  header.style.position = 'fixed'
  header.style.top = '0'
  header.style.left = '0'
  header.style.right = '0'
  header.innerHTML = `
    <div class="window-header__brand">
      <span class="window-header__title">Knowledge Hub</span>
    </div>
    <div class="window-header__actions">
      <div class="window-header__ai-status" id="ai-status-indicator" style="display: none;">
        <div class="ai-status-icon">
          <svg class="ai-status-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <svg class="ai-status-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <div class="ai-status-tooltip">Initializing AI...</div>
      </div>
      <div class="window-header__separator">|</div>
      <button class="wh-btn wh-chat" id="window-header-chat" title="Open AI Chat" aria-label="Open AI Chat">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    </div>
    <div class="window-header__controls">
      <button class="wh-btn wh-min" title="Minimize" aria-label="Minimize">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <button class="wh-btn wh-max" id="wh-max-btn" title="Maximize" aria-label="Maximize">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        </svg>
      </button>
      <button class="wh-btn wh-close" title="Close" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `

  // Add chat button click handler
  const chatBtn = header.querySelector('#window-header-chat') as HTMLButtonElement
  chatBtn?.addEventListener('click', async () => {
    const shell = document.querySelector('.vscode-shell') as HTMLElement
    const rightPanel = document.getElementById('rightPanel') as HTMLElement
    if (!rightPanel || !shell) return

    const isVisible = rightPanel.style.display !== 'none'
    if (isVisible) {
      const chatInput = rightPanel.querySelector('#rightbar-chat-input') as HTMLTextAreaElement
      chatInput?.focus()
    } else {
      const s = await window.api.getSettings()
      const w = (s as { rightPanelWidth?: number }).rightPanelWidth ?? 270
      rightPanel.style.display = 'block'
      shell.style.setProperty('--right-panel-width', `${Math.max(200, Math.min(800, w))}px`)
      // Save visibility state when opening
      void window.api.updateSettings({ rightPanelVisible: true })
      setTimeout(() => {
        const chatInput = rightPanel.querySelector('#rightbar-chat-input') as HTMLTextAreaElement
        chatInput?.focus()
      }, 100)
    }
  })
  container.insertAdjacentElement('afterbegin', header)

  const minBtn = header.querySelector('.wh-min') as HTMLButtonElement | null
  const maxBtn = header.querySelector('#wh-max-btn') as HTMLButtonElement | null
  const closeBtn = header.querySelector('.wh-close') as HTMLButtonElement | null

  minBtn?.addEventListener('click', () => {
    void window.api.window.minimize()
  })

  const updateMax = async (): Promise<void> => {
    const isMax = await window.api.window.isMaximized()
    if (maxBtn) {
      if (isMax) {
        maxBtn.innerHTML = `
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 10h-3a2 2 0 0 1-2-2v-3m0-10h3a2 2 0 0 1 2 2v3M3 18h3a2 2 0 0 1 2 2v3"></path>
          </svg>
        `
      } else {
        maxBtn.innerHTML = `
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
        `
      }
      maxBtn.setAttribute('title', isMax ? 'Restore' : 'Maximize')
      maxBtn.setAttribute('aria-label', isMax ? 'Restore' : 'Maximize')
    }
  }

  maxBtn?.addEventListener('click', async () => {
    const isMax = await window.api.window.isMaximized()
    if (isMax) await window.api.window.unmaximize()
    else await window.api.window.maximize()
    await updateMax()
  })

  closeBtn?.addEventListener('click', () => {
    void window.api.window.close()
  })
  void updateMax()
}
