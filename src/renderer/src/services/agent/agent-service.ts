import { agentExecutor } from './executor'

/**
 * AgentService
 *
 * The main entry point for AI-driven operations.
 * Handles parsing of [RUN: ...] commands and coordinates execution.
 */
export class AgentService {
  /**
   * Parse and execute multiple commands from AI text
   */
  async processResponse(text: string): Promise<string[]> {
    const runMatches = Array.from(text.matchAll(/\[RUN:\s*(.+?)\]/g))
    const results: string[] = []

    for (const match of runMatches) {
      const fullCmd = match[1].trim()
      try {
        await this.executeCommand(fullCmd)
        results.push(`Success: ${fullCmd}`)
      } catch (err) {
        console.error(`[AgentService] Execution failed: ${fullCmd}`, err)
        results.push(`Error: ${fullCmd} (${(err as Error).message})`)
      }
    }

    return results
  }

  /**
   * Internal command router
   */
  private async executeCommand(cmdString: string): Promise<any> {
    // Better parser that handles quoted titles but preserves the REST as a single string
    const parts: string[] = []
    let currentPart = ''
    let inQuotes = false

    for (let i = 0; i < cmdString.length; i++) {
      const char = cmdString[i]
      if (char === '"') {
        inQuotes = !inQuotes
        // Don't break if we just closed quotes and there's more
      } else if (char === ' ' && !inQuotes) {
        if (currentPart) {
          parts.push(currentPart)
          currentPart = ''
        }
      } else {
        currentPart += char
      }

      // Optimization: if it's write/append, we only need the first two parts (cmd, title)
      // and the REST is content.
      if (parts.length === 2 && !inQuotes && (parts[0] === 'write' || parts[0] === 'append')) {
        const rest = cmdString.substring(i + 1).trim()
        if (rest) {
          parts.push(rest)
          break
        }
      }
    }
    if (currentPart) parts.push(currentPart)

    const action = parts[0].toLowerCase()
    const args = parts.slice(1)

    switch (action) {
      case 'read':
        return agentExecutor.readNote(args[0])
      case 'write':
        return agentExecutor.writeNote(args[0], args[1])
      case 'append':
        return agentExecutor.appendNote(args[0], args[1])
      case 'mkdir':
        return agentExecutor.createFolder(args[0], args[1])
      case 'move':
        return agentExecutor.move(args[0], args[1])
      case 'rename':
        return agentExecutor.rename(args[0], args[1])
      case 'delete':
      case 'rm':
        return agentExecutor.delete(args[0])
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
