export interface Shortcut {
  title: string
  desc: string
  keys: string[]
  search: string
  highlight?: boolean
}

import { Keyboard, createElement } from 'lucide'

function createLucideIcon(IconComponent: any, size: number = 18): string {
  const svgElement = createElement(IconComponent, {
    size: size,
    'stroke-width': 1.5,
    stroke: 'currentColor',
    color: 'currentColor'
  })
  return svgElement?.outerHTML || ''
}

export const shortcuts: Shortcut[] = [
  {
    title: 'Knowledge Graph',
    desc: 'Open knowledge graph visualization',
    keys: ['Alt', 'G'],
    search: 'graph visual map alt+g'
  },
  {
    title: 'Hub Console',
    desc: 'Toggle Intelligence Terminal',
    keys: ['Ctrl', 'J'],
    search: 'console terminal intelligence ctrl+j',
    highlight: true
  },
  {
    title: 'Find in Note',
    desc: 'Search text within the active note',
    keys: ['Ctrl', 'F'],
    search: 'find search ctrl+f'
  },
  {
    title: 'Quick Open',
    desc: 'Find and open notes quickly',
    keys: ['Ctrl', 'P'],
    search: 'open search files ctrl+p'
  },
  {
    title: 'Global Search',
    desc: 'Search across all notes',
    keys: ['Ctrl', 'Shift', 'F'],
    search: 'global search all files ctrl+shift+f'
  },
  {
    title: 'Command Palette',
    desc: 'Access all app commands',
    keys: ['Ctrl', 'Shift', 'P'],
    search: 'palette commands ctrl+shift+p'
  },
  {
    title: 'Create Note',
    desc: 'Create a new markdown note',
    keys: ['Ctrl', 'N'],
    search: 'new create note ctrl+n'
  },
  {
    title: 'Save Note',
    desc: 'Manually save current changes',
    keys: ['Ctrl', 'S'],
    search: 'save note ctrl+s'
  },
  {
    title: 'Toggle Preview',
    desc: 'Switch between editor and preview',
    keys: ['Ctrl', '\\'],
    search: 'preview toggle ctrl+\\'
  },
  {
    title: 'Rename Note',
    desc: 'Rename the active note',
    keys: ['Ctrl', 'R'],
    search: 'rename note ctrl+r'
  },
  {
    title: 'Toggle Sidebar',
    desc: 'Show or hide the file explorer',
    keys: ['Ctrl', 'B'],
    search: 'sidebar toggle explorer ctrl+b'
  },
  {
    title: 'Right Sidebar',
    desc: 'Toggle AI chat and info panel',
    keys: ['Ctrl', 'I'],
    search: 'ai chat right info ctrl+i'
  },
  {
    title: 'Delete Note',
    desc: 'Move active note to trash',
    keys: ['Ctrl', 'D'],
    search: 'delete trash remove ctrl+d'
  },
  {
    title: 'Open Settings',
    desc: 'Access application preferences',
    keys: ['Ctrl', ','],
    search: 'settings preferences toggle ctrl+,'
  },
  {
    title: 'Select Theme',
    desc: 'Quickly change application theme',
    keys: ['Ctrl', 'Shift', ','],
    search: 'theme select change ctrl+shift+,'
  },
  {
    title: 'Reload Window',
    desc: 'Refresh the application window',
    keys: ['Ctrl', 'Alt', 'R'],
    search: 'reload refresh window reset'
  },
  {
    title: 'Reload Vault',
    desc: 'Force refresh all vault files',
    keys: ['Ctrl', 'Shift', 'R'],
    search: 'reload refresh vault ctrl+shift+r'
  },
  {
    title: 'Choose Vault',
    desc: 'Open a different vault folder',
    keys: ['Ctrl', 'Shift', 'V'],
    search: 'vault choose select ctrl+shift+v'
  },
  {
    title: 'Close UI',
    desc: 'Close modals, finder, or preview',
    keys: ['Esc'],
    search: 'close escape esc'
  }
]

export function renderShortcutItems(): string {
  const icon = createLucideIcon(Keyboard)
  return shortcuts
    .map(
      (s) => `
    <div class="shortcut-item ${s.highlight ? 'is-highlighted' : ''}" data-search="${s.search}">
      <div class="settings-row__icon">${icon}</div>
      <div class="shortcut-info">
        <div class="shortcut-title">${s.title}</div>
        <div class="shortcut-description">${s.desc}</div>
      </div>
      <div class="shortcut-keys">
        ${s.keys.map((k) => `<span class="shortcut-key">${k}</span>`).join('')}
      </div>
    </div>
  `
    )
    .join('')
}
