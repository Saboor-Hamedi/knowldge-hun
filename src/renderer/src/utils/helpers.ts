import type { NoteMeta } from '../core/types'

export function formatTimestamp(ms: number): string {
  const date = new Date(ms)
  return date.toLocaleString()
}

export function timeAgo(ms: number): string {
  const now = Date.now()
  const diff = now - ms
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  return `${years} year${years > 1 ? 's' : ''} ago`
}

export function sortNotes(notes: NoteMeta[]): void {
  notes.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function syncTabsWithNotes(openTabs: NoteMeta[], notes: NoteMeta[]): NoteMeta[] {
  const map = new Map(notes.map((note) => [note.id, note]))
  return openTabs
    .map((tab) => {
      // Keep special tabs (settings, graphs, previews) as they aren't in the main notes list
      if (tab.id === 'settings' || tab.id === 'graph' || tab.id.startsWith('preview-')) {
        return tab
      }
      // For all other tabs, they MUST exist in the current notes list
      return map.get(tab.id)
    })
    .filter((tab): tab is NoteMeta => Boolean(tab))
}

export function ensureTab(openTabs: NoteMeta[], meta: NoteMeta): NoteMeta[] {
  const exists = openTabs.some((tab) => tab.id === meta.id)
  if (!exists) {
    return [...openTabs, meta]
  }
  return openTabs.map((tab) => (tab.id === meta.id ? meta : tab))
}

export function sortTabs(tabs: NoteMeta[], pinnedTabs: Set<string>): NoteMeta[] {
  return [...tabs].sort((a, b) => {
    const isAPinned = pinnedTabs.has(a.id)
    const isBPinned = pinnedTabs.has(b.id)
    if (isAPinned && !isBPinned) return -1
    if (!isAPinned && isBPinned) return 1
    return 0
  })
}

export function applyTitleToContent(content: string, title: string): string {
  const safeTitle = title.trim()
  const newline = content.includes('\r\n') ? '\r\n' : '\n'

  // Empty file: just seed heading with a spacer line
  if (!content || content.trim().length === 0) {
    return safeTitle ? `# ${safeTitle}${newline}${newline}` : content
  }

  const lines = content.split(/\r?\n/)
  if (lines.length === 0) return `# ${safeTitle}`

  // If the first line is already a heading, replace it; otherwise prepend
  if (lines[0].startsWith('#')) {
    lines[0] = `# ${safeTitle}`
  } else {
    lines.unshift(`# ${safeTitle}`)
  }

  // Ensure a blank line after the heading for readability
  if (lines.length > 1 && lines[1].trim() !== '') {
    lines.splice(1, 0, '')
  }

  return lines.join(newline)
}

export function extractWikiLinks(content: string): string[] {
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  const links: string[] = []
  let match

  while ((match = wikiLinkRegex.exec(content)) !== null) {
    links.push(match[1].trim()) // Use the link target, not the display text
  }

  return [...new Set(links)] // Remove duplicates
}

export function extractTags(content: string): string[] {
  const tagRegex = /#([a-zA-Z0-9_-]+)/g
  const tags: string[] = []
  let match

  while ((match = tagRegex.exec(content)) !== null) {
    tags.push(match[1].toLowerCase()) // Normalize to lowercase
  }

  return [...new Set(tags)] // Remove duplicates
}

export function extractMentions(content: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g
  const mentions: string[] = []
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1].toLowerCase()) // Normalize to lowercase
  }

  return [...new Set(mentions)] // Remove duplicates
}

export function estimateReadTime(content: string, wordsPerMinute: number = 200): number {
  // Remove markdown formatting for more accurate word count
  const cleanContent = content
    .replace(/^---\n[\s\S]*?\n---\n/, '') // Remove frontmatter
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]*`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with just text
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, p1, p2) => p2 || p1) // Replace wikilinks with display text
    .replace(/^#+\s/gm, '') // Remove headings
    .replace(/^\s*[-*+]\s/gm, '') // Remove list markers
    .replace(/^\s*\d+\.\s/gm, '') // Remove numbered list markers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/_{2}([^_]+)_{2}/g, '$1') // Remove underline
    .replace(/_([^_]+)_/g, '$1') // Remove underline
    .replace(/~~([^~]+)~~/g, '$1') // Remove strikethrough
    .trim()

  const words = cleanContent.split(/\s+/).filter((word) => word.length > 0)
  const minutes = Math.ceil(words.length / wordsPerMinute)
  return Math.max(1, minutes) // At least 1 minute
}

export function getNoteMetrics(content: string): {
  words: number
  chars: number
  lines: number
  readTime: number
  wikiLinks: number
  tags: number
  mentions: number
} {
  const words = content.trim()
    ? content
        .trim()
        .split(/\s+/)
        .filter((w: string) => w).length
    : 0
  const chars = content.length
  const lines = content.split('\n').length
  const readTime = estimateReadTime(content)
  const wikiLinks = extractWikiLinks(content).length
  const tags = extractTags(content).length
  const mentions = extractMentions(content).length

  return {
    words,
    chars,
    lines,
    readTime,
    wikiLinks,
    tags,
    mentions
  }
}
