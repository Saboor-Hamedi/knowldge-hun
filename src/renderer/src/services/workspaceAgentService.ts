import { state } from '../core/state'
import { ragService } from './rag/ragService'
import type { NoteMeta, NotePayload } from '../core/types'

/**
 * WorkspaceAgentService
 *
 * Centralized logic for agentic operations on the workspace.
 * Encapsulates "smart" behaviors like finding the right file target,
 * extracting titles from AI responses, and performing multi-step file ops.
 */
export class WorkspaceAgentService {
  /**
   * Smartly find a note target based on title/id and active state
   */
  findTargetNote(titleInput: string): NoteMeta | undefined {
    // PRIORITY 1: Check if the title matches the ACTIVE note
    let targetNote = state.notes.find((n) => n.id === state.activeId)

    // Match by title or ID if not already found or if active note doesn't match
    if (
      !targetNote ||
      (targetNote.title.toLowerCase() !== titleInput.toLowerCase() && targetNote.id !== titleInput)
    ) {
      targetNote = state.notes.find(
        (n) =>
          n.title.toLowerCase() === titleInput.toLowerCase() ||
          n.id.toLowerCase() === titleInput.toLowerCase() ||
          n.id.toLowerCase() === `${titleInput.toLowerCase()}.md`
      )
    }
    return targetNote
  }

  /**
   * Write content to a note (Create if not found)
   */
  async smartWrite(
    title: string,
    content: string,
    parentPath?: string
  ): Promise<NoteMeta & { isNew: boolean }> {
    const targetNote = this.findTargetNote(title)

    if (targetNote) {
      await window.api.saveNote({
        id: targetNote.id,
        content,
        title: targetNote.title
      } as NotePayload)
      // Re-index in RAG
      void ragService.indexNote(targetNote.id, content, {
        title: targetNote.title,
        path: targetNote.path
      })
      return {
        ...targetNote,
        isNew: false
      }
    } else {
      const meta = await window.api.createNote(title, parentPath)
      await window.api.saveNote({ id: meta.id, content, title: meta.title } as NotePayload)
      void ragService.indexNote(meta.id, content, { title: meta.title, path: meta.path })
      return {
        ...meta,
        isNew: true
      }
    }
  }

  /**
   * Append content to a note
   */
  async smartAppend(title: string, content: string): Promise<string | null> {
    const targetNote = this.findTargetNote(title)
    if (!targetNote) return null

    const noteData = await window.api.loadNote(targetNote.id, targetNote.path)
    const newContent = (noteData?.content || '') + '\n' + content
    await window.api.saveNote({
      id: targetNote.id,
      content: newContent,
      title: targetNote.title
    } as NotePayload)
    void ragService.indexNote(targetNote.id, newContent, {
      title: targetNote.title,
      path: targetNote.path
    })
    return targetNote.id
  }

  /**
   * Archive an AI response as a new note, extracting title automatically
   */
  async archiveResponse(fullText: string, originalInput: string): Promise<string> {
    let title = ''
    const lines = fullText.trim().split('\n')
    for (const line of lines) {
      const headerMatch = line.match(/^#+\s+(.+)$/)
      if (headerMatch) {
        const candidate = headerMatch[1].trim()
        if (candidate.length > 2 && candidate.length < 60) {
          title = candidate
          break
        }
      }
    }
    if (!title && lines.length > 0) {
      const firstLine = lines[0].replace(/^[#*-\s]+/, '').trim()
      title = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine
    }
    if (!title)
      title = originalInput.length > 30 ? originalInput.substring(0, 30) + '...' : originalInput

    const cleanContent = fullText.replace(/\[RUN:\s*(.+?)\]/g, '').trim()
    const meta = await window.api.createNote(title)
    await window.api.saveNote({
      id: meta.id,
      content: cleanContent,
      title: meta.title
    } as NotePayload)
    void ragService.indexNote(meta.id, cleanContent, { title: meta.title, path: meta.path })
    return meta.id
  }

  /**
   * Simple folder creation wrapper
   */
  async createFolder(name: string, parentPath?: string): Promise<{ name: string; path: string }> {
    return window.api.createFolder(name, parentPath)
  }
}

export const workspaceAgentService = new WorkspaceAgentService()
