import { ActivityBar } from '../activitybar'
import { state } from '../../../core/state'

// Mock updateApp
vi.mock('../updateApp/updateRender', () => ({
  updateApp: {
    onStateChange: () => {},
    checkForUpdate: () => {}
  }
}))

// Mock securityService
vi.mock('../../../services/security/securityService', () => ({
  securityService: {
    promptAndLock: () => {}
  }
}))

describe('ActivityBar Component', () => {
  let container: HTMLElement
  let activityBar: ActivityBar

  beforeEach(() => {
    document.body.innerHTML = '<div id="activitybar"></div>'
    container = document.getElementById('activitybar')!
    state.activeView = 'notes'
    activityBar = new ActivityBar('activitybar')
  })

  it('should render correctly with default active view', () => {
    const activeBtn = container.querySelector('.activitybar__item.is-active') as HTMLElement
    expect(activeBtn).not.toBeNull()
    expect(activeBtn.dataset.view).toBe('notes')
  })

  it('should change active view when clicking on an item', () => {
    const searchBtn = container.querySelector('[data-view="search"]') as HTMLElement
    searchBtn.click()

    expect(state.activeView).toBe('search')
    expect(searchBtn.classList.contains('is-active')).toBe(true)
  })

  it('should toggle off active view if clicked again (except notes)', () => {
    // First click to set to search
    const searchBtn = container.querySelector('[data-view="search"]') as HTMLElement
    searchBtn.click()
    expect(state.activeView).toBe('search')

    // Click again to toggle off
    searchBtn.click()

    expect(state.activeView).toBe('notes')
    expect(searchBtn.classList.contains('is-active')).toBe(false)
  })
})
