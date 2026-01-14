import type { NoteMeta } from '../core/types'

export function formatTimestamp(ms: number): string {
  const date = new Date(ms)
  return date.toLocaleString()
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
