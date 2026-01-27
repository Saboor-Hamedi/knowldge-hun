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
  '--glass-bg': string
  '--glass-border': string
  '--shadow-subtle': string
  '--shadow-strong': string
}

export type Theme = {
  id: string
  name: string
  colors: ThemeColors
}

export const themes: Record<string, Theme> = {
  dark: {
    id: 'dark',
    name: 'Hub Dark (Default)',
    colors: {
      '--bg': '#0a0b10',
      '--bg-accent': '#0f1117',
      '--panel': '#12141c',
      '--panel-strong': '#1a1d27',
      '--border': '#232735',
      '--border-subtle': 'rgba(255, 255, 255, 0.04)',
      '--muted': '#626a84',
      '--text': '#e2e4e9',
      '--text-strong': '#ffffff',
      '--text-soft': '#9b9fb1',
      '--text-muted': '#626a84',
      '--primary': '#6366f1',
      '--primary-strong': '#818cf8',
      '--danger': '#f43f5e',
      '--status': '#4f46e5',
      '--hover': 'rgba(56, 139, 253, 0.1)',
      '--selection': 'rgba(56, 139, 253, 0.25)',
      '--glass-bg': 'rgba(18, 20, 28, 0.7)',
      '--glass-border': 'rgba(255, 255, 255, 0.08)',
      '--shadow-subtle': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      '--shadow-strong': '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)'
    }
  },
  light: {
    id: 'light',
    name: 'Hub Light',
    colors: {
      '--bg': '#f8fafc',
      '--bg-accent': '#f1f5f9',
      '--panel': '#ffffff',
      '--panel-strong': '#fdfdfd',
      '--border': '#e2e8f0',
      '--border-subtle': 'rgba(0, 0, 0, 0.03)',
      '--muted': '#94a3b8',
      '--text': '#334155',
      '--text-strong': '#0f172a',
      '--text-soft': '#64748b',
      '--text-muted': '#94a3b8',
      '--primary': '#4f46e5',
      '--primary-strong': '#4338ca',
      '--danger': '#e11d48',
      '--status': '#4f46e5',
      '--hover': 'rgba(56, 139, 253, 0.08)',
      '--selection': 'rgba(56, 139, 253, 0.15)',
      '--glass-bg': 'rgba(255, 255, 255, 0.7)',
      '--glass-border': 'rgba(0, 0, 0, 0.08)',
      '--shadow-subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      '--shadow-strong': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
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
      '--hover': '#b1bac41f',
      '--selection': '#388bfd26',
      '--glass-bg': 'rgba(13, 17, 23, 0.8)',
      '--glass-border': 'rgba(48, 54, 61, 0.5)',
      '--shadow-subtle': '0 1px 3px rgba(0,0,0,0.12)',
      '--shadow-strong': '0 4px 12px rgba(0,0,0,0.25)'
    }
  },
  midnight: {
    id: 'midnight',
    name: 'OLED Midnight',
    colors: {
      '--bg': '#000000',
      '--bg-accent': '#050505',
      '--panel': '#000000',
      '--panel-strong': '#080808',
      '--border': '#1a1a1a',
      '--border-subtle': 'rgba(255, 255, 255, 0.03)',
      '--muted': '#555555',
      '--text': '#e0e0e0',
      '--text-strong': '#ffffff',
      '--text-soft': '#aaaaaa',
      '--text-muted': '#555555',
      '--primary': '#a78bfa',
      '--primary-strong': '#c4b5fd',
      '--danger': '#f87171',
      '--status': '#6d28d9',
      '--hover': 'rgba(56, 139, 253, 0.1)',
      '--selection': '#388bfd26',
      '--glass-bg': 'rgba(0, 0, 0, 0.8)',
      '--glass-border': 'rgba(255, 255, 255, 0.06)',
      '--shadow-subtle': '0 0 0 1px rgba(255, 255, 255, 0.05)',
      '--shadow-strong': '0 0 40px rgba(167, 139, 250, 0.05)'
    }
  },
  oceanic: {
    id: 'oceanic',
    name: 'Oceanic Pro',
    colors: {
      '--bg': '#0f172a',
      '--bg-accent': '#1e293b',
      '--panel': '#0f172a',
      '--panel-strong': '#1e293b',
      '--border': '#334155',
      '--border-subtle': 'rgba(56, 189, 248, 0.1)',
      '--muted': '#64748b',
      '--text': '#e2e8f0',
      '--text-strong': '#f8fafc',
      '--text-soft': '#94a3b8',
      '--text-muted': '#64748b',
      '--primary': '#0ea5e9',
      '--primary-strong': '#38bdf8',
      '--danger': '#ef4444',
      '--status': '#0284c7',
      '--hover': 'rgba(56, 139, 253, 0.1)',
      '--selection': '#388bfd26',
      '--glass-bg': 'rgba(15, 23, 42, 0.8)',
      '--glass-border': 'rgba(56, 189, 248, 0.1)',
      '--shadow-subtle': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      '--shadow-strong': '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
    }
  },
  synthwave: {
    id: 'synthwave',
    name: 'Cyberpunk 84',
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
      '--primary-strong': '#f97e72',
      '--danger': '#fe4450',
      '--status': '#72f1b8',
      '--hover': 'rgba(56, 139, 253, 0.15)',
      '--selection': '#388bfd40',
      '--glass-bg': 'rgba(43, 33, 58, 0.8)',
      '--glass-border': 'rgba(255, 126, 219, 0.2)',
      '--shadow-subtle': '0 0 10px rgba(255, 126, 219, 0.1)',
      '--shadow-strong': '0 0 30px rgba(255, 126, 219, 0.2)'
    }
  },
  nord: {
    id: 'nord',
    name: 'Nordic Frost',
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
      '--hover': 'rgba(56, 139, 253, 0.15)',
      '--selection': '#388bfd40',
      '--glass-bg': 'rgba(46, 52, 64, 0.8)',
      '--glass-border': 'rgba(136, 192, 208, 0.1)',
      '--shadow-subtle': '0 1px 3px rgba(0,0,0,0.1)',
      '--shadow-strong': '0 4px 12px rgba(0,0,0,0.2)'
    }
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula Plus',
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
      '--hover': 'rgba(56, 139, 253, 0.15)',
      '--selection': '#388bfd40',
      '--glass-bg': 'rgba(40, 42, 54, 0.8)',
      '--glass-border': 'rgba(189, 147, 249, 0.1)',
      '--shadow-subtle': '0 2px 4px rgba(0,0,0,0.1)',
      '--shadow-strong': '0 8px 16px rgba(0,0,0,0.2)'
    }
  }
}
