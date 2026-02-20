import { agentExecutor } from './executor'
import type { EditorContext } from '../aiService'

/**
 * AgentService
 *
 * The main entry point for AI-driven operations.
 * Handles parsing of [RUN: ...] commands and coordinates execution.
 */
export class AgentService {
  private editorContext?: EditorContext
  private onConfirm?: (command: string) => Promise<boolean>

  setEditorContext(context: EditorContext): void {
    this.editorContext = context
  }

  setConfirmHandler(handler: (command: string) => Promise<boolean>): void {
    this.onConfirm = handler
  }

  private getActiveEditorContent(): string {
    if (!this.editorContext) return 'Error: Editor context not available'
    const content = this.editorContext.getEditorContent()
    if (content === null) return 'No note currently open in editor'
    return content
  }
  /**
   * Parse and execute multiple commands from AI text
   */
  async processResponse(
    text: string,
    onProgress?: () => void,
    signal?: AbortSignal
  ): Promise<string[]> {
    const results: string[] = []
    const executedCommands = new Set<string>()

    // Use a more robust manual scan to find [RUN: ...] blocks.
    // This allows brackets like [1, 2] to exist inside the command arguments (e.g. in code content)
    // without prematurely terminating the match.
    let searchIdx = 0
    const commandBlocks: string[] = []

    // First pass: collect all commands
    while (true) {
      const startTag = '[RUN:'
      const startIdx = text.indexOf(startTag, searchIdx)
      if (startIdx === -1) break

      let endIdx = -1
      let inQuotes = false
      let quoteChar = ''
      let escaped = false

      for (let i = startIdx + startTag.length; i < text.length; i++) {
        const char = text[i]
        if (escaped) {
          escaped = false
          continue
        }
        if (char === '\\') {
          escaped = true
          continue
        }
        const isQuote = char === '"' || char === "'" || char === '`'
        if (isQuote && (!inQuotes || char === quoteChar)) {
          if (!inQuotes) {
            inQuotes = true
            quoteChar = char
          } else {
            inQuotes = false
            quoteChar = ''
          }
        }
        if (char === ']' && !inQuotes) {
          endIdx = i
          break
        }
      }

      if (endIdx === -1) break
      searchIdx = endIdx + 1
      commandBlocks.push(text.substring(startIdx + startTag.length, endIdx).trim())
    }

    if (commandBlocks.length === 0) return []

    // TRANSACTION MODE: If multiple commands, use transaction
    const useTransaction = commandBlocks.length > 1
    if (useTransaction) {
      agentExecutor.startTransaction()
    }

    for (const fullCmd of commandBlocks) {
      if (signal?.aborted) break
      if (executedCommands.has(fullCmd)) continue
      executedCommands.add(fullCmd)

      try {
        const result = await this.executeCommand(fullCmd)
        const feedback = typeof result === 'string' ? result : 'Status: OK'
        results.push(`> [DONE: ${fullCmd}]\n${feedback}`)
        if (onProgress) onProgress()
      } catch (err) {
        console.error(`[AgentService] Execution failed: ${fullCmd}`, err)
        results.push(`> [DONE: ${fullCmd}]\nError: ${(err as Error).message}`)
        if (onProgress) onProgress()
        break
      }
    }

    if (useTransaction && !signal?.aborted) {
      try {
        const txResults = await agentExecutor.commitTransaction()
        results.push(
          `> [TX: COMMIT]\nAtomic commit successful. ${txResults.length} operations applied.`
        )
      } catch (err) {
        results.push(`> [TX: ROLLBACK]\nAtomic commit failed: ${(err as Error).message}`)
      }
    }

    return results
  }

  /**
   * Internal command router
   */
  private async executeCommand(cmdString: string): Promise<unknown> {
    const parts: string[] = []
    let currentPart = ''
    let inQuotes = false
    let quoteChar = ''

    for (let i = 0; i < cmdString.length; i++) {
      const char = cmdString[i]

      if (char === '\\' && i + 1 < cmdString.length) {
        const nextChar = cmdString[i + 1]
        // Unescape quotes, backslashes and backticks
        if (nextChar === '"' || nextChar === "'" || nextChar === '`' || nextChar === '\\') {
          currentPart += nextChar
          i++ // skip next char
          continue
        }
        // Unescape newlines, tabs, and carriage returns
        if (nextChar === 'n') {
          currentPart += '\n'
          i++
          continue
        }
        if (nextChar === 't') {
          currentPart += '\t'
          i++
          continue
        }
        if (nextChar === 'r') {
          currentPart += '\r'
          i++
          continue
        }
      }

      const isQuote = char === '"' || char === "'" || char === '`'
      if (isQuote && (!inQuotes || char === quoteChar)) {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = char
        } else {
          inQuotes = false
          quoteChar = ''
          // Finished a quoted block
          parts.push(currentPart)
          currentPart = ''
        }
      } else if (char === ' ' && !inQuotes) {
        if (currentPart) {
          parts.push(currentPart)
          currentPart = ''
        }
      } else {
        currentPart += char
      }
    }
    if (currentPart) parts.push(currentPart)

