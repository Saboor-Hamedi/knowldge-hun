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
    while (true) {
      const startTag = '[RUN:'
      const startIdx = text.indexOf(startTag, searchIdx)
      if (startIdx === -1) break

      // Find the closing bracket that matches this [RUN:
      // We must respect quotes and escaped characters
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

      if (endIdx === -1) {
        // Unclosed [RUN: block - potentially still being streamed
        break
      }

      searchIdx = endIdx + 1
      const fullCmd = text.substring(startIdx + startTag.length, endIdx).trim()

      if (signal?.aborted) break

      // DEDUPLICATION: Don't run the exact same command twice in one message
      if (executedCommands.has(fullCmd)) {
        console.log(`[AgentService] Skipping duplicate command: ${fullCmd}`)
        continue
      }
      executedCommands.add(fullCmd)

      try {
        const result = await this.executeCommand(fullCmd)
        // If result is a string, use it. Otherwise, use a technical success status
        const feedback = typeof result === 'string' ? result : 'Status: OK'

        // FEEDBACK ISOLATION: Use [DONE: ] instead of [RUN: ] for reports
        // This prevents the ConversationController from re-triggering on its own results.
        results.push(`> [DONE: ${fullCmd}]\n${feedback}`)
        if (onProgress) onProgress()
      } catch (err) {
        console.error(`[AgentService] Execution failed: ${fullCmd}`, err)
        results.push(`> [DONE: ${fullCmd}]\nError: ${(err as Error).message}`)
        if (onProgress) onProgress()

        // incremental feedback: stop on first error to let AI pivot
        break
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

    // HAZARDOUS COMMANDS: Require confirmation
    const isHazardous = [
      'terminal',
      'shell',
      'run',
      'delete',
      'rm',
      'write',
      'patch',
      'create',
      'edit',
      'append',
      'touch'
    ].includes(action)
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
        return agentExecutor.patchNote(args[0], args[1], args[2])
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
    return meta.id
  }
}

export const agentService = new AgentService()
