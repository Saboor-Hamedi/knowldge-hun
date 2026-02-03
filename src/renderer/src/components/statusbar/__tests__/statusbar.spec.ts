import { StatusBar } from '../statusbar'
import { state } from '../../../core/state'

// Mock dependencies
vi.mock('../../utils/versionFetcher', () => ({
  VersionFetcher: {
    fetchVersion: vi.fn().mockResolvedValue('0.1.5')
  }
}))

vi.mock('../common/tooltip', () => ({
  RichTooltip: vi.fn().mockImplementation(() => ({
    setCompact: vi.fn(),
    show: vi.fn(),
    hide: vi.fn()
  }))
}))

vi.mock('../contextmenu/contextmenu', () => ({
  ContextMenu: vi.fn().mockImplementation(() => ({
    show: vi.fn()
  }))
}))

vi.mock('../notification/notification', () => ({
  notificationManager: {
    show: vi.fn()
  }
}))

describe('StatusBar Component', () => {
  let container: HTMLElement
  let statusBar: StatusBar

  beforeEach(async () => {
    document.body.innerHTML = '<div id="statusbar"></div>'
    container = document.getElementById('statusbar')!
    state.settings = {
      statusbar: {
        words: true,
        chars: true,
        lines: true,
        tags: true,
        links: true,
        cursor: true,
        sync: true,
        version: true,
        git: true
      }
    } as any
    statusBar = new StatusBar('statusbar')

    // Wait for version fetcher
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('should render correctly', () => {
    expect(container.querySelector('.statusbar__left')).not.toBeNull()
    expect(container.querySelector('.statusbar__right')).not.toBeNull()
    expect(container.querySelector('.statusbar__version')).not.toBeNull()
  })

  it('should update version text', async () => {
    // Wait for version fetcher promise
    await vi.waitFor(() => {
      const versionEl = container.querySelector('.statusbar__version')
      return versionEl?.textContent === 'v0.1.5'
    })
  })

  it('should update metrics', () => {
    statusBar.setMetrics({
      words: 10,
      chars: 50,
      lines: 5,
      wikiLinks: 2,
      tags: 3,
      mentions: 1
    })

    expect(container.querySelector('.statusbar__words')?.textContent).toBe('10 Words')
    expect(container.querySelector('.statusbar__chars')?.textContent).toBe('50 Chars')
  })

  it('should update cursor position', () => {
    statusBar.setCursor({ ln: 10, col: 5 })
    expect(container.querySelector('.statusbar__cursor')?.textContent).toBe('Ln 10, Col 5')
  })
})