    if (parts.length === 0) return null

    const action = parts[0].toLowerCase()
    const args = parts.slice(1)

    // Unified Confirmation Logic:
    // If we're editing the ACTIVE note (resolved by title or alias),
    // we skip the RightBar panel because it triggers the Suggestion UI in the editor anyway.
    let isEditingActiveFile = false
    if (['patch', 'propose', 'edit', 'append'].includes(action) && args[0]) {
      const { state } = await import('../../core/state')
      const targetNote = agentExecutor.resolveNote(args[0])
      if (targetNote && targetNote.id === state.activeId) {
        isEditingActiveFile = true
      }
    }

    const isHazardous =
      ['terminal', 'shell', 'run', 'delete', 'rm', 'write', 'create', 'touch'].includes(action) ||
      (['patch', 'propose', 'edit', 'append'].includes(action) && !isEditingActiveFile)

    if (isHazardous && this.onConfirm) {
      const confirmed = await this.onConfirm(cmdString)
      if (!confirmed) {
        throw new Error(`Command "${action}" rejected by user.`)
      }
    }

    switch (action) {
      case 'read':
        return agentExecutor.readNote(args[0])
      case 'write':
      case 'create':
        return agentExecutor.writeNote(args[0], args[1])
      case 'append':
        return agentExecutor.appendNote(args[0], args[1])
      case 'patch':
      case 'edit':
        return agentExecutor.patchNote(args[0], args[1], args[2], args[3], args[4])
      case 'propose':
        return agentExecutor.proposeNote(args[0], args[1])
      case 'mkdir':
        return agentExecutor.createFolder(args[0], args[1])
      case 'touch':
        return agentExecutor.writeNote(args[0], '')
      case 'move':
        return agentExecutor.move(args[0], args[1])
      case 'rename':
        return agentExecutor.rename(args[0], args[1])
      case 'delete':
      case 'rm':
        return agentExecutor.delete(args[0])
      case 'terminal':
      case 'shell':
      case 'run':
      case 'npm':
        return agentExecutor.executeTerminal(
          action === 'npm' ? `npm ${args.join(' ')}` : args.join(' ')
        )
      case 'search':
      case 'grep':
        return window.api.searchNotes(args.join(' ')).then((notes) => {
          if (notes.length === 0) return 'No results found.'
          return (
            `Found ${notes.length} matches:\n` +
            notes.map((n) => `- ${n.title}${n.path ? ` (${n.path})` : ''}`).join('\n')
          )
        })
      case 'read-editor':
        return this.getActiveEditorContent()
      case 'list':
      case 'tree': {
        const notes = await window.api.listNotes()
        return `Vault Structure:\n${agentExecutor.formatTree(notes)}`
      }
      default:
        throw new Error(`Unknown agent command: ${action}`)
    }
  }

  /**
   * Generate a title from AI content (reusable logic)
   */
  extractTitle(text: string, fallback: string): string {
    const lines = text.trim().split('\n')
    for (const line of lines) {
      const headerMatch = line.match(/^#+\s+(.+)$/)
      if (headerMatch) {
        const candidate = headerMatch[1].trim()
        if (candidate.length > 2 && candidate.length < 60) return candidate
      }
    }
    const firstLine = lines[0]?.replace(/^[#*-\s]+/, '').trim() || ''
    return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine || fallback
  }

  /**
   * Archive an AI response as a new note, extracting title automatically
   */
  async archiveResponse(fullText: string, originalInput: string): Promise<string> {
    const title = this.extractTitle(fullText, originalInput)
    const cleanContent = fullText.replace(/\[RUN:\s*(.+?)\]/g, '').trim()

    const meta = await agentExecutor.writeNote(title, cleanContent)
    return typeof meta === 'string' ? '' : meta.id
  }
}

export const agentService = new AgentService()
