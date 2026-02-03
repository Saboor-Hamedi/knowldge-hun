import { vi } from 'vitest'

// Mock Electron window.api
Object.defineProperty(window, 'api', {
  writable: true,
  value: {
    saveNote: vi.fn(),
    readNote: vi.fn(),
    listNotes: vi.fn(),
    deleteNote: vi.fn(),
    renameNote: vi.fn(),
    onNoteCreated: vi.fn(),
    onNoteDeleted: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({}),
    saveSettings: vi.fn(),
    updateSettings: vi.fn().mockResolvedValue({}),
    onSettingsChanged: vi.fn(),
    openExternal: vi.fn(),
    saveAsset: vi.fn().mockResolvedValue('assets/test.png'),
    getUsername: vi.fn().mockResolvedValue('test-user')
  }
})

// Mock CSS imports for Vitest
vi.mock('monaco-editor/min/vs/editor/editor.main.css', () => ({}))
vi.mock('./editor.css', () => ({}))
vi.mock('../wikilink/wikilink.css', () => ({}))
vi.mock('./slash-menu.css', () => ({}))
vi.mock('./selection-toolbar.css', () => ({}))
vi.mock('../tabbar/tabbar.css', () => ({}))
vi.mock('../activitybar/activitybar.css', () => ({}))
vi.mock('../sidebar/sidebar.css', () => ({}))
vi.mock('../statusbar/statusbar.css', () => ({}))
vi.mock('../tooltip/tooltip.css', () => ({}))

// Mock Monaco Editor
vi.mock('monaco-editor', () => {
  return {
    editor: {
      create: vi.fn().mockReturnValue({
        dispose: vi.fn(),
        getValue: vi.fn().mockReturnValue(''),
        setValue: vi.fn(),
        onDidChangeModelContent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidChangeCursorPosition: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidChangeCursorSelection: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onMouseDown: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        layout: vi.fn(),
        focus: vi.fn(),
        getModel: vi.fn().mockReturnValue({
          getValue: vi.fn().mockReturnValue(''),
          getLineContent: vi.fn().mockReturnValue(''),
          getPositionAt: vi.fn().mockReturnValue({ lineNumber: 1, column: 1 }),
          findMatches: vi.fn().mockReturnValue([]),
          getValueInRange: vi.fn().mockReturnValue('')
        }),
        updateOptions: vi.fn(),
        deltaDecorations: vi.fn().mockReturnValue([]),
        revealPositionInCenterIfOutsideViewport: vi.fn(),
        revealLineInCenterIfOutsideViewport: vi.fn(),
        setSelection: vi.fn(),
        getPosition: vi.fn().mockReturnValue({ lineNumber: 1, column: 1 }),
        getSelection: vi.fn(),
        executeEdits: vi.fn(),
        trigger: vi.fn()
      }),
      setModelLanguage: vi.fn()
    },
    Range: vi.fn(),
    Selection: vi.fn()
  }
})

// Mock Lucide icons
vi.mock('lucide', async () => {
  const actual = await vi.importActual('lucide')
  return {
    ...actual,
    createElement: vi.fn().mockReturnValue({ outerHTML: '<span>icon</span>' })
  }
})
// Mock CSS imports for components that might be missing
vi.mock('../sidebar/sidebar-tree.css', () => ({}))
vi.mock('../sidebar/sidebar-new.css', () => ({}))
vi.mock('../updateApp/activitybar.css', () => ({}))
vi.mock('../services/security/security.css', () => ({}))

// Mock GitService
vi.mock('../src/renderer/src/services/git/gitService', () => ({
  gitService: {
    getStatus: vi.fn().mockReturnValue('none'),
    refreshStatus: vi.fn().mockResolvedValue(undefined),
    getMetadata: vi.fn().mockReturnValue({ branch: 'main' }),
    getSummary: vi.fn().mockReturnValue({ modified: 0, added: 0, deleted: 0 })
  }
}))

// Mock scrollIntoView as it's not implemented in JSDOM
if (typeof window.HTMLElement.prototype.scrollIntoView !== 'function') {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
}
