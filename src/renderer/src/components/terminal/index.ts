/**
 * Terminal Component Module
 *
 * This module provides a comprehensive terminal emulator for Knowledge Hub.
 * It integrates xterm.js for the frontend and communicates with node-pty
 * in the main process via IPC.
 *
 * @module components/terminal
 */

// Main component export
export { RealTerminalComponent } from './real-terminal'

// Type exports
export type {
  TerminalSession,
  ShellConfig,
  TerminalSettings,
  SessionConfig,
  TerminalTheme
} from './terminal.types'

// Service exports
export { TerminalShellService } from './terminal-shell.service'

// Constants
export { TERMINAL_CONSTANTS, STORAGE_KEYS } from './terminal.types'
