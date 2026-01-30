/**
 * Agent Tool Definitions
 *
 * This file defines the "Vocabulary" of actions the AI can perform.
 * Each tool has a name, description, and required parameters.
 */

export interface AgentAction {
  type: 'write_note' | 'append_note' | 'create_folder' | 'move_item' | 'delete_item' | 'rename_item'
  params: Record<string, any>
}

export interface ToolDefinition {
  name: string
  description: string
  example: string
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'write',
    description: 'Create a new note or overwrite an existing one with content.',
    example: '[RUN: write "Note Title" content...]'
  },
  {
    name: 'append',
    description: 'Add content to the end of an existing note.',
    example: '[RUN: append "Note Title" content...]'
  },
  {
    name: 'mkdir',
    description: 'Create a new folder in the vault.',
    example: '[RUN: mkdir "Folder Name"]'
  },
  {
    name: 'move',
    description: 'Move a note or folder to a different location.',
    example: '[RUN: move "item_path" "destination_folder"]'
  },
  {
    name: 'delete',
    description: 'Remove a note or folder from the vault.',
    example: '[RUN: delete "item_path"]'
  },
  {
    name: 'rename',
    description: 'Rename an existing note or folder.',
    example: '[RUN: rename "old_path" "new_name"]'
  }
]
