import type { TreeItem } from '../../core/types'

/**
 * AgentExecutor - Handles execution of AI agentic commands [RUN: ...]
 */
export class AgentExecutor {
  /**
   * Parse AI response for [RUN: command] tags and execute them
   */
  static async executeAll(
    content: string,
    onProgress: () => void,
    signal?: AbortSignal
  ): Promise<string[]> {
    const commandRegex = /\[RUN:\s*(.+?)\]/gs
    const results: string[] = []
    let match

    while ((match = commandRegex.exec(content)) !== null) {
      // Check for cancellation before each command execution
      if (signal?.aborted) break

      const commandText = match[1].trim()
      try {
        const result = await this.executeSingle(commandText)
        results.push(`> [RUN: ${commandText}]\n${result}`)
        onProgress()
      } catch (err: unknown) {
        results.push(
          `> [RUN: ${commandText}]\nError: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    return results
  }

  /**
   * Execute a single agentic command
   */
  private static async executeSingle(commandText: string): Promise<string> {
    const parts = this.parseArgs(commandText)
    if (parts.length === 0) return 'Error: Invalid command format'

    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)

    switch (cmd) {
      case 'read': {
        const query = args[0]
        if (!query) return 'Error: read requires a title, path, or ID'
        const item = await this.findInVault(query)
        if (!item) return `Error: Item "${query}" not found.`
        const data = await window.api.loadNote(item.id, item.path)
        return `Content of "${item.title}":\n\n${data?.content || ''}`
      }

      case 'touch': {
        const title = args[0]
        if (!title) return 'Error: touch requires a title'
        await window.api.createNote(title)
        return `Success: Created empty note "${title}".`
      }

      case 'write': {
        const title = args[0]
        const content = args[1] || ''
        if (!title) return 'Error: write requires a title'
        const item = await this.findInVault(title)
        if (item) {
          await window.api.saveNote({ ...item, content })
          return `Success: Updated note "${item.title}". DONE.`
        } else {
          const newNote = await window.api.createNote(title)
          await window.api.saveNote({ ...newNote, content })
          return `Success: Created and wrote to note "${title}". DONE.`
        }
      }

      case 'append': {
        const title = args[0]
        const extra = args[1] || ''
        if (!title) return 'Error: append requires a title'
        const item = await this.findInVault(title)
        if (!item) return `Error: Note "${title}" not found.`
        const data = await window.api.loadNote(item.id, item.path)
        const newContent = (data?.content || '') + (data?.content ? '\n' : '') + extra
        await window.api.saveNote({ ...item, content: newContent })
        return `Success: Appended to "${item.title}". DONE.`
      }

      case 'propose': {
        const title = args[0]
        const newContent = args[1] || ''
        if (!title) return 'Error: propose requires a title'
        const item = await this.findInVault(title)
        if (item) {
          await window.api.saveNote({ ...item, content: newContent })
          return `Success: Applied proposed updates to "${item.title}". DONE.`
        } else {
          const newNote = await window.api.createNote(title)
          await window.api.saveNote({ ...newNote, content: newContent })
          return `Success: Created and wrote proposed content to "${title}". DONE.`
        }
      }

      case 'mkdir': {
        const name = args[0]
        if (!name) return 'Error: mkdir requires a name'
        await window.api.createFolder(name)
        return `Success: Created folder "${name}".`
      }

      case 'delete': {
        const query = args[0]
        if (!query) return 'Error: delete requires a title, path, or ID'
        const item = await this.findInVault(query)
        if (!item) return `Error: Item "${query}" not found.`
        if (item.type === 'folder')
          await window.api.deleteFolder(item.id) // ID is the relative path for folders too
        else await window.api.deleteNote(item.id, item.path)
        return `Success: Deleted "${item.title}".`
      }

      case 'rename': {
        const oldName = args[0]
        const newName = args[1]
        if (!oldName || !newName) return 'Error: rename requires old and new names'
        const item = await this.findInVault(oldName)
        if (!item) return `Error: Item "${oldName}" not found.`
        if (item.type === 'folder') await window.api.renameFolder(item.id, newName)
        else await window.api.renameNote(item.id, newName, item.path)
        return `Success: Renamed to "${newName}".`
      }

      case 'list': {
        const notes = await window.api.listNotes()
        return `Vault Structure:\n${this.formatTree(notes)}`
      }

      default:
        return `Error: Unknown command "${cmd}".`
    }
  }

  private static async findInVault(query: string): Promise<TreeItem | null> {
    const notes = (await window.api.listNotes()) as TreeItem[]
    return this.searchTree(notes, query)
  }

  private static searchTree(items: TreeItem[], query: string): TreeItem | null {
    for (const item of items) {
      if (item.title === query || item.path === query || item.id === query) return item
      if (item.children) {
        const found = this.searchTree(item.children, query)
        if (found) return found
      }
    }
    return null
  }

  private static formatTree(items: TreeItem[], indent = ''): string {
    let res = ''
    for (const item of items) {
      const icon = item.type === 'folder' ? '📂' : '📄'
      res += `${indent}${icon} ${item.title}\n`
      if (item.children) res += this.formatTree(item.children, indent + '  ')
    }
    return res
  }

  private static parseArgs(text: string): string[] {
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/gs
    const parts: string[] = []
    let match
    while ((match = regex.exec(text)) !== null) {
      parts.push(match[1] || match[2] || match[0])
    }
    return parts
  }
}
