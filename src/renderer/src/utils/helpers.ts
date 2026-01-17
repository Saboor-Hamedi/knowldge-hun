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

export function syncTabsWithNotes(
  openTabs: NoteMeta[],
  notes: NoteMeta[]
): NoteMeta[] {
  const map = new Map(notes.map((note) => [note.id, note]))
  return openTabs
    .map((tab) => map.get(tab.id) ?? tab)
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
