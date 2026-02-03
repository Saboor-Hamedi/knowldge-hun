import { SidebarTree } from '../sidebar-tree'
import { state } from '../../../core/state'

// Mock dependencies
vi.mock('../../utils/codicons', () => ({
  codicons: {
    refresh: '<svg></svg>',
    chevronDown: '<svg></svg>',
    chevronRight: '<svg></svg>'
  },
  getFolderIcon: vi.fn().mockReturnValue('<svg>folder</svg>')
}))

vi.mock('../../utils/fileIconMappers', () => ({
  default: vi.fn().mockReturnValue('<svg>file</svg>')
}))

vi.mock('../../utils/tree-utils', () => ({
  sortTreeItems: vi.fn((items) => items)
}))

vi.mock('../contextmenu/contextmenu', () => ({
  contextMenu: {
    show: vi.fn()
  }
}))

describe('SidebarTree Component', () => {
  let container: HTMLElement
  let sidebarTree: SidebarTree

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="sidebar"></div>
      <div class="vscode-shell"></div>
    `
    container = document.getElementById('sidebar')!
    state.tree = []
    state.notes = []
    state.activeView = 'notes'
    state.expandedFolders = new Set()
    state.selectedIds = new Set()
    state.vaultPath = '/test/vault'

    sidebarTree = new SidebarTree('sidebar')
  })

  it('should render correctly in explorer mode', () => {
    expect(container.querySelector('.sidebar__header')).not.toBeNull()
    expect(container.querySelector('.sidebar__title-text')?.textContent).toBe('EXPLORER')
    expect(container.querySelector('#searchInput')).not.toBeNull()
  })

  it('should switch to search mode', () => {
    sidebarTree.setMode('search')
    expect(container.querySelector('.sidebar__title-text')?.textContent).toBe('SEARCH')
    expect(container.querySelector('.sidebar__search-container')).not.toBeNull()
  })

  it('should show and hide the sidebar', () => {
    const shell = document.querySelector('.vscode-shell') as HTMLElement

    sidebarTree.hide()
    expect(shell.classList.contains('sidebar-hidden')).toBe(true)

    sidebarTree.show()
    expect(shell.classList.contains('sidebar-hidden')).toBe(false)
  })

  it('should render tree items', () => {
    state.tree = [
      { id: 'note1', title: 'Note 1.md', type: 'note', path: 'note1.md', updatedAt: Date.now() }
    ]
    sidebarTree.renderTree()

    const noteEl = container.querySelector('.tree-item[data-id="note1"]')
    expect(noteEl).not.toBeNull()
    expect(noteEl?.textContent).toContain('Note 1')
  })

  it('should handle note selection', () => {
    const handler = vi.fn()
    sidebarTree.setNoteSelectHandler(handler)

    state.tree = [
      { id: 'note1', title: 'Note 1.md', type: 'note', path: 'note1.md', updatedAt: Date.now() }
    ]
    sidebarTree.renderTree()

    const noteEl = container.querySelector('.tree-item[data-id="note1"]') as HTMLElement
    noteEl.click()

    expect(handler).toHaveBeenCalledWith('note1', 'note1.md', undefined)
    expect(noteEl.classList.contains('is-active')).toBe(true)
  })
})
