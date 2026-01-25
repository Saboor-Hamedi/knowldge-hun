export type ThemeColors = {
  '--bg': string
  '--bg-accent': string
  '--panel': string
  '--panel-strong': string
  '--border': string
  '--border-subtle': string
  '--muted': string
  '--text': string
  '--text-strong': string
  '--text-soft': string
  '--text-muted': string
  '--primary': string
  '--primary-strong': string
  '--danger': string
  '--status': string
  '--hover': string
  '--selection': string
}

export type Theme = {
  id: string
  name: string
  colors: ThemeColors
}

export const themes: Record<string, Theme> = {
  dark: {
    id: 'dark',
    name: 'Dark (Default)',
    colors: {
      '--bg': '#0f111a',
      '--bg-accent': '#11141f',
      '--panel': '#1e1e1e',
      '--panel-strong': '#252526',
      '--border': '#2a2d37',
      '--border-subtle': 'rgba(255, 255, 255, 0.05)',
      '--muted': '#9da5b4',
      '--text': '#e8eaed',
      '--text-strong': '#ffffff',
      '--text-soft': '#c5c9d6',
      '--text-muted': '#9da5b4',
      '--primary': '#569cd6',
      '--primary-strong': '#4fc1ff',
      '--danger': '#f48771',
      '--status': '#0e639c',
      '--hover': 'rgba(127, 167, 255, 0.12)',
      '--selection': 'rgba(86, 156, 214, 0.25)'
    }
  },
  light: {
    id: 'light',
    name: 'Light',
    colors: {
      '--bg': '#ffffff',
      '--bg-accent': '#f3f3f3',
      '--panel': '#f3f3f3',
      '--panel-strong': '#e5e5e5',
      '--border': '#e5e5e5',
      '--border-subtle': 'rgba(0, 0, 0, 0.05)',
      '--muted': '#6a737d',
      '--text': '#24292e',
      '--text-strong': '#000000',
      '--text-soft': '#586069',
      '--text-muted': '#6a737d',
      '--primary': '#0366d6',
      '--primary-strong': '#005cc5',
      '--danger': '#d73a49',
      '--status': '#0366d6',
      '--hover': 'rgba(3, 102, 214, 0.08)',
      '--selection': 'rgba(3, 102, 214, 0.15)'
    }
  },
  githubDark: {
    id: 'githubDark',
    name: 'GitHub Dark',
    colors: {
      '--bg': '#0d1117',
      '--bg-accent': '#161b22',
      '--panel': '#0d1117',
      '--panel-strong': '#161b22',
      '--border': '#30363d',
      '--border-subtle': 'rgba(240, 246, 252, 0.1)',
      '--muted': '#8b949e',
      '--text': '#c9d1d9',
      '--text-strong': '#f0f6fc',
      '--text-soft': '#8b949e',
      '--text-muted': '#484f58',
      '--primary': '#58a6ff',
      '--primary-strong': '#79c0ff',
      '--danger': '#f85149',
      '--status': '#1f6feb',
      '--hover': 'rgba(177, 186, 196, 0.12)',
      '--selection': 'rgba(56, 139, 253, 0.15)'
    }
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      '--bg': '#000000',
      '--bg-accent': '#0a0a0a',
      '--panel': '#111111',
      '--panel-strong': '#1a1a1a',
      '--border': '#333333',
      '--border-subtle': 'rgba(255, 255, 255, 0.1)',
      '--muted': '#888888',
      '--text': '#dddddd',
      '--text-strong': '#ffffff',
      '--text-soft': '#bbbbbb',
      '--text-muted': '#888888',
      '--primary': '#bb86fc',
      '--primary-strong': '#d7b7fd',
      '--danger': '#cf6679',
      '--status': '#3700b3',
      '--hover': 'rgba(187, 134, 252, 0.12)',
      '--selection': 'rgba(187, 134, 252, 0.25)'
    }
  },
  oceanic: {
    id: 'oceanic',
    name: 'Oceanic',
    colors: {
      '--bg': '#0f181e',
      '--bg-accent': '#121f26',
      '--panel': '#1a2b34',
      '--panel-strong': '#20343f',
      '--border': '#2a414d',
      '--border-subtle': 'rgba(64, 224, 208, 0.1)',
      '--muted': '#567a8c',
      '--text': '#cfe6ee',
      '--text-strong': '#ffffff',
      '--text-soft': '#b0cdd9',
      '--text-muted': '#567a8c',
      '--primary': '#40e0d0',
      '--primary-strong': '#7fffd4',
      '--danger': '#ff6b6b',
      '--status': '#008b8b',
      '--hover': 'rgba(64, 224, 208, 0.12)',
      '--selection': 'rgba(64, 224, 208, 0.25)'
    }
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    colors: {
      '--bg': '#1e2320',
      '--bg-accent': '#252b27',
      '--panel': '#2a312c',
      '--panel-strong': '#323a35',
      '--border': '#3e4941',
      '--border-subtle': 'rgba(144, 238, 144, 0.1)',
      '--muted': '#7c8a80',
      '--text': '#dbebe2',
      '--text-strong': '#ffffff',
      '--text-soft': '#bcd1c6',
      '--text-muted': '#7c8a80',
      '--primary': '#90ee90',
      '--primary-strong': '#98fb98',
      '--danger': '#ff7f7f',
      '--status': '#2e8b57',
      '--hover': 'rgba(144, 238, 144, 0.12)',
      '--selection': 'rgba(144, 238, 144, 0.25)'
    }
  },
  synthwave: {
    id: 'synthwave',
    name: 'Synthwave',
    colors: {
      '--bg': '#2b213a',
      '--bg-accent': '#261b36',
      '--panel': '#241b2f',
      '--panel-strong': '#34294f',
      '--border': '#493a5c',
      '--border-subtle': 'rgba(255, 0, 144, 0.1)',
      '--muted': '#9681b6',
      '--text': '#fffbf6',
      '--text-strong': '#ffffff',
      '--text-soft': '#d9c2f2',
      '--text-muted': '#9681b6',
      '--primary': '#ff7edb',
      '--primary-strong': '#ff2a6d',
      '--danger': '#fe4450',
      '--status': '#72f1b8',
      '--hover': 'rgba(255, 126, 219, 0.15)',
      '--selection': 'rgba(255, 126, 219, 0.3)'
    }
  },
  nord: {
    id: 'nord',
    name: 'Nord',
    colors: {
      '--bg': '#2e3440',
      '--bg-accent': '#3b4252',
      '--panel': '#3b4252',
      '--panel-strong': '#434c5e',
      '--border': '#4c566a',
      '--border-subtle': 'rgba(216, 222, 233, 0.1)',
      '--muted': '#d8dee9',
      '--text': '#eceff4',
      '--text-strong': '#ffffff',
      '--text-soft': '#e5e9f0',
      '--text-muted': '#d8dee9',
      '--primary': '#88c0d0',
      '--primary-strong': '#8fbcbb',
      '--danger': '#bf616a',
      '--status': '#5e81ac',
      '--hover': 'rgba(136, 192, 208, 0.12)',
      '--selection': 'rgba(136, 192, 208, 0.25)'
    }
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      '--bg': '#282a36',
      '--bg-accent': '#21222c',
      '--panel': '#282a36',
      '--panel-strong': '#343746',
      '--border': '#44475a',
      '--border-subtle': 'rgba(248, 248, 242, 0.1)',
      '--muted': '#6272a4',
      '--text': '#f8f8f2',
      '--text-strong': '#ffffff',
      '--text-soft': '#f8f8f2',
      '--text-muted': '#6272a4',
      '--primary': '#bd93f9',
      '--primary-strong': '#ff79c6',
      '--danger': '#ff5555',
      '--status': '#8be9fd',
      '--hover': 'rgba(189, 147, 249, 0.12)',
      '--selection': 'rgba(189, 147, 249, 0.25)'
    }
  },
  monokai: {
    id: 'monokai',
    name: 'Monokai',
    colors: {
      '--bg': '#272822',
      '--bg-accent': '#1e1f1c',
      '--panel': '#272822',
      '--panel-strong': '#3e3d32',
      '--border': '#49483e',
      '--border-subtle': 'rgba(248, 248, 240, 0.1)',
      '--muted': '#75715e',
      '--text': '#f8f8f2',
      '--text-strong': '#ffffff',
      '--text-soft': '#f8f8f2',
      '--text-muted': '#75715e',
      '--primary': '#66d9ef',
      '--primary-strong': '#a6e22e',
      '--danger': '#f92672',
      '--status': '#fd971f',
      '--hover': 'rgba(102, 217, 239, 0.12)',
      '--selection': 'rgba(102, 217, 239, 0.25)'
    }
  }
}
