import { TabBar } from '../tabbar'
import { state } from '../../../core/state'

describe('TabBar Component', () => {
  let container: HTMLElement
  let tabbar: TabBar

  beforeEach(() => {
    document.body.innerHTML = '<div id="tabs"></div>'
    container = document.getElementById('tabs')!
    state.openTabs = []
    state.activeId = ''
    state.pinnedTabs = new Set()
    tabbar = new TabBar('tabs')
  })

  it('should render nothing when no tabs are open', () => {
    tabbar.render()
    expect(container.style.display).toBe('none')
    expect(container.innerHTML).toBe('')
  })

  it('should render tabs when openTabs is not empty', () => {
    state.openTabs = [
      { id: '1', title: 'Note 1', updatedAt: Date.now() },
      { id: '2', title: 'Note 2', updatedAt: Date.now() }
    ]
    state.activeId = '1'

    tabbar.render()

    expect(container.style.display).toBe('flex')
    const tabs = container.querySelectorAll('.tab')
    expect(tabs.length).toBe(2)
    expect(tabs[0].classList.contains('is-active')).toBe(true)
    expect(tabs[0].textContent).toContain('Note 1')
  })

  it('should call onTabSelect when a tab is clicked', () => {
    state.openTabs = [{ id: '1', title: 'Note 1', updatedAt: Date.now() }]
    tabbar.render()

    const handler = vi.fn()
    tabbar.setTabSelectHandler(handler)

    const tab = container.querySelector('.tab') as HTMLElement
    tab.click()

    expect(handler).toHaveBeenCalledWith('1')
  })

  it('should call onTabClose when close button is clicked', () => {
    state.openTabs = [{ id: '1', title: 'Note 1', updatedAt: Date.now() }]
    tabbar.render()

    const handler = vi.fn()
    tabbar.setTabCloseHandler(handler)

    const closeBtn = container.querySelector('.tab__close') as HTMLElement
    closeBtn.click()

    expect(handler).toHaveBeenCalledWith('1')
  })

  it('should show dirty indicator when state.isDirty and tab is active', () => {
    state.openTabs = [{ id: '1', title: 'Note 1', updatedAt: Date.now() }]
    state.activeId = '1'
    state.isDirty = true

    tabbar.render()

    const tab = container.querySelector('.tab')
    expect(tab?.classList.contains('is-dirty')).toBe(true)
  })

  it('should show pinned icon when tab is pinned', () => {
    state.openTabs = [{ id: '1', title: 'Note 1', updatedAt: Date.now() }]
    state.pinnedTabs = new Set(['1'])

    tabbar.render()

    const tab = container.querySelector('.tab')
    expect(tab?.classList.contains('is-pinned')).toBe(true)
    expect(container.querySelector('.tab__pin-icon')).not.toBeNull()
  })
})
