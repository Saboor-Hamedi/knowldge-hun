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
    <div class="window-header__controls">
      <button class="wh-btn wh-min" title="Minimize" aria-label="Minimize">–</button>
      <button class="wh-btn wh-max" title="Maximize" aria-label="Maximize">□</button>
      <button class="wh-btn wh-close" title="Close" aria-label="Close">×</button>
    </div>
  `
  container.insertAdjacentElement('afterbegin', header)

  const minBtn = header.querySelector('.wh-min') as HTMLButtonElement | null
  const maxBtn = header.querySelector('.wh-max') as HTMLButtonElement | null
  const closeBtn = header.querySelector('.wh-close') as HTMLButtonElement | null

  minBtn?.addEventListener('click', () => { void window.api.window.minimize() })

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

  closeBtn?.addEventListener('click', () => { void window.api.window.close() })
  void updateMax()
}
