import 'monaco-editor/min/vs/editor/editor.main.css'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { state } from '../../core/state'
import { themes } from '../../core/themes'
import type { NotePayload, AppSettings } from '../../core/types'
import { registerWikiLinkProviders } from '../wikilink/wikilink'
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
  private listenerAttached: boolean = false
  private shortcutsAttached: boolean = false
  private onSave?: (payload: NotePayload) => void
  private onLinkClick?: (target: string) => void
  private onGetHoverContent?: (target: string) => Promise<string | null>
  private onContextMenu?: (e: MouseEvent) => void
  private decorations: string[] = []
  private providers: { dispose: () => void }[] = []
  private initPromise: Promise<void> | null = null
  private onTabClose?: () => void
  private hashtagDecorations: string[] = []

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
          console.log('Detected file path:', filePath)
          const ext = filePath.split('.').pop()?.toLowerCase() || ''
          const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
          
          if (isImage) {
              // Handle image drop directly
              const files = e.dataTransfer?.files
              let file: File | null = null
              
              if (files && files.length > 0) {
                  file = files[0]
              } else {
                  // If we only have path (e.g. from sidebar), we can't easily read it as blob in renderer without node integration?
                  // Actually, "preload" exposes specific APIs.
                  // We don't have "readFile".
                  // But if it's external drag, we have 'files'.
                  // If it's internal sidebar drag, it's not a new asset, just a link?
                  // If dragging image FROM sidebar to editor?
                  // Sidebar currently doesn't show images.
                  // So likely external drop.
              }

              if (file) {
                  try {
                      const buffer = await file.arrayBuffer()
                      const name = file.name // or `image-${Date.now()}.${ext}`
                      const savedPath = await window.api.saveAsset(buffer, name)
                      
                      // Calculate drop position
                      // Monaco doesn't use standard caretRange easily.
                      // We can use editor.getTargetAtClientPoint
                      
                      const target = this.editor?.getTargetAtClientPoint({ x: e.clientX, y: e.clientY })
                      if (target && target.position) {
                          this.editor!.executeEdits('', [{
                              range: new this.monacoInstance!.Range(target.position.lineNumber, target.position.column, target.position.lineNumber, target.position.column),
                              text: `![${name}](${savedPath})`,
                              forceMoveMarkers: true
                          }])
                      } else {
                          // Fallback to cursor
                          const pos = this.editor?.getPosition()
                          if (pos) {
                               this.editor!.executeEdits('', [{
                                  range: new this.monacoInstance!.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                                  text: `![${name}](${savedPath})`,
                                  forceMoveMarkers: true
                              }])
                          }
                      }
                  } catch (err) {
                      console.error('Failed to save dropped image', err)
                  }
                  return
              }
          }
          
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

  public async loadNote(payload: NotePayload): Promise<void> {
    console.log(`[Editor] Vitals Check: LOADING NOTE`, { id: payload.id })
    state.applyingRemote = true
    await this.ensureEditor()
    
    // Ensure keyboard shortcuts are attached after editor is ready
    this.attachKeyboardShortcuts()
    
    if (!this.editor) {
        state.applyingRemote = false
        return
    }

    const model = this.editor.getModel()
    if (!model) {
        state.applyingRemote = false
        return
    }

    // Fresh Providers check
    this.reRegisterProviders()

    const currentContent = model.getValue()
    if (currentContent !== payload.content) {
        this.editor.setValue(payload.content)
    }
    
    const prevLang = model.getLanguageId()
    try {
        this.monacoInstance!.editor.setModelLanguage(model, 'markdown')
        console.log(`[Editor] Language transition: "${prevLang}" -> "${model.getLanguageId()}"`)
    } catch (e) {
        console.warn('[Editor] Failed to set language', e)
    }

    state.applyingRemote = false
    state.isDirty = false
    state.lastSavedAt = payload.updatedAt || Date.now()
    
    this.emptyState.style.display = 'none'
    this.editorHost.style.display = 'block'
    this.updateDecorations()
    this.updateHashtagDecorations()
  }

  private reRegisterProviders(): void {
    if (!this.monacoInstance || !this.onGetHoverContent) return
    
    console.log('[Editor] Refreshing WikiLink providers for fresh note load...')
    this.providers.forEach(p => p.dispose())
    this.providers = []
    
    try {
        const wikilinkProviders = registerWikiLinkProviders(this.monacoInstance, this.onGetHoverContent)
        this.providers.push(...wikilinkProviders)
    } catch (err) {
        console.error('[Editor] Refresh failure:', err)
    }
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

  layout(): void {
    if (this.editor) {
      const width = this.container.clientWidth
      // Auto-hide minimap on narrow screens to prevent overlap
      this.editor.updateOptions({
        minimap: { enabled: width > 600 && (state.settings?.minimap ?? true) }
      })
      this.editor.layout()
    }
  }

  insertAtCursor(text: string): void {
      if (!this.editor || !this.monacoInstance) return
      const selection = this.editor.getSelection()
      if (!selection) return

      this.editor.executeEdits('keyboard', [
          {
              range: selection,
              text,
              forceMoveMarkers: true
          }
      ])
  }

  triggerAction(actionId: string): void {
      this.editor?.trigger('context-menu', actionId, null)
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
                glyphMargin: false, // Ensure no extra icons in the gutter
                folding: false,     // Disable the "checkbox" symbols for folding
                scrollBeyondLastLine: false,
                fixedOverflowWidgets: true,
                breadcrumbs: { enabled: false }, // Remove the "meta header" path breadcrumbs
                quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: true
                },
                inlineSuggest: {
                    enabled: false // Disable the grey ghost text layer that sits behind typing
                },
                stickyScroll: { enabled: false },
                suggest: {
                    snippetsPreventQuickSuggestions: false,
                    filterGraceful: true,
                    showIcons: false,   // Remove icons for a cleaner look
                    showDetails: false, // Remove the "layer on top" detail/documentation window
                    maxVisibleSuggestions: 6
                },
                hover: {
                    enabled: true,
                    delay: 300,
                    sticky: true
                },
                contextmenu: false // Disable Monaco's native menu
            })

            this.editor.onDidChangeModelContent(() => {
                this.updateDecorations()
                this.updateHashtagDecorations()
                if (state.applyingRemote) return
                this.markDirty()
            })
            
            // Register WikiLink Providers
            console.log('[Editor] Attempting to register WikiLink providers...', { 
                hasMonaco: !!this.monacoInstance, 
                hasHoverHandler: !!this.onGetHoverContent 
            })
            
            try {
                if (this.onGetHoverContent && this.monacoInstance) {
                     const wikilinkProviders = registerWikiLinkProviders(this.monacoInstance, this.onGetHoverContent)
                     this.providers.push(...wikilinkProviders)
                     console.log('[Editor] WikiLink providers registered successfully.')
                } else {
                    console.warn('[Editor] SKIPPING WikiLink registration. Missing dependencies.')
                }
            } catch (err) {
                console.error('[Editor] Failed to register WikiLink providers:', err)
            }

            // Register custom hashtag syntax highlighting
            try {
                this.registerHashtagHighlighting()
                console.log('[Editor] Hashtag highlighting registered successfully.')
            } catch (err) {
                console.error('[Editor] Failed to register hashtag highlighting:', err)
            }
            
            this.editorHost.addEventListener('contextmenu', (e) => {
                if (this.onContextMenu) {
                    e.preventDefault()
                    e.stopPropagation()
                    this.onContextMenu(e)
                }
            })
            
            this.editor.onMouseDown((e) => {
                // ... same as before
                if (!e.target || !e.target.position) return
                
                if (e.event.ctrlKey || e.event.metaKey) {
                    const model = this.editor!.getModel()
                    if (!model) return
                    
                    const lineContent = model.getLineContent(e.target.position.lineNumber)
                    const regex = /\[\[(.*?)\]\]/g
                    let match
                    
                    while ((match = regex.exec(lineContent)) !== null) {
                        const startCol = match.index + 1
                        const endCol = match.index + match[0].length + 1
                        
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

            // ... (paste handler)
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

  // Old provider methods removed (logic moved to wikilink.ts)

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
    console.log('[Editor] Triggering Save...', { activeId: state.activeId, hasEditor: !!this.editor, hasHandler: !!this.onSave })
    if (!state.activeId || !this.editor || !this.onSave) {
        console.warn('[Editor] Save aborted: Missing requirements')
        return
    }
    
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
    console.log('[Editor] Manual Save Requested')
    if (this.pendingSave) {
      window.clearTimeout(this.pendingSave)
      this.pendingSave = undefined
    }
    this.triggerSave()
  }

  private async loadMonaco(): Promise<Monaco> {
    if (this.monacoInstance) return this.monacoInstance
    // Import full monaco to get all language features (Markdown, etc)
    const mod = (await import('monaco-editor')) as any
    this.monacoInstance = mod
    return mod
  }

  attachKeyboardShortcuts(): void {
    if (!this.listenerAttached) {
      window.addEventListener('keydown', this.handleKeyDown.bind(this))
      this.listenerAttached = true
    }

    // Override Ctrl+D to delete active note instead of Monaco's default
    if (this.editor && !this.shortcutsAttached) {
      this.editor.addCommand(this.monacoInstance.KeyMod.CtrlCmd | this.monacoInstance.KeyCode.KeyD, () => {
        window.dispatchEvent(new CustomEvent('delete-active-note'))
      })
      this.shortcutsAttached = true
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const isMod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()

    if (isMod && key === 's') {
      event.preventDefault()
      this.manualSave()
    } else if (isMod && key === 'w') {
      event.preventDefault()
      this.onTabClose?.()
    }
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

  private registerHashtagHighlighting(): void {
    if (!this.monacoInstance) return

    // Use a decoration-based approach for hashtag highlighting
    // This will be more reliable than trying to extend the tokenizer
    this.updateHashtagDecorations()
  }

  private updateHashtagDecorations(): void {
    if (!this.editor || !this.monacoInstance) return

    const model = this.editor.getModel()
    if (!model) return

    const content = model.getValue()
    const lines = content.split('\n')
    const decorations: any[] = []

    lines.forEach((line, lineIndex) => {
      // Find all hashtags in the line
      const hashtagRegex = /#\w+/g
      let match
      while ((match = hashtagRegex.exec(line)) !== null) {
        const startColumn = match.index + 1 // Monaco is 1-based
        const endColumn = match.index + match[0].length + 1

        decorations.push({
          range: new this.monacoInstance!.Range(lineIndex + 1, startColumn, lineIndex + 1, endColumn),
          options: {
            inlineClassName: 'hashtag-highlight',
            stickiness: this.monacoInstance!.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        })
      }
    })

    // Apply decorations
    this.hashtagDecorations = this.editor.deltaDecorations(this.hashtagDecorations || [], decorations)
  }
}


