export interface SlashMenuItem {
  id: string
  label: string
  detail: string
  icon: string
  command: string
  prefix?: string
  wrapContent?: boolean
}

export const SLASH_COMMANDS: SlashMenuItem[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    detail: 'Big section heading',
    icon: '#',
    command: '# ',
    prefix: '#'
  },
  {
    id: 'h2',
    label: 'Heading 2',
    detail: 'Medium section heading',
    icon: '##',
    command: '## ',
    prefix: '##'
  },
  {
    id: 'h3',
    label: 'Heading 3',
    detail: 'Small section heading',
    icon: '###',
    command: '### ',
    prefix: '###'
  },
  {
    id: 'bullet',
    label: 'Bullet List',
    detail: 'Create a simple bulleted list',
    icon: '•',
    command: '* ',
    prefix: '*'
  },
  {
    id: 'number',
    label: 'Numbered List',
    detail: 'Create a list with numbering',
    icon: '1.',
    command: '1. ',
    prefix: '1.'
  },
  {
    id: 'dash',
    label: 'Dash List',
    detail: 'Create a dashed list',
    icon: '—',
    command: '- ',
    prefix: '-'
  },
  {
    id: 'code',
    label: 'Code Block',
    detail: 'Wrap in code block',
    icon: '</>',
    command: '```',
    prefix: '```',
    wrapContent: true
  },
  {
    id: 'bold',
    label: 'Bold',
    detail: 'Make text bold',
    icon: 'B',
    command: '**',
    prefix: '**',
    wrapContent: true
  },
  {
    id: 'italic',
    label: 'Italic',
    detail: 'Make text italic',
    icon: 'I',
    command: '*',
    prefix: '*',
    wrapContent: true
  }
]

import type * as monacoType from 'monaco-editor'

export class SlashMenu {
  private editor: monacoType.editor.IStandaloneCodeEditor
  private menuEl: HTMLElement | null = null
  private items: SlashMenuItem[] = SLASH_COMMANDS
  private selectedIndex = 0
  private isVisible = false
  private triggerPos: monacoType.Position | null = null

  constructor(editor: monacoType.editor.IStandaloneCodeEditor) {
    this.editor = editor
    this.attachEvents()
  }

  private attachEvents(): void {
    this.editor.onKeyDown((e) => {
      if (this.isVisible) {
        if (e.browserEvent.key === 'ArrowUp') {
          e.preventDefault()
          e.stopPropagation()
          this.moveSelection(-1)
          return
        }
        if (e.browserEvent.key === 'ArrowDown') {
          e.preventDefault()
          e.stopPropagation()
          this.moveSelection(1)
          return
        }
        if (e.browserEvent.key === 'Enter' || e.browserEvent.key === 'Tab') {
          e.preventDefault()
          e.stopPropagation()
          this.selectCurrent()
          return
        }
        if (e.browserEvent.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          this.hide()
          return
        }
      }

      // Trigger logic
      if (e.browserEvent.key === '/') {
        // Check if at start of line or after space
        const pos = this.editor.getPosition()
        if (pos) {
          const model = this.editor.getModel()
          if (model) {
            const lineContent = model.getLineContent(pos.lineNumber)
            const charBefore = pos.column > 1 ? lineContent[pos.column - 2] : null

            if (charBefore === null || charBefore === ' ') {
              setTimeout(() => this.show(pos), 10)
            }
          }
        }
      } else if (this.isVisible) {
        if (e.browserEvent.key === ' ') {
          this.hide()
        } else {
          setTimeout(() => this.updateFilter(), 10)
        }
      }
    })

    this.editor.onMouseDown(() => this.hide())
    this.editor.onDidScrollChange(() => this.hide())
    this.editor.onDidChangeCursorPosition((e) => {
      if (
        this.isVisible &&
        this.triggerPos &&
        e.position.lineNumber !== this.triggerPos.lineNumber
      ) {
        this.hide()
      }
    })
  }

  private show(pos: monacoType.Position): void {
    if (this.isVisible) return

    this.triggerPos = pos
    this.isVisible = true
    this.selectedIndex = 0
    this.renderMenu()
    this.positionMenu()
  }

  private hide(): void {
    if (!this.isVisible) return
    this.isVisible = false
    if (this.menuEl) {
      this.menuEl.remove()
      this.menuEl = null
    }
  }

  private renderMenu(): void {
    if (this.menuEl) this.menuEl.remove()

    this.menuEl = document.createElement('div')
    this.menuEl.className = 'hub-slash-menu'

    this.renderItems()
    document.body.appendChild(this.menuEl)
  }

