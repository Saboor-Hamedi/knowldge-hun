import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'
import { CanvasAddon } from '@xterm/addon-canvas'
import { SerializeAddon } from '@xterm/addon-serialize'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { TerminalSession, TERMINAL_CONSTANTS } from './terminal.types'

export class TerminalSessionManager {
  private sessions: Map<string, TerminalSession> = new Map()
  private activeSessionId: string | null = null
  private secondaryActiveSessionId: string | null = null

  constructor() {}

  getSessions(): Map<string, TerminalSession> {
    return this.sessions
  }

  getSession(id: string): TerminalSession | undefined {
    return this.sessions.get(id)
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId
  }

  setActiveSessionId(id: string | null): void {
    this.activeSessionId = id
  }

  getSecondaryActiveSessionId(): string | null {
    return this.secondaryActiveSessionId
  }

  setSecondaryActiveSessionId(id: string | null): void {
    this.secondaryActiveSessionId = id
  }

  addSession(id: string, session: TerminalSession): void {
    this.sessions.set(id, session)
  }

  removeSession(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.terminal.dispose()
      this.sessions.delete(id)
    }
  }

  clear(): void {
    this.sessions.forEach((s) => s.terminal.dispose())
    this.sessions.clear()
    this.activeSessionId = null
    this.secondaryActiveSessionId = null
  }

  createXtermInstance(settings: any): Terminal {
    return new Terminal({
      cursorBlink: true,
      fontSize: settings?.terminalFontSize || TERMINAL_CONSTANTS.DEFAULT_FONT_SIZE,
      fontFamily: settings?.terminalFontFamily || TERMINAL_CONSTANTS.DEFAULT_FONT_FAMILY,
      theme: {
        background: settings?.terminalBackground || TERMINAL_CONSTANTS.DEFAULT_BACKGROUND,
        foreground: settings?.terminalForeground || TERMINAL_CONSTANTS.DEFAULT_FOREGROUND,
        cursor: settings?.terminalCursor || TERMINAL_CONSTANTS.DEFAULT_CURSOR,
        selectionBackground: 'rgba(255, 255, 255, 0.15)',
        black: '#282c34',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
        brightBlack: '#5c6370',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#d670d6',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff'
      },
      lineHeight: 1.2,
      allowProposedApi: true
    })
  }

  loadAddons(terminal: Terminal): {
    fitAddon: FitAddon
    searchAddon: SearchAddon
    serializeAddon: SerializeAddon
  } {
    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const serializeAddon = new SerializeAddon()

    const webLinksAddon = new WebLinksAddon((_event, url) => {
      if (window.api?.openExternal) {
        window.api.openExternal(url)
      } else {
        window.open(url, '_blank')
      }
    })

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(searchAddon)
    terminal.loadAddon(serializeAddon)
    terminal.loadAddon(webLinksAddon)

    try {
      const webglAddon = new WebglAddon()
      terminal.loadAddon(webglAddon)
    } catch (e) {
      try {
        const canvasAddon = new CanvasAddon()
        terminal.loadAddon(canvasAddon)
      } catch (e2) {
        // Fallback to DOM renderer (default)
      }
    }

    return { fitAddon, searchAddon, serializeAddon }
  }
}
