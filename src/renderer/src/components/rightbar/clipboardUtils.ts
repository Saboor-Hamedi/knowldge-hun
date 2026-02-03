import type { ChatMessage } from '../../services/aiService'

/**
 * Copies the entire conversation to the clipboard in Markdown format.
 * @param messages The array of chat messages to copy.
 */
export async function copyConversationToClipboard(messages: ChatMessage[]): Promise<void> {
  if (messages.length === 0) return

  let markdown = ''
  messages.forEach((msg) => {
    const role = msg.role === 'user' ? 'User' : 'AI'
    markdown += `### ${role}:\n\n${msg.content}\n\n---\n\n`
  })

  try {
    await navigator.clipboard.writeText(markdown)
    // Visual feedback - simple toast or just log for now
    console.log('Conversation copied to clipboard')
  } catch (err) {
    console.error('Failed to copy conversation:', err)
  }
}
