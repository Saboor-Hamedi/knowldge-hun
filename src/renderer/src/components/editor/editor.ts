import 'monaco-editor/min/vs/editor/editor.main.css'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { state } from '../../core/state'
import { themes } from '../../core/themes'
import type { NotePayload, AppSettings } from '../../core/types'
import './editor.css'

type Monaco = any // Use any to bypass stubborn type resolution in dynamic imports

const globalScope = self as unknown as {
  MonacoEnvironment?: {
    getWorker: (moduleId: string, label: string) => Worker
  }
}

globalScope.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string): Worker {
    switch (label) {
      case 'json':
        return new jsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker()
      case 'typescript':
      case 'javascript':
        return new tsWorker()
      default:
        return new editorWorker()
    }
  }
}

export class EditorComponent {
  private container: HTMLElement
  private emptyState: HTMLElement
  private editorHost: HTMLElement
  private monacoInstance: Monaco | null = null
  private editor: Monaco['editor']['IStandaloneCodeEditor'] | null = null
  private pendingSave?: number
  private onContentChange?: () => void
  private onSave?: (payload: NotePayload) => void
  private onLinkClick?: (target: string) => void
  private onGetHoverContent?: (target: string) => Promise<string | null>
  private onContextMenu?: (e: MouseEvent) => void
  private decorations: string[] = []
  private providers: { dispose: () => void }[] = []
  private initPromise: Promise<void> | null = null
  private onTabClose?: () => void

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement
    this.render()
    this.emptyState = this.container.querySelector('.editor-empty') as HTMLElement
    this.editorHost = this.container.querySelector('.editor-host') as HTMLElement
  }

  setContentChangeHandler(handler: () => void): void {
    this.onContentChange = handler
  }

  setSaveHandler(handler: (payload: NotePayload) => void): void {
    this.onSave = handler
  }

  setLinkClickHandler(handler: (target: string) => void): void {
    this.onLinkClick = handler
  }

  setHoverContentHandler(handler: (target: string) => Promise<string | null>): void {
      this.onGetHoverContent = handler
  }

  setContextMenuHandler(handler: (e: MouseEvent) => void): void {
      this.onContextMenu = handler
  }

  setTabCloseHandler(handler: () => void): void {
      this.onTabClose = handler
  }

  setDropHandler(handler: (path: string, isFile: boolean) => void): void {
    const setupDropListener = (element: HTMLElement) => {
      element.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.container.classList.add('drag-over')
      })

      element.addEventListener('dragleave', (e) => {
        // Only remove class if leaving the editor container entirely
        if (e.target === this.container || !this.container.contains(e.relatedTarget as Node)) {
          this.container.classList.remove('drag-over')
        }
      })

      element.addEventListener('drop', async (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.container.classList.remove('drag-over')

        console.log('Drop detected on:', element.className)

        let filePath: string | null = null

        // Try files array first (most reliable in Electron)
        const files = e.dataTransfer?.files
        if (files && files.length > 0) {
          const file = files[0]
          filePath = (file as any).path
          console.log('Got path from files array:', filePath)
        }

        // If no path from files, try items (fallback)
        if (!filePath) {
          const items = e.dataTransfer?.items
          if (items && items.length > 0) {
            const item = items[0]
            const entry = (item as any).webkitGetAsEntry?.()
            if (entry) {
              filePath = (entry as any).fullPath || (entry as any).path
              console.log('Got path from items:', filePath)
            }
          }
        }

        // If coming from sidebar, we might have 'from-sidebar' data
        if (!filePath) {
             const sidebarPath = e.dataTransfer?.getData('text/plain')
             const fromSidebar = e.dataTransfer?.getData('from-sidebar')
             if (fromSidebar === 'true' && sidebarPath) {
                 // Sidebar notes are internal, handle them as "open" request
                 // But wait, the drop handler expects a file path to 'open' or 'import'.
                 // Let's pass it. Since it's internal, we might want to distinguish,
                 // but for now, treating it as a file path works if the path is absolute.
                 filePath = sidebarPath
                 console.log('Got path from sidebar drag:', filePath)
             }
        }

        if (filePath) {
          console.log('Calling handler with:', filePath)
          const isFile = /\.[^.]+$/.test(filePath)
          handler(filePath, isFile)
        } else {
          console.warn('No file path found in drop event')
        }
      })
    }

    // Listen on both empty state and editor host for drops
    setupDropListener(this.emptyState)
    setupDropListener(this.editorHost)
    setupDropListener(this.container)
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="editor-empty">Select or create a note to start writing</div>
      <div class="editor-host" aria-label="Note editor"></div>
    `
  }

  async loadNote(note: NotePayload): Promise<void> {
    state.applyingRemote = true
    await this.ensureEditor()
    
    console.log('%c[Editor] Vitals Check: LOADING NOTE', 'color: #00ff00; font-weight: bold; font-size: 14px;');

    if (this.editor && this.monacoInstance) {
        const model = this.editor.getModel()
        if (model) {
            // Force content first to avoid flickering if language change triggers re-render
            this.editor.setValue(note.content)
            
            const currentLang = model.getLanguageId()
            console.log(`[Editor] Language: "${currentLang}" -> FORCING "markdown"`)
            try {
                this.monacoInstance.editor.setModelLanguage(model, 'markdown')
            } catch (e) {
                console.warn('[Editor] Failed to set language to markdown', e)
            }
        }
    } else {
        this.editor?.setValue(note.content)
    }

    state.applyingRemote = false
    state.isDirty = false
    state.lastSavedAt = note.updatedAt
    this.emptyState.style.display = 'none'
    this.editorHost.style.display = 'block'
    this.updateDecorations()
  }

  showEmpty(): void {
    this.emptyState.style.display = 'flex'
    this.editorHost.style.display = 'none'
    if (this.editor) {
      state.applyingRemote = true
      this.editor.setValue('')
      state.applyingRemote = false
      state.isDirty = false
    }
  }

  getValue(): string {
    return this.editor?.getValue() ?? ''
  }

  focus(): void {
    this.editor?.focus()
  }

  private async ensureEditor(): Promise<void> {
    if (this.editor) return
    
    // Prevent race conditions if multiple calls happen before init completes
    if (this.initPromise) {
        return this.initPromise
    }

    this.initPromise = (async () => {
        try {
            console.log('%c[Editor] Vitals Check: STARTING UP', 'color: #00ff00; font-weight: bold; font-size: 14px;');
            const monaco = await this.loadMonaco()
            // Double check inside the lock
            if (this.editor) return

            this.editor = monaco.editor.create(this.editorHost, {
                value: '',
                language: 'markdown',
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: { enabled: false },
                wordWrap: 'on',
                fontSize: 14,
                padding: { top: 12, bottom: 12 },
                renderWhitespace: 'selection',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                fixedOverflowWidgets: false, // Keep widgets inside for better Electron consistency
                quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: false
                },
                inlineSuggest: {
                    enabled: true,
                    showToolbar: 'always'
                },
                suggest: {
                    snippetsPreventQuickSuggestions: false,
                    filterGraceful: true,
                    showIcons: true
                },
                hover: {
                    enabled: true,
                    delay: 300,
                    sticky: true
                }
            })

            this.editor.onDidChangeModelContent(() => {
                this.updateDecorations()
                if (state.applyingRemote) return
                this.markDirty()
            })
            
            this.registerHoverProvider()
            this.registerCompletionProvider()
            
            this.editor.onContextMenu((e) => {
                if (this.onContextMenu && e.event && e.event.browserEvent) {
                    e.event.preventDefault()
                    this.onContextMenu(e.event.browserEvent as MouseEvent)
                }
            })
            
            this.editor.onMouseDown((e) => {
                if (!e.target || !e.target.position) return
                
                // Allow clicking links without Ctrl if we want, but let's stick to Ctrl/Cmd for now
                if (e.event.ctrlKey || e.event.metaKey) {
                    const model = this.editor!.getModel()
                    if (!model) return
                    
                    const lineContent = model.getLineContent(e.target.position.lineNumber)
                    // Match [[target]] or [[target|alias]]
                    const regex = /\[\[(.*?)\]\]/g
                    let match
                    
                    while ((match = regex.exec(lineContent)) !== null) {
                        const startCol = match.index + 1
                        const endCol = match.index + match[0].length + 1
                        
                        // Check if mouse is within the [[...]] range
                        if (e.target.position.column >= startCol && e.target.position.column < endCol) {
                            const linkContent = match[1]
                            const [target] = linkContent.split('|')
                            console.log(`[Editor] Link clicked: "${target.trim()}"`)
                            this.onLinkClick?.(target.trim())
                            e.event.preventDefault()
                            e.event.stopPropagation()
                            return
                        }
                    }
                }
            })

            // Paste handler logic
            this.editorHost.addEventListener('paste', async (e: ClipboardEvent) => {
                 if (!this.editor) return
                 // ... paste logic relies on this.editor so it's safe now
                 const clipboardData = e.clipboardData
                 if (!clipboardData) return
                 
                 const items = clipboardData.items
                 for (let i = 0; i < items.length; i++) {
                     const item = items[i]
                     if (item.type.indexOf('image') !== -1) {
                         e.preventDefault()
                         const file = item.getAsFile()
                         if (!file) continue
                         
                         const buffer = await file.arrayBuffer()
                         const ext = file.name.split('.').pop() || 'png'
                         const name = `image-${Date.now()}.${ext}`
                         
                         try {
                             const savedPath = await window.api.saveAsset(buffer, name)
                             const position = this.editor.getPosition()
                             if (position) {
                                 this.editor.executeEdits('', [{
                                     range: new this.monacoInstance!.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                     text: `![${name}](${savedPath})`,
                                     forceMoveMarkers: true
                                 }])
                             }
                         } catch (err) {
                             console.error('Failed to save image', err)
                         }
                         return
                     }
                 }
            })

        } finally {
            this.initPromise = null
        }
    })()

    return this.initPromise
  }

  private updateDecorations(): void {
    if (!this.editor || !this.monacoInstance) return
    const model = this.editor.getModel()
    if (!model) return

    const text = model.getValue()
    const regex = /\[\[(.*?)\]\]/g
    const newDecorations: Monaco['editor']['IModelDeltaDecoration'][] = []
    
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
        const startPos = model.getPositionAt(match.index)
        const endPos = model.getPositionAt(match.index + match[0].length)
        
        newDecorations.push({
            range: new this.monacoInstance.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
            options: { inlineClassName: 'wiki-link' } 
        })
    }
    
    this.decorations = this.editor.deltaDecorations(this.decorations, newDecorations)
  }

  registerHoverProvider(): void {
      // Logic consolidated into registerCompletionProvider
  }

  registerCompletionProvider(): void {
      if (!this.monacoInstance) return;
      const monaco = this.monacoInstance;

      console.log('%c[Editor] Registering robust WikiLink providers...', 'color: #4daafc; font-weight: bold;');
      
      this.providers.forEach(p => p.dispose());
      this.providers = [];

      // Use a single provider registration for multiple languages
      const languages = ['markdown', 'plaintext']; 
      
      const hoverProvider = {
          provideHover: async (model: any, position: any) => {
              const lineContent = model.getLineContent(position.lineNumber);
              
              // This should appear in console whenever you hover near brackets
              if (lineContent.includes('[[')) {
                  console.log(`[Hover] Checking line ${position.lineNumber}: "${lineContent.trim()}"`);
              }

              const regex = /\[\[(.*?)\]\]/g;
              let match;
              while ((match = regex.exec(lineContent)) !== null) {
                  const start = match.index + 1;
                  const end = start + match[0].length;
                  if (position.column >= start && position.column < end) {
                      const linkContent = match[1];
                      const [target] = linkContent.split('|');
                      console.log(`[Hover] HIT on [[${target.trim()}]]`);

                      if (this.onGetHoverContent) {
                          const preview = await this.onGetHoverContent(target.trim());
                          const note = state.notes.find(n => n.id.toLowerCase() === target.trim().toLowerCase());
                          
                          return {
                              range: new monaco.Range(position.lineNumber, start, position.lineNumber, end),
                              contents: [
                                  { value: `### 📄 ${note?.title || target.trim()}`, isTrusted: true },
                                  { value: `---`, isTrusted: true },
                                  { value: preview || '*No content*', isTrusted: true },
                                  { value: `\n\n*Click with \`Ctrl/Cmd\` to jump*`, isTrusted: true }
                              ]
                          };
                      }
                  }
              }
              return null;
          }
      };

      const completionProvider = {
          triggerCharacters: ['['],
          provideCompletionItems: (model: any, position: any) => {
              const textUntilPosition = model.getValueInRange({
                  startLineNumber: position.lineNumber, startColumn: 1,
                  endLineNumber: position.lineNumber, endColumn: position.column
              });
              
              const match = /\[\[([^\]]*)$/.exec(textUntilPosition);
              if (!match) return { suggestions: [] };
              
              const partial = match[1].toLowerCase();
              console.log(`[Suggest] Triggered [[ autocomplete for "${partial}"`);
              
              const word = model.getWordUntilPosition(position);
              const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
              
              const suggestions = state.notes
                .filter(n => (n.title || n.id).toLowerCase().includes(partial))
                .map(note => ({
                    label: note.title || note.id,
                    kind: monaco.languages.CompletionItemKind.File,
                    insertText: (note.title || note.id) + ']]',
                    detail: note.path ? `📁 ${note.path}` : '',
                    range: range
                }));

              return { suggestions };
          }
      };

      const inlineProvider = {
          provideInlineCompletions: (model: any, position: any) => {
              const textUntilPosition = model.getValueInRange({
                  startLineNumber: position.lineNumber, startColumn: 1,
                  endLineNumber: position.lineNumber, endColumn: position.column
              });
              
              const lastTwo = textUntilPosition.slice(-2);
              if (lastTwo !== '[[' && textUntilPosition.includes('[[')) {
                  const match = /\[\[([^\]]*)$/.exec(textUntilPosition);
                  if (match) {
                      const partial = match[1].toLowerCase();
                      if (partial) {
                          const bestMatch = state.notes.find(n => (n.title || n.id).toLowerCase().startsWith(partial));
                          if (bestMatch) {
                              const text = (bestMatch.title || bestMatch.id).substring(partial.length) + ']]';
                              return {
                                  items: [{
                                      insertText: text,
                                      range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column)
                                  }]
                              };
                          }
                      }
                  }
              }
              return { items: [] };
          },
          freeInlineCompletions: () => {}
      };

      languages.forEach(lang => {
          this.providers.push(monaco.languages.registerHoverProvider(lang, hoverProvider));
          this.providers.push(monaco.languages.registerCompletionItemProvider(lang, completionProvider));
          this.providers.push(monaco.languages.registerInlineCompletionsProvider(lang, inlineProvider));
      });
      
      // Also register for universal catch-all
      this.providers.push(monaco.languages.registerHoverProvider('*', hoverProvider));
      this.providers.push(monaco.languages.registerCompletionItemProvider('*', completionProvider));

      console.log(`[Editor] Successfully registered providers for ${languages.join(', ')} and "*"`);
  }

  private markDirty(): void {
    state.isDirty = true
    this.onContentChange?.()
    this.scheduleSave()
  }

  private scheduleSave(): void {
    if (!state.activeId || !this.editor) return
    if (this.pendingSave) window.clearTimeout(this.pendingSave)
    const delay = state.settings?.autoSaveDelay || 800
    this.pendingSave = window.setTimeout(() => this.triggerSave(), delay)
  }

  private triggerSave(): void {
    if (!state.activeId || !this.editor || !this.onSave) return
    
    const content = this.editor.getValue()
    const note = state.notes.find((n) => n.id === state.activeId)
    const title = note?.title || state.projectName

    const payload: NotePayload = {
      id: state.activeId,
      title,
      content,
      updatedAt: state.lastSavedAt,
      path: note?.path
    }

    this.onSave(payload)
  }

  manualSave(): void {
    if (this.pendingSave) {
      window.clearTimeout(this.pendingSave)
      this.pendingSave = undefined
    }
    this.triggerSave()
  }

  private async loadMonaco(): Promise<Monaco> {
    if (this.monacoInstance) return this.monacoInstance
    const mod = (await import('monaco-editor/esm/vs/editor/editor.api')) as Monaco
    this.monacoInstance = mod
    return mod
  }

  attachKeyboardShortcuts(): void {
    window.addEventListener('keydown', (event) => {
      const isMod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (isMod && key === 's') {
        event.preventDefault()
        this.manualSave()
      } else if (isMod && key === 'w') {
        event.preventDefault()
        this.onTabClose?.()
      }
    })
  }

  applySettings(settings: AppSettings): void {
    if (!this.editor) return

    const options: any = {}
    
    if (settings.fontSize) {
      options.fontSize = settings.fontSize
    }
    
    if (settings.lineNumbers !== undefined) {
      options.lineNumbers = settings.lineNumbers ? 'on' : 'off'
    }
    
    if (settings.wordWrap !== undefined) {
      options.wordWrap = settings.wordWrap ? 'on' : 'off'
    }
    
    if (settings.minimap !== undefined) {
      options.minimap = { enabled: settings.minimap }
    }
    
    // Apply Theme
    if (settings.theme) {
        console.log('Applying theme:', settings.theme)
        const theme = themes[settings.theme]
        if (theme) {
             const isLight = settings.theme === 'light' || settings.theme === 'github-light'
             const base = isLight ? 'vs' : 'vs-dark'
             
             // Use a unique name for the theme to ensure Monaco registers it as a switch
             // If we reuse the name, Monaco might optimizations skip the update if it thinks current theme is the same
             const monacoThemeId = `app-theme-${settings.theme}`

             this.monacoInstance?.editor.defineTheme(monacoThemeId, {
                 base: base,
                 inherit: true,
                 rules: [],
                 colors: {
                     'editor.background': theme.colors['--bg'],
                     'editor.foreground': theme.colors['--text'],
                     'editor.lineHighlightBackground': theme.colors['--hover'],
                     'editor.selectionBackground': theme.colors['--selection'],
                     'editorCursor.foreground': theme.colors['--primary'],
                     'editorLineNumber.foreground': theme.colors['--muted'],
                     'editorIndentGuide.background': theme.colors['--border-subtle'],
                     'editorIndentGuide.activeBackground': theme.colors['--border'],
                     'editorWidget.background': theme.colors['--panel-strong'],
                     'editorWidget.border': theme.colors['--border'],
                     'list.activeSelectionBackground': theme.colors['--selection'],
                     'list.hoverBackground': theme.colors['--hover']
                 }
             })
             this.monacoInstance?.editor.setTheme(monacoThemeId)
        } else {
             // Fallback to light/dark if custom theme not found or invalid
             switch (settings.theme) {
                case 'light':
                case 'github-light':
                    this.monacoInstance?.editor.setTheme('vs')
                    break
                default:
                    this.monacoInstance?.editor.setTheme('vs-dark')
                    break
             }
        }
    } else {
        // Default fallback
        this.monacoInstance?.editor.setTheme('vs-dark')
    }

    this.editor.updateOptions(options)
  }
}


