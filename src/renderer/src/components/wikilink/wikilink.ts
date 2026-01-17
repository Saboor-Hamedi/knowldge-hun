import { state } from '../../core/state'

export function registerWikiLinkProviders(monaco: any, getNotePreview: (id: string) => Promise<string | null>): { dispose: () => void }[] {
  const disposables: { dispose: () => void }[] = []

  // 1. Hover Provider
  const hoverProvider = {
    provideHover: async (model: any, position: any) => {
      try {
        const lineContent = model.getLineContent(position.lineNumber)
        if (!lineContent.includes('[[')) return null

        const regex = /\[\[(.*?)\]\]/g
        let match: RegExpExecArray | null
        while ((match = regex.exec(lineContent)) !== null) {
          const startCol = match.index + 1
          const endCol = match.index + match[0].length + 1

          if (position.column >= startCol && position.column <= endCol) {
             const content = match[1]
             const [target] = content.split('|')
             const cleanTarget = target.trim()

             console.log(`[WikiLink] Hover match: "${cleanTarget}"`)

             const note = state.notes.find(n =>
                n.id.toLowerCase() === cleanTarget.toLowerCase() ||
                (n.title && n.title.toLowerCase() === cleanTarget.toLowerCase()) ||
                (n.path && `${n.path}/${n.id}`.toLowerCase() === cleanTarget.toLowerCase())
             )

             const preview = await getNotePreview(cleanTarget)

             // Format preview with better styling
             const noteTitle = note ? (note.title || note.id) : cleanTarget
             const previewText = preview || (note ? 'Note is empty' : 'Note not found')

             // Clean and format preview text
             let formattedPreview = previewText
               .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
               .replace(/^#+\s+/gm, '') // Remove markdown headers
               .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
               .replace(/\*(.*?)\*/g, '$1') // Remove italic
               .replace(/`(.*?)`/g, '$1') // Remove inline code
               .replace(/\[\[(.*?)\]\]/g, '$1') // Remove wiki links
               .trim()

             // Limit length and add ellipsis
             const maxLength = 250
             if (formattedPreview.length > maxLength) {
               formattedPreview = formattedPreview.substring(0, maxLength).trim() + '...'
             }

             // Split into lines and limit to 8 lines
             const lines = formattedPreview.split('\n')
             const previewLines = lines.slice(0, 8).join('\n')

             return {
               range: new monaco.Range(position.lineNumber, startCol, position.lineNumber, endCol),
               contents: [
                 {
                   value: `**${noteTitle}**`,
                   isTrusted: true
                 },
                 {
                   value: `\`\`\`\n${previewLines}\n\`\`\``,
                   isTrusted: true
                 },
                 {
                   value: `*Ctrl+Click to open*`,
                   isTrusted: true
                 }
               ]
             }
          }
        }
        return null
      } catch (err) {
        console.error('[WikiLink] Hover Error:', err)
        return null
      }
    }
  }

  // 2. Completion Provider (Autocomplete)
  const completionProvider = {
    triggerCharacters: ['['],
    provideCompletionItems: (model: any, position: any) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      })

      const match = /\[\[([^\]]*)$/.exec(textUntilPosition)
      if (!match) return { suggestions: [] }

      const search = match[1].toLowerCase()

      const textAfterPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column + 2
      })
      const hasClosing = textAfterPosition.startsWith(']]')

      const startCol = match.index + 3
      const endCol = position.column
      const range = new monaco.Range(position.lineNumber, startCol, position.lineNumber, endCol)

      let suggestions = state.notes
        .filter(n => (n.title || n.id).toLowerCase().includes(search))
        .map(n => {
          const name = n.title || n.id
          return {
            label: name,
            kind: monaco.languages.CompletionItemKind.File,
            insertText: hasClosing ? name : name + ']]',
            detail: n.path || '',
            documentation: 'WikiLink',
            range: range,
            filterText: name,
            sortText: '1-' + name
          }
        })

       if (search.trim().length > 0) {
           const createLabel = `Create "${match[1]}"`
           if (!suggestions.find(s => s.label === match[1])) {
               suggestions.push({
                   label: createLabel,
                   kind: monaco.languages.CompletionItemKind.Constructor,
                   insertText: hasClosing ? match[1] : match[1] + ']]',
                   detail: 'New Note',
                   documentation: 'Link to a non-existent note',
                   range: range,
                   sortText: '0-' + match[1],
                   filterText: match[1]
               })
           }
       } else if (suggestions.length === 0) {
           suggestions.push({
               label: 'No notes found',
               kind: monaco.languages.CompletionItemKind.Text,
               insertText: '',
               detail: 'Vault is empty',
               range: range,
               documentation: 'Add notes to your vault to see them here',
               filterText: 'no notes',
               sortText: '9-empty'
           })
       }

      return { suggestions }
    }
  }

  // 3. Inline Provider (Ghost Text)
  const inlineProvider = {
    provideInlineCompletions: (model: any, position: any) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      })

      if (textUntilPosition.includes('[[')) {
          const match = /\[\[([^\]]*)$/.exec(textUntilPosition)
          if (match) {
              const partial = match[1].toLowerCase()
              if (partial) {
                  const bestMatch = state.notes.find(n => (n.title || n.id).toLowerCase().startsWith(partial))
                  if (bestMatch) {
                       const name = bestMatch.title || bestMatch.id
                       const text = name + ']]'
                       return {
                           items: [{
                               insertText: text,
                               range: new monaco.Range(
                                   position.lineNumber,
                                   position.column - partial.length,
                                   position.lineNumber,
                                   position.column
                               )
                           }]
                       }
                  }
              }
          }
      }
      return { items: [] }
    },
    freeInlineCompletions: () => {}
  }

  // Register ONCE for all languages via wildcard '*'
  // This prevents the "Duplicate" pop-ups where the same info appears multiple times.
  disposables.push(monaco.languages.registerHoverProvider('*', hoverProvider))
  disposables.push(monaco.languages.registerCompletionItemProvider('*', completionProvider))
  disposables.push(monaco.languages.registerInlineCompletionsProvider('*', inlineProvider))

  return disposables
}
