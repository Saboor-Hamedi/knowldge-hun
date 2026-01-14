import { state } from '../core/state'
import type { NoteMeta, TreeItem } from '../core/types'

export function sortTreeItems<T extends NoteMeta>(items: T[]): T[] {
  const newlyCreatedIds = state.newlyCreatedIds
  
  return [...items].sort((a, b) => {
    // 1. Priority for newly created items
    const aNew = newlyCreatedIds.has(a.id)
    const bNew = newlyCreatedIds.has(b.id)
    
    if (aNew && !bNew) return -1
    if (!aNew && bNew) return 1
    if (aNew && bNew) return (a.title || '').localeCompare(b.title || '')

    // 2. Folders first
    const aIsFolder = a.type === 'folder' || 'children' in a
    const bIsFolder = b.type === 'folder' || 'children' in b
    
    if (aIsFolder && !bIsFolder) return -1
    if (!aIsFolder && bIsFolder) return 1
    
    // 3. Then alphabetical
    return (a.title || '').localeCompare(b.title || '')
  })
}

export function sortTreeRecursive(list: TreeItem[]): void {
  sortTreeItems(list) // Note: this returns a new array, but we want to sort in place or update reference
  // Actually, let's make it more robust
  list.sort((a, b) => {
    const newlyCreatedIds = state.newlyCreatedIds
    const aNew = newlyCreatedIds.has(a.id)
    const bNew = newlyCreatedIds.has(b.id)
    if (aNew && !bNew) return -1
    if (!aNew && bNew) return 1
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return (a.title || '').localeCompare(b.title || '')
  })
  
  list.forEach(i => {
    if (i.children && i.children.length > 0) {
      sortTreeRecursive(i.children)
    }
  })
}
