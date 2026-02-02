import * as pty from 'node-pty'

/**
 * Terminal Session Interface (Main Process)
 */
export interface TerminalSession {
  id: string
  ptyProcess: pty.IPty
  cwd: string
  disposables: pty.IDisposable[]
}

/**
 * Shell Path Configuration
 */
export interface ShellPathConfig {
  exe: string
  args: string[]
}

/**
 * Terminal Manager Configuration
 */
export interface TerminalManagerConfig {
  defaultShell?: string
  defaultCwd?: string
}
