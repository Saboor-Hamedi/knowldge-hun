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
  const initialChunks: DiffChunk[] = []
  let lineOffset = 1

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]

    if (change.type === 'unchanged') {
      initialChunks.push({
        type: 'unchanged',
        originalLines: [change.value],
        newLines: [change.value],
        startLine: lineOffset,
        endLine: lineOffset
      })
      lineOffset++
    } else {
      const originalLines: string[] = []
      const newLines: string[] = []

      // Collect ALL consecutive non-unchanged lines into one logical chunk
      while (i < changes.length && (changes[i].type === 'removed' || changes[i].type === 'added')) {
        if (changes[i].type === 'removed') {
          originalLines.push(changes[i].value)
        } else {
          newLines.push(changes[i].value)
        }
        i++
      }
      i--

      const start = lineOffset
      const end = lineOffset + originalLines.length - 1

      initialChunks.push({
        type: 'change',
        originalLines,
        newLines,
        startLine: start,
        endLine: Math.max(start, end)
      })

      lineOffset += originalLines.length
    }
  }

  // SECOND PASS: Merge close chunks (gap <= 3 lines)
  const merged: DiffChunk[] = []
  for (let i = 0; i < initialChunks.length; i++) {
    const current = initialChunks[i]

    if (merged.length === 0) {
      merged.push(current)
      continue
    }

    const last = merged[merged.length - 1]

    if (current.type === 'unchanged') {
      // Potentially swallow this gap if a change follows soon
      let gapLines = 0
      let j = i
      while (j < initialChunks.length && initialChunks[j].type === 'unchanged' && gapLines < 3) {
        gapLines++
        j++
      }

      if (
        last.type === 'change' &&
        j < initialChunks.length &&
        initialChunks[j].type === 'change'
      ) {
        // Merge the gap AND the following change into 'last'
        for (let k = i; k < j; k++) {
          last.originalLines.push(...initialChunks[k].originalLines)
          last.newLines.push(...initialChunks[k].newLines)
        }
        const nextChange = initialChunks[j]
        last.originalLines.push(...nextChange.originalLines)
        last.newLines.push(...nextChange.newLines)
        last.endLine = nextChange.endLine
        i = j // Advance pointer
      } else {
        // Just push the unchanged chunk
        merged.push(current)
      }
    } else {
      // Current is a 'change'
      if (last.type === 'change') {
        // Consecutive change - merge immediately
        last.originalLines.push(...current.originalLines)
        last.newLines.push(...current.newLines)
        last.endLine = current.endLine
      } else {
        merged.push(current)
      }
    }
  }

  return merged
}
