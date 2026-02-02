import { TerminalManager } from './terminal-manager'
import { TerminalHandlers } from './terminal-handlers'

// Singleton instances
const terminalManager = new TerminalManager()
const terminalHandlers = new TerminalHandlers(terminalManager)

/**
 * Register terminal IPC handlers
 * Call this once during app initialization
 */
export function registerTerminalHandlers(): void {
  terminalHandlers.register()
}

/**
 * Cleanup all terminal sessions
 * Call this during app shutdown
 */
export function cleanupTerminals(): void {
  terminalManager.cleanup()
}

/**
 * Export terminal manager instance for advanced usage
 */
export { terminalManager }

/**
 * Export types
 */
export type { TerminalSession, ShellPathConfig } from './terminal.types'
