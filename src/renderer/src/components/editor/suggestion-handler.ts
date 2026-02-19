import { diffLines, groupDiffChanges, DiffChunk } from '../../utils/diff'
import './suggestion-styles.css'
import { codicons } from '../../utils/codicons'

interface TrackedChunk extends DiffChunk {
  id: string
}

export class SuggestionManager {
  private editor: any
  private monaco: any
  private decorations: string[] = []
  private currentChunks: TrackedChunk[] = []
  private toolbars: HTMLElement[] = []
  private viewZones: string[] = []
  private globalHeader: HTMLElement | null = null
  private currentChunkIndex: number = 0

  constructor(editor: any, monaco: any) {
    this.editor = editor
    this.monaco = monaco
  }

  public propose(newContent: string): void {
    const oldContent = this.editor.getValue()
    const diffs = diffLines(oldContent, newContent)
    const rawChunks = groupDiffChanges(diffs).filter((c) => {
      // Must have actual line changes and valid line numbers
      return (
        c.type === 'change' &&
        (c.originalLines.length > 0 || c.newLines.length > 0) &&
        c.startLine > 0
      )
    })

    this.currentChunks = rawChunks.map((c, i) => ({
      ...c,
      id: `suggestion-${Date.now()}-${i}`
    }))

    this.clear()
    this.currentChunkIndex = 0

    if (this.currentChunks.length > 0) {
      this.renderSuggestions()
      this.renderGlobalHeader()

      // Reveal first change
      this.editor.revealLineInCenter(this.currentChunks[0].startLine)
    }
  }

  public clear(): void {
    this.decorations = this.editor.deltaDecorations(this.decorations, [])
    this.toolbars.forEach((tb) => {
      if ((tb as any).widget) {
        this.editor.removeContentWidget((tb as any).widget)
      }
      tb.remove()
    })
    this.toolbars = []

    this.editor.changeViewZones((accessor: any) => {
      this.viewZones.forEach((id) => accessor.removeZone(id))
      this.viewZones = []
    })

    if (this.globalHeader) {
      this.globalHeader.remove()
      this.globalHeader = null
    }
  }

  private renderSuggestions(): void {
    const newDecorations: any[] = []
    const lineCount = this.editor.getModel()?.getLineCount() || 1

    this.currentChunks.forEach((chunk, index) => {
      const safeStart = Math.max(1, Math.min(chunk.startLine, lineCount))
      const safeEnd = Math.max(safeStart, Math.min(chunk.endLine, lineCount))

      // 1. Highlight removed lines
      if (chunk.originalLines.length > 0) {
        newDecorations.push({
          range: new this.monaco.Range(safeStart, 1, safeEnd, 1000),
          options: {
            isWholeLine: true,
            className: 'suggestion-highlight-removed',
            linesDecorationsClassName: 'suggestion-gutter-removed'
          }
        })
      }

      // 2. Add Toolbar for this chunk
      this.addToolbar(chunk)

      // 3. Show "Added" content as a ViewZone
      if (chunk.newLines.length > 0) {
        this.addViewZone(chunk)
      }
    })

    this.decorations = this.editor.deltaDecorations(this.decorations, newDecorations)
  }

  private renderGlobalHeader(): void {
    const parent = document.getElementById('app') || document.body
    if (!parent) return

    const header = document.createElement('div')
    header.className = 'suggestion-global-header'
    header.innerHTML = `
      <div class="suggestion-global-header__title">Reviewing Changes</div>
      <div class="suggestion-global-header__nav">
        <button class="suggestion-global-header__nav-btn" data-action="prev" title="Previous Change">${codicons.arrowUp || '↑'}</button>
        <div class="suggestion-global-header__count">${this.currentChunkIndex + 1} / ${this.currentChunks.length}</div>
        <button class="suggestion-global-header__nav-btn" data-action="next" title="Next Change">${codicons.arrowDown || '↓'}</button>
      </div>
      <div class="suggestion-global-header__actions">
        <button class="suggestion-global-header__btn" data-action="reject-all">Discard</button>
        <button class="suggestion-global-header__btn suggestion-global-header__btn--primary" data-action="accept-all">Accept All</button>
      </div>
    `

    header.querySelector('[data-action="prev"]')?.addEventListener('click', () => this.jumpTo(-1))
    header.querySelector('[data-action="next"]')?.addEventListener('click', () => this.jumpTo(1))
    header
      .querySelector('[data-action="reject-all"]')
      ?.addEventListener('click', () => this.clear())
    header
      .querySelector('[data-action="accept-all"]')
      ?.addEventListener('click', () => this.acceptAll())

    parent.appendChild(header)
    this.globalHeader = header
  }

  private jumpTo(delta: number): void {
    if (this.currentChunks.length === 0) return
    this.currentChunkIndex =
      (this.currentChunkIndex + delta + this.currentChunks.length) % this.currentChunks.length

    // Update count display
    if (this.globalHeader) {
      const countEl = this.globalHeader.querySelector('.suggestion-global-header__count')
      if (countEl)
        countEl.textContent = `${this.currentChunkIndex + 1} / ${this.currentChunks.length}`
    }

    const chunk = this.currentChunks[this.currentChunkIndex]
    this.editor.revealLineInCenter(chunk.startLine)
  }

