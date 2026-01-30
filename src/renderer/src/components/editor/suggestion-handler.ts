import { diffLines, groupDiffChanges, DiffChunk } from '../../utils/diff'
import './suggestion-styles.css'
import { codicons } from '../../utils/codicons'

export class SuggestionManager {
  private editor: any
  private monaco: any
  private decorations: string[] = []
  private currentChunks: DiffChunk[] = []
  private toolbars: HTMLElement[] = []
  private viewZones: string[] = []

  constructor(editor: any, monaco: any) {
    this.editor = editor
    this.monaco = monaco
  }

  public propose(newContent: string): void {
    const oldContent = this.editor.getValue()
    const changes = diffLines(oldContent, newContent)
    this.currentChunks = groupDiffChanges(changes).filter((c) => c.type === 'change')

    this.clear()
    this.renderSuggestions()
  }

  public clear(): void {
    this.decorations = this.editor.deltaDecorations(this.decorations, [])
    this.toolbars.forEach((tb) => tb.remove())
    this.toolbars = []

    this.editor.changeViewZones((accessor: any) => {
      this.viewZones.forEach((id) => accessor.removeZone(id))
      this.viewZones = []
    })
  }

  private renderSuggestions(): void {
    const newDecorations: any[] = []

    this.currentChunks.forEach((chunk, index) => {
      // 1. Highlight removed lines
      if (chunk.originalLines.length > 0) {
        newDecorations.push({
          range: new this.monaco.Range(chunk.startLine, 1, chunk.endLine, 1000),
          options: {
            isWholeLine: true,
            className: 'suggestion-highlight-removed',
            marginClassName: 'suggestion-margin-removed'
          }
        })
      }

      // 2. Add Toolbar for this chunk
      this.addToolbar(chunk, index)

      // 3. Show "Added" content as an overlay or ViewZone?
      // For a "beautiful" experience, let's use a ViewZone to show what would be added
      if (chunk.newLines.length > 0) {
        this.addViewZone(chunk)
      }
    })

    this.decorations = this.editor.deltaDecorations(this.decorations, newDecorations)
  }

  private addToolbar(chunk: DiffChunk, index: number): void {
    const toolbar = document.createElement('div')
    toolbar.className = 'suggestion-toolbar'

    const acceptBtn = document.createElement('button')
    acceptBtn.className = 'suggestion-toolbar__btn suggestion-toolbar__btn--accept'
    acceptBtn.title = 'Accept'
    acceptBtn.innerHTML = codicons.check || '✓'
    acceptBtn.onclick = () => this.acceptSuggestion(index)

    const rejectBtn = document.createElement('button')
    rejectBtn.className = 'suggestion-toolbar__btn suggestion-toolbar__btn--reject'
    rejectBtn.title = 'Reject'
    rejectBtn.innerHTML = codicons.close || '✗'
    rejectBtn.onclick = () => this.rejectSuggestion(index)

    toolbar.appendChild(acceptBtn)
    toolbar.appendChild(rejectBtn)

    // Position it at the end of the chunk
    const widget = {
      getDomNode: () => toolbar,
      getId: () => `suggestion-toolbar-${index}`,
      getPosition: () => ({
        position: { lineNumber: chunk.startLine, column: 1 },
        preference: [1] // Above
      })
    }

    this.editor.addContentWidget(widget)
    this.toolbars.push(toolbar)
    ;(toolbar as any).widget = widget
  }

  private addViewZone(chunk: DiffChunk): void {
    this.editor.changeViewZones((accessor: any) => {
      const domNode = document.createElement('div')
      domNode.className = 'suggestion-view-zone'
      domNode.style.paddingLeft = '50px' // Offset for line numbers

      chunk.newLines.forEach((line) => {
        const lineEl = document.createElement('div')
        lineEl.className = 'suggestion-highlight-added'
        lineEl.style.padding = '0 8px'
        lineEl.textContent = line || ' ' // spacer
        domNode.appendChild(lineEl)
      })

      const zoneId = accessor.addZone({
        afterLineNumber: chunk.endLine,
        heightInLines: chunk.newLines.length,
        domNode: domNode
      })
      this.viewZones.push(zoneId)
    })
  }

  private acceptSuggestion(index: number): void {
    const chunk = this.currentChunks[index]
    const model = this.editor.getModel()
    if (!model) return

    // Apply the change: Replace originalLines with newLines
    const range = new this.monaco.Range(
      chunk.startLine,
      1,
      chunk.endLine,
      model.getLineMaxColumn(chunk.endLine)
    )

    this.editor.executeEdits('ai-suggestion', [
      {
        range,
        text: chunk.newLines.join('\n'),
        forceMoveMarkers: true
      }
    ])

    // Refresh remaining suggestions as line numbers might have changed
    this.recalculateAndRefresh()
  }

  private rejectSuggestion(index: number): void {
    this.currentChunks.splice(index, 1)
    this.refreshUI()
  }

  private recalculateAndRefresh(): void {
    // Current simple approach: clear all decor and toolbars, and wait for next AI update or re-propose
    // Better: If we have the full "target" content from AI, we can re-diff.
    // For now, let's keep it clean since it's streaming.
    this.clear()
  }

  private refreshUI(): void {
    const oldToolbars = [...this.toolbars]
    oldToolbars.forEach((tb) => {
      this.editor.removeContentWidget((tb as any).widget)
    })
    this.toolbars = []

    this.editor.changeViewZones((accessor: any) => {
      this.viewZones.forEach((id) => accessor.removeZone(id))
      this.viewZones = []
    })

    this.renderSuggestions()
  }
}
