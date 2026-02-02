import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { SearchAddon } from '@xterm/addon-search'
import type { SerializeAddon } from '@xterm/addon-serialize'

/**
 * Terminal Session Interface
 * Represents a single terminal instance with all its addons and metadata
 */
export interface TerminalSession {
  id: string
  terminal: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
  isActive: boolean
  shellType?: string
  cwd?: string
  customName?: string
  color?: string
  isSplit?: boolean
  serializeAddon: SerializeAddon
}

/**
 * Shell Configuration
 */
export interface ShellConfig {
  value: string
  label: string
}

/**
 * Terminal Settings
 */
export interface TerminalSettings {
  terminalFontSize?: number
  terminalFontFamily?: string
  terminalBackground?: string
  terminalForeground?: string
  terminalCursor?: string
  terminalFrameColor?: string
  terminalDefaultShell?: string
}

/**
 * Session Configuration (stored in vault config)
 */
export interface SessionConfig {
  name?: string
  color?: string
}

/**
 * Terminal Theme Configuration
 */
export interface TerminalTheme {
  background: string
  foreground: string
  cursor: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

/**
 * Terminal Component Constants
 */
export const TERMINAL_CONSTANTS = {
  MIN_HEIGHT: 100,
  MAX_HEIGHT_OFFSET: 178, // Header + Tabs + Breadcrumbs + Statusbar + Min Editor
  DEFAULT_COLS: 80,
  DEFAULT_ROWS: 24,
  DEFAULT_FONT_SIZE: 14,
  DEFAULT_FONT_FAMILY: 'Consolas, "Courier New", monospace',
  DEFAULT_BACKGROUND: '#1e1e1e',
  DEFAULT_FOREGROUND: '#cccccc',
  DEFAULT_CURSOR: '#ffffff',
  DEFAULT_SESSION_COLOR: '#4ec9b0',
  FIT_DELAY: 50,
  RESTORE_MARKER: '\r\n\x1b[2m--- Restored History ---\x1b[0m\r\n',
  EXIT_MESSAGE: '\r\n\x1b[31m[Process Exited] Click the session icon to restart.\x1b[0m\r\n'
} as const

/**
 * Local Storage Keys
 */
export const STORAGE_KEYS = {
  TERMINAL_SESSIONS: 'terminal_sessions',
  TERMINAL_ACTIVE_SESSION: 'terminal_active_session',
  TERMINAL_PANEL_VISIBLE: 'terminal_panel_visible',
  TERMINAL_BUFFER_PREFIX: 'terminal_buffer_'
} as const