  private addToolbar(chunk: TrackedChunk): void {
    const lineCount = this.editor.getModel()?.getLineCount() || 1
    const safeLine = Math.max(1, Math.min(chunk.startLine, lineCount))

    const toolbar = document.createElement('div')
    toolbar.className = 'suggestion-toolbar'

    const acceptBtn = document.createElement('button')
    acceptBtn.className = 'suggestion-toolbar__btn suggestion-toolbar__btn--accept'
    acceptBtn.innerHTML = codicons.check || '✓'
    acceptBtn.onclick = () => this.acceptSuggestion(chunk.id)

    const rejectBtn = document.createElement('button')
    rejectBtn.className = 'suggestion-toolbar__btn suggestion-toolbar__btn--reject'
    rejectBtn.innerHTML = codicons.close || '✗'
    rejectBtn.onclick = () => this.rejectSuggestion(chunk.id)

    toolbar.appendChild(acceptBtn)
    toolbar.appendChild(rejectBtn)

    const model = this.editor.getModel()
    const maxColumn = model?.getLineMaxColumn(safeLine) || 100

    const widget = {
      getDomNode: () => toolbar,
      getId: () => `suggestion-toolbar-${chunk.id}`,
      getPosition: () => ({
        position: { lineNumber: safeLine, column: maxColumn },
        preference: [2, 1] // Prefer BELOW, then ABOVE
      })
    }

    this.editor.addContentWidget(widget)
    this.toolbars.push(toolbar)
    ;(toolbar as any).widget = widget
  }

  private addViewZone(chunk: TrackedChunk): void {
    this.editor.changeViewZones((accessor: any) => {
      const lineCount = this.editor.getModel()?.getLineCount() || 1
      const safeLine = Math.max(1, Math.min(chunk.endLine, lineCount))

      const domNode = document.createElement('div')
      domNode.className = 'suggestion-view-zone'
      domNode.style.paddingLeft = '50px'

      chunk.newLines.forEach((line) => {
        const lineEl = document.createElement('div')
        lineEl.className = 'suggestion-highlight-added'
        lineEl.style.padding = '0 8px'
        lineEl.textContent = line || ' '
        domNode.appendChild(lineEl)
      })

      const zoneId = accessor.addZone({
        afterLineNumber: safeLine,
        heightInLines: chunk.newLines.length,
        domNode: domNode
      })
      this.viewZones.push(zoneId)
    })
  }

  private acceptSuggestion(id: string): void {
    const index = this.currentChunks.findIndex((c) => c.id === id)
    if (index === -1) return

    const chunk = this.currentChunks[index]
    this.applyChunkEdit(chunk)

    this.currentChunks.splice(index, 1)
    if (this.currentChunks.length === 0) {
      this.clear()
    } else {
      this.refreshUI()
    }
  }

  private acceptAll(): void {
    const edits: any[] = []
    const model = this.editor.getModel()
    if (!model) return

    // Apply changes from bottom to top to keep line numbers stable
    const sorted = [...this.currentChunks].sort((a, b) => b.startLine - a.startLine)

    sorted.forEach((chunk) => {
      const isInsertion = chunk.originalLines.length === 0
      const lineCount = model.getLineCount()
      const safeStartLine = Math.max(1, Math.min(chunk.startLine, lineCount))
      const safeEndLine = Math.max(safeStartLine, Math.min(chunk.endLine, lineCount))

      const range = isInsertion
        ? new this.monaco.Range(safeStartLine, 1, safeStartLine, 1)
        : new this.monaco.Range(safeStartLine, 1, safeEndLine, model.getLineMaxColumn(safeEndLine))

      let text = chunk.newLines.join('\n')
      if (isInsertion && chunk.startLine <= model.getLineCount()) {
        text += '\n'
      }
      edits.push({ range, text, forceMoveMarkers: true })
    })

    this.editor.executeEdits('ai-suggestion-all', edits)
    this.clear()
  }

  private applyChunkEdit(chunk: TrackedChunk): void {
    const model = this.editor.getModel()
    if (!model) return

    const isInsertion = chunk.originalLines.length === 0
    const lineCount = model.getLineCount()

    // Safety check: ensure startLine and endLine are within bounds
    const safeStartLine = Math.max(1, Math.min(chunk.startLine, lineCount))
    const safeEndLine = Math.max(safeStartLine, Math.min(chunk.endLine, lineCount))

    const range = isInsertion
      ? new this.monaco.Range(safeStartLine, 1, safeStartLine, 1)
      : new this.monaco.Range(safeStartLine, 1, safeEndLine, model.getLineMaxColumn(safeEndLine))

    let text = chunk.newLines.join('\n')
    if (isInsertion && chunk.startLine <= model.getLineCount()) {
      text += '\n'
    }

    this.editor.executeEdits('ai-suggestion', [
      {
        range,
        text,
        forceMoveMarkers: true
      }
    ])
  }

  private rejectSuggestion(id: string): void {
    const index = this.currentChunks.findIndex((c) => c.id === id)
    if (index === -1) return

    this.currentChunks.splice(index, 1)
    if (this.currentChunks.length === 0) {
      this.clear()
    } else {
      this.refreshUI()
    }
  }

  private refreshUI(): void {
    // Clear toolbars and zones, leave currentChunks metadata
    this.decorations = this.editor.deltaDecorations(this.decorations, [])
    this.toolbars.forEach((tb) => {
      if ((tb as any).widget) {
        this.editor.removeContentWidget((tb as any).widget)
      }
      tb.remove()
    })
    this.toolbars = []

    this.editor.changeViewZones((accessor: any) => {
      this.viewZones.forEach((id) => accessor.removeZone(id))
      this.viewZones = []
    })

    if (this.globalHeader) {
      const countEl = this.globalHeader.querySelector('.suggestion-global-header__count')
      if (countEl) {
        this.currentChunkIndex = Math.min(this.currentChunkIndex, this.currentChunks.length - 1)
        if (this.currentChunks.length > 0) {
          countEl.textContent = `${this.currentChunkIndex + 1} / ${this.currentChunks.length}`
        } else {
          this.clear()
        }
      }
    }

    this.renderSuggestions()
  }
}
