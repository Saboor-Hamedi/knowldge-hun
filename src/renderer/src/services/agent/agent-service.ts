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
    const runMatches = Array.from(text.matchAll(/\[RUN:\s*([\s\S]+?)\]/g))
    const results: string[] = []

    for (const match of runMatches) {
      if (signal?.aborted) break

      const fullCmd = match[1].trim()
      try {
        const result = await this.executeCommand(fullCmd)
        // If result is a string, use it. Otherwise, use success message.
        results.push(`> [RUN: ${fullCmd}]\n${typeof result === 'string' ? result : 'Success'}`)
        if (onProgress) onProgress()
      } catch (err) {
        console.error(`[AgentService] Execution failed: ${fullCmd}`, err)
        results.push(`> [RUN: ${fullCmd}]\nError: ${(err as Error).message}`)
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
      if ((char === '"' || char === "'") && (!inQuotes || char === quoteChar)) {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = char
        } else {
          inQuotes = false
          quoteChar = ''
        }
      } else if (char === ' ' && !inQuotes) {
        if (currentPart) {
          parts.push(currentPart)
          currentPart = ''
        }
      } else {
        currentPart += char
      }

      // Special handling for write/append/propose: The second quoted block (or unquoted text)
      // is the content and we take the rest of the string.
      if (
        parts.length === 2 &&
        !inQuotes &&
        ['write', 'append', 'propose'].includes(parts[0].toLowerCase())
      ) {
        let rest = cmdString.substring(i + 1).trim()
        // Strip exactly one layer of quotes from the rest if they exist
        if (
          (rest.startsWith('"') && rest.endsWith('"')) ||
          (rest.startsWith("'") && rest.endsWith("'"))
        ) {
          rest = rest.substring(1, rest.length - 1)
        }
        if (rest) {
          parts.push(rest)
          break
        }
      }
    }
    if (currentPart) parts.push(currentPart)

    const action = parts[0].toLowerCase()
    const args = parts.slice(1)

    // HAZARDOUS COMMANDS: Require confirmation
    const isHazardous = ['terminal', 'shell', 'run', 'delete', 'rm'].includes(action)
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
