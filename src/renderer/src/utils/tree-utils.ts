import type { NoteMeta, TreeItem } from '../core/types'

export function sortTreeItems<T extends NoteMeta>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    // 1. Group folders at the top
    const aIsFolder = a.type === 'folder'
    const bIsFolder = b.type === 'folder'
    if (aIsFolder && !bIsFolder) return -1
    if (!aIsFolder && bIsFolder) return 1

    // 2. Sort strictly by creation time (Ascending: older at top, newest at bottom)
    const aTime = a.createdAt || 0
    const bTime = b.createdAt || 0

    if (aTime !== bTime) {
      return aTime - bTime
    }

    // 3. Fallback: alphabetical if timestamps are identical
    return (a.title || '').localeCompare(b.title || '')
  })
}

export function sortTreeRecursive(list: TreeItem[]): void {
  // Sort the current level using unified logic
  const sorted = sortTreeItems(list)
  // Update the list elements in place
  list.length = 0
  list.push(...sorted)

  // Recursively sort children
  list.forEach((i) => {
    if (i.children && i.children.length > 0) {
      sortTreeRecursive(i.children)
    }
  })
}