  private renderItems(): void {
    if (!this.menuEl) return
    this.menuEl.innerHTML = ''

    const filtered = this.getFilteredItems()
    if (filtered.length === 0) {
      this.hide()
      return
    }

    filtered.forEach((item, index) => {
      const itemEl = document.createElement('div')
      itemEl.className = `hub-slash-menu__item ${index === this.selectedIndex ? 'is-selected' : ''}`
      itemEl.innerHTML = `
        <div class="hub-slash-menu__item-icon">${item.icon}</div>
        <div class="hub-slash-menu__item-content">
          <div class="hub-slash-menu__item-label">${item.label}</div>
          <div class="hub-slash-menu__item-detail">${item.detail}</div>
        </div>
      `
      itemEl.onclick = () => {
        this.selectedIndex = index
        this.selectCurrent()
      }
      this.menuEl!.appendChild(itemEl)
    })
  }

  private getFilteredItems(): SlashMenuItem[] {
    const query = this.getQuery()
    if (!query) return this.items
    return this.items.filter(
      (item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.id.toLowerCase().includes(query.toLowerCase())
    )
  }

  private getQuery(): string {
    if (!this.triggerPos) return ''
    const pos = this.editor.getPosition()
    if (!pos || pos.lineNumber !== this.triggerPos.lineNumber) return ''

    const model = this.editor.getModel()
    if (!model) return ''

    const line = model.getLineContent(pos.lineNumber)
    return line.substring(this.triggerPos.column - 1, pos.column - 1).replace('/', '')
  }

  private updateFilter(): void {
    if (!this.isVisible) return
    this.renderItems()
    // Reset selection if out of bounds
    const filteredCount = this.getFilteredItems().length
    if (this.selectedIndex >= filteredCount) {
      this.selectedIndex = Math.max(0, filteredCount - 1)
    }
    this.positionMenu()
  }

  private positionMenu(): void {
    if (!this.menuEl || !this.isVisible) return

    const pos = this.editor.getScrolledVisiblePosition(this.triggerPos!)
    if (!pos) return

    const editorEl = this.editor.getDomNode()
    if (!editorEl) return

    const rect = editorEl.getBoundingClientRect()
    const menuHeight = this.menuEl.offsetHeight || 200 // Fallback if not yet measured
    const topOffset = rect.top + pos.top
    const windowHeight = window.innerHeight

    // Smart positioning: Check if there's space below
    if (topOffset + 24 + menuHeight > windowHeight - 20) {
      // Position above
      this.menuEl.style.top = `${topOffset - menuHeight - 4}px`
    } else {
      // Position below
      this.menuEl.style.top = `${topOffset + 24}px`
    }
    this.menuEl.style.left = `${rect.left + pos.left}px`
  }

  private moveSelection(dir: number): void {
    const count = this.getFilteredItems().length
    if (count === 0) return

    this.selectedIndex = (this.selectedIndex + dir + count) % count
    this.renderItems()

    // Scroll selected item into view
    const selectedEl = this.menuEl?.querySelector('.is-selected') as HTMLElement
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' })
    }
  }

  private selectCurrent(): void {
    const filtered = this.getFilteredItems()
    const item = filtered[this.selectedIndex]
    if (!item) return

    const pos = this.editor.getPosition()
    if (!pos || !this.triggerPos) return

    const model = this.editor.getModel()
    if (!model) return

    const selection = this.editor.getSelection()
    const hasSelection = selection && !selection.isEmpty()

    if (item.wrapContent && hasSelection) {
      // Wrap the current selection
      const selectedText = model.getValueInRange(selection)
      let wrappedText = ''

      if (item.id === 'code') {
        wrappedText = `\`\`\`\n${selectedText}\n\`\`\``
      } else {
        wrappedText = `${item.command}${selectedText}${item.command}`
      }

      // First replace the '/' part if it exists (though usually / is typed while selection is active?
      // Actually usually you type / and then it filters.
      // If there was a selection when / was typed, we should use it.

      this.editor.executeEdits('slash-command', [
        {
          range: {
            startLineNumber: this.triggerPos.lineNumber,
            startColumn: this.triggerPos.column,
            endLineNumber: pos.lineNumber,
            endColumn: pos.column
          },
          text: '', // Kill the slash query
          forceMoveMarkers: true
        },
        {
          range: selection,
          text: wrappedText,
          forceMoveMarkers: true
        }
      ])
    } else {
      // Standard prefix logic
      this.editor.executeEdits('slash-command', [
        {
          range: {
            startLineNumber: this.triggerPos.lineNumber,
            startColumn: this.triggerPos.column,
            endLineNumber: pos.lineNumber,
            endColumn: pos.column
          },
          text: item.command,
          forceMoveMarkers: true
        }
      ])
    }

    this.hide()
    this.editor.focus()
  }
}
