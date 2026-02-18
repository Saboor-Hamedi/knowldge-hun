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
  const oldLines = oldContent.replace(/\r\n/g, '\n').split('\n')
  const newLines = newContent.replace(/\r\n/g, '\n').split('\n')
  const result: DiffChange[] = []

  let i = 0
  let j = 0

  while (i < oldLines.length || j < newLines.length) {
    // 1. If matches, it's unchanged
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      result.push({ type: 'unchanged', value: oldLines[i], oldIndex: i, newIndex: j })
      i++
      j++
      continue
    }

    // 2. Look ahead to see if this is an addition or a removal
    // Simple heuristic: if we can find oldLines[i] in the next 10 lines of newLines, it's an addition
    let foundMatch = false
    for (let look = 1; look <= 10 && j + look < newLines.length; look++) {
      if (oldLines[i] === newLines[j + look]) {
        // Line i eventually appears in newLines. So everything between j and j+look is ADDED.
        for (let k = 0; k < look; k++) {
          result.push({ type: 'added', value: newLines[j], newIndex: j })
          j++
        }
        foundMatch = true
        break
      }
    }

    if (!foundMatch && i < oldLines.length) {
      // Line i never appears. It's REMOVED.
      result.push({ type: 'removed', value: oldLines[i], oldIndex: i })
      i++
    } else if (!foundMatch && j < newLines.length) {
      // We exhausted oldLines but still have newLines. They are ADDED.
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
