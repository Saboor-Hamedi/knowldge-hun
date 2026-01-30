export type DiffChange = {
  type: 'added' | 'removed' | 'unchanged'
  value: string
  oldIndex?: number
  newIndex?: number
}

/**
 * Basic line-by-line diff implementation
 */
export function diffLines(oldContent: string, newContent: string): DiffChange[] {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const result: DiffChange[] = []

  let i = 0
  let j = 0

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      result.push({ type: 'unchanged', value: oldLines[i], oldIndex: i, newIndex: j })
      i++
      j++
    } else if (j < newLines.length && !oldLines.includes(newLines[j], i)) {
      result.push({ type: 'added', value: newLines[j], newIndex: j })
      j++
    } else if (i < oldLines.length) {
      result.push({ type: 'removed', value: oldLines[i], oldIndex: i })
      i++
    } else if (j < newLines.length) {
      result.push({ type: 'added', value: newLines[j], newIndex: j })
      j++
    }
  }

  return result
}

/**
 * Group diff changes into chunks (consecutive additions/removals)
 */
export type DiffChunk = {
  type: 'change' | 'unchanged'
  originalLines: string[]
  newLines: string[]
  startLine: number // 1-indexed for Monaco
  endLine: number
}

export function groupDiffChanges(changes: DiffChange[]): DiffChunk[] {
  const chunks: DiffChunk[] = []
  let lineOffset = 1

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]

    if (change.type === 'unchanged') {
      chunks.push({
        type: 'unchanged',
        originalLines: [change.value],
        newLines: [change.value],
        startLine: lineOffset,
        endLine: lineOffset
      })
      lineOffset++
    } else {
      // It's a change. Let's capture CONSECUTIVE removals and additions
      // that are part of the SAME modification.
      const originalLines: string[] = []
      const newLines: string[] = []

      // Look ahead to collect all consecutive changes of the same group
      // Rules:
      // 1. Collect all consecutive 'removed' lines
      // 2. Collect all consecutive 'added' lines immediately following them
      while (i < changes.length && changes[i].type === 'removed') {
        originalLines.push(changes[i].value)
        i++
      }
      while (i < changes.length && changes[i].type === 'added') {
        newLines.push(changes[i].value)
        i++
      }
      i-- // Step back since loop will increment

      const start = lineOffset
      const end = lineOffset + originalLines.length - 1

      chunks.push({
        type: 'change',
        originalLines,
        newLines,
        startLine: start,
        endLine: Math.max(start, end)
      })

      lineOffset += originalLines.length
    }
  }

  return chunks
}
