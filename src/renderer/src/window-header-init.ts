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
      <button class="wh-btn wh-chat" id="window-header-chat" title="Open AI Chat" aria-label="Open AI Chat">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3l3 3 3-3h5a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/>
          <path d="M5 7h6M5 10h4"/>
        </svg>
      </button>
    </div>
    <div class="window-header__controls">
      <button class="wh-btn wh-min" title="Minimize" aria-label="Minimize">–</button>
      <button class="wh-btn wh-max" title="Maximize" aria-label="Maximize">□</button>
      <button class="wh-btn wh-close" title="Close" aria-label="Close">×</button>
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
  const maxBtn = header.querySelector('.wh-max') as HTMLButtonElement | null
  const closeBtn = header.querySelector('.wh-close') as HTMLButtonElement | null

  minBtn?.addEventListener('click', () => {
    void window.api.window.minimize()
  })

  const updateMax = async (): Promise<void> => {
    const isMax = await window.api.window.isMaximized()
    if (maxBtn) {
      maxBtn.textContent = isMax ? '❐' : '□'
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
