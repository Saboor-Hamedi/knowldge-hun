import { aiService } from '../../services/aiService'
import { state } from '../../core/state'

export interface ToolbarAction {
  id: string
  icon: string
  label: string
  apply: (editor: any) => void | Promise<void>
  s?: string
}

export class SelectionToolbar {
  private editor: any
  private toolbarEl: HTMLElement | null = null
  private statsEl: HTMLElement | null = null
  private dropdownEl: HTMLElement | null = null
  private dropdownIndex = -1
  private isVisible = false
  private isProcessing = false
  private currentAudio: HTMLAudioElement | null = null

  constructor(editor: monacoType.editor.IStandaloneCodeEditor) {
    this.editor = editor
    this.attachEvents()
  }

  private attachEvents(): void {
    this.editor.onDidChangeCursorSelection(() => {
      this.handleSelectionChange()
    })

    this.editor.onMouseDown(() => {
      this.hide()
      this.closeDropdown()
    })

    this.editor.onDidScrollChange(() => {
      this.hide()
      this.closeDropdown()
    })

    this.editor.onKeyDown((e) => {
      if (this.dropdownEl) {
        if (e.keyCode === 18 /* ArrowDown */) {
          this.navigateDropdown(1)
          e.preventDefault()
          e.stopPropagation()
          return
        }
        if (e.keyCode === 16 /* ArrowUp */) {
          this.navigateDropdown(-1)
          e.preventDefault()
          e.stopPropagation()
          return
        }
        if (e.keyCode === 3 /* Enter */) {
          const active = this.dropdownEl.querySelector('.is-hovered') as HTMLElement
          if (active) active.click()
          return
        }
      }

      // Escape or any key except modifiers should hide it
      if (e.keyCode === 1 /* Escape */) {
        this.hide()
        this.closeDropdown()
        return
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && !this.isProcessing) {
        this.hide()
        this.closeDropdown()
      }
    })

    // Close dropdown on click outside
    document.addEventListener('mousedown', (e) => {
      if (
        this.dropdownEl &&
        !this.dropdownEl.contains(e.target as Node) &&
        this.toolbarEl &&
        !this.toolbarEl.contains(e.target as Node)
      ) {
        this.closeDropdown()
      }
    })
  }

  private handleSelectionChange(): void {
    if (this.isProcessing) return
    const selection = this.editor.getSelection()
    if (!selection || selection.isEmpty()) {
      this.hide()
      this.closeDropdown()
      return
    }

    // Delay slightly to ensure mouse is up and positioning is stable
    setTimeout(() => {
      const finalSelection = this.editor.getSelection()
      if (finalSelection && !finalSelection.isEmpty()) {
        const model = this.editor.getModel()
        if (model) {
          this.show()
        }
      }
    }, 150)
  }

  private show(): void {
    if (!this.toolbarEl) {
      this.render()
    }
    this.isVisible = true
    this.toolbarEl!.style.display = 'flex'
    // Delay slightly to trigger CSS transition
    setTimeout(() => {
      this.toolbarEl?.classList.remove('is-hidden')
    }, 10)
    this.updateStats()
    this.positionToolbar()
  }

  private hide(): void {
    if (!this.isVisible) return
    this.isVisible = false
    this.closeDropdown() // Always close dropdown on hide
    if (this.toolbarEl) {
      this.toolbarEl.classList.add('is-hidden')
      setTimeout(() => {
        if (!this.isVisible && this.toolbarEl) {
          this.toolbarEl.style.display = 'none'
        }
      }, 150)
    }
  }

  private render(): void {
    this.toolbarEl = document.createElement('div')
    this.toolbarEl.className = 'hub-selection-toolbar is-hidden'

    // Stats Bar
    this.statsEl = document.createElement('div')
    this.statsEl.className = 'hub-selection-toolbar__stats'
    this.toolbarEl.appendChild(this.statsEl)

    const mainContainer = document.createElement('div')
    mainContainer.className = 'hub-selection-toolbar__main'

    // AI Button
    const aiBtn = this.createButton({
      id: 'ai-trigger',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
      label: 'AI Actions',
      apply: () => this.toggleDropdown('ai')
    })
    aiBtn.classList.add('is-ai')
    mainContainer.appendChild(aiBtn)

    this.addDivider(mainContainer)

    // Essential formatting
    mainContainer.appendChild(
      this.createButton({
        id: 'bold',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 12a4 4 0 0 0 0-8H6v8"/><path d="M15 20a4 4 0 0 0 0-8H6v8h9Z"/></svg>',
        label: 'Bold',
        apply: (ed) => this.toggleWrap(ed, '**')
      })
    )

    mainContainer.appendChild(
      this.createButton({
        id: 'italic',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
        label: 'Italic',
        apply: (ed) => this.toggleWrap(ed, '*')
      })
    )

    mainContainer.appendChild(
      this.createButton({
        id: 'highlight',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>',
        label: 'Highlight',
        apply: (ed) => this.wrapWith(ed, '<mark>', '</mark>')
      })
    )

    this.addDivider(mainContainer)

    // Read Aloud (Quick Access)
    mainContainer.appendChild(
      this.createButton({
        id: 'read-aloud',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
        label: 'Read Aloud',
        apply: (ed) => {
          const sel = ed.getSelection()
          if (!sel) return
          const txt = ed.getModel()?.getValueInRange(sel)
          if (txt) {
            this.stopSpeech()

            if (state.settings?.ttsVoice?.startsWith('openai:')) {
              this.readAloudOpenAI(txt, state.settings.ttsVoice.split(':')[1])
              return
            }

            const utterance = new SpeechSynthesisUtterance(txt)
            if (state.settings) {
              if (state.settings.ttsVoice) {
                const voice = window.speechSynthesis
                  .getVoices()
                  .find((v) => v.voiceURI === state.settings.ttsVoice)
                if (voice) utterance.voice = voice
              }
              if (state.settings.ttsSpeed) {
                utterance.rate = state.settings.ttsSpeed
              }
            }
            window.speechSynthesis.speak(utterance)
          }
          this.hide()
        }
      })
    )

    // Stop Reading button
    mainContainer.appendChild(
      this.createButton({
        id: 'stop-tts',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
        label: 'Stop Reading',
        apply: () => {
          this.stopSpeech()
          this.hide()
        }
      })
    )

    this.addDivider(mainContainer)

    // More Button
    const moreBtn = this.createButton({
      id: 'more-trigger',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
      label: 'More options',
      apply: () => this.toggleDropdown('more')
    })
    mainContainer.appendChild(moreBtn)

    this.toolbarEl.appendChild(mainContainer)
    document.body.appendChild(this.toolbarEl)
  }

  private createButton(action: ToolbarAction): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.className = 'hub-selection-toolbar__btn'
    btn.innerHTML = action.icon
    btn.title = action.label
    btn.onmousedown = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }
    btn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      action.apply(this.editor)
    }
    return btn
  }

  private addDivider(container: HTMLElement): void {
    const div = document.createElement('div')
    div.className = 'hub-selection-toolbar__divider'
    container.appendChild(div)
  }

  private toggleWrap(editor: any, sym: string, endSym?: string): void {
    const activeEnd = endSym || sym
    const sel = editor.getSelection()
    const mod = editor.getModel()
    if (!sel || !mod) return
    const txt = mod.getValueInRange(sel)
    const active = txt.startsWith(sym) && txt.endsWith(activeEnd)
    const newTxt = active ? txt.slice(sym.length, -activeEnd.length) : `${sym}${txt}${activeEnd}`
    editor.executeEdits('toolbar', [{ range: sel, text: newTxt, forceMoveMarkers: true }])
    this.hide()
  }

  private wrapWith(editor: any, pre: string, suf: string): void {
    const sel = editor.getSelection()
    const mod = editor.getModel()
    if (!sel || !mod) return
    const txt = mod.getValueInRange(sel)
    editor.executeEdits('toolbar', [
      { range: sel, text: `${pre}${txt}${suf}`, forceMoveMarkers: true }
    ])
    this.hide()
  }

  private async handleAI(prompt: string, mode: 'replace' | 'explain' = 'replace'): Promise<void> {
    const sel = this.editor.getSelection()
    const mod = this.editor.getModel()
    if (!sel || !mod) return
    const text = mod.getValueInRange(sel)
    if (!text.trim()) return

    this.isProcessing = true
    this.closeDropdown()
    this.toolbarEl?.classList.add('is-loading')
    if (this.statsEl) this.statsEl.textContent = 'Assistant is working...'

    try {
      if (mode === 'explain') {
        window.dispatchEvent(new CustomEvent('hub-ai-explain', { detail: { text, prompt } }))
        await new Promise((r) => setTimeout(r, 1200))
      } else {
        const fullPrompt = `${prompt}\n\nCONTENT:\n"${text}"\n\nReturn EXACTLY the improved text only. Preserve original paragraphing, do NOT add extra newlines.`
        const res = await aiService.callDeepSeekAPI([], fullPrompt)

        if (res) {
          // Careful replacement: avoid destroying trailing spaces if not wanted
          // but usually AI adds a trailing \n. Let's be smart.
          let cleaned = res.trim()

          // If the original selection ended with a newline, keep it!
          if (text.endsWith('\n') && !cleaned.endsWith('\n')) {
            cleaned += '\n'
          }
          // If the original selection started with a newline, keep it!
          if (text.startsWith('\n') && !cleaned.startsWith('\n')) {
            cleaned = '\n' + cleaned
          }

          this.editor.executeEdits('ai-toolbar', [
            { range: sel, text: cleaned, forceMoveMarkers: true }
          ])
        }
      }
    } catch (e) {
      console.error('[AI] Fail:', e)
    } finally {
      this.isProcessing = false
      this.toolbarEl?.classList.remove('is-loading')
      this.hide()
    }
  }

  private toggleDropdown(type: 'ai' | 'more' | 'voices', view?: string): void {
    if (this.dropdownEl && this.dropdownEl.dataset.type === type && !view) {
      this.closeDropdown()
      return
    }
    this.closeDropdown()
    this.renderDropdown(type, view)
  }

  private stopSpeech(): void {
    window.speechSynthesis.cancel()
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }
  }

  private async readAloudOpenAI(text: string, voice = 'alloy'): Promise<void> {
    if (!state.settings?.openaiApiKey) {
      alert('Please configure your OpenAI API Key in settings to use Premium Cloud Voices.')
      return
    }

    this.isProcessing = true
    this.toolbarEl?.classList.add('is-loading')
    if (this.statsEl) this.statsEl.textContent = 'Generating real voice...'

    try {
      this.stopSpeech()
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.settings.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice
        })
      })

      if (!response.ok) throw new Error('OpenAI TTS Failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      this.currentAudio = new Audio(url)
      this.currentAudio.play()
    } catch (e) {
      console.error('[OpenAI TTS] Fail:', e)
    } finally {
      this.isProcessing = false
      this.toolbarEl?.classList.remove('is-loading')
      this.hide()
    }
  }

  private closeDropdown(): void {
    if (this.dropdownEl) {
      this.dropdownEl.remove()
      this.dropdownEl = null
    }
  }

  private renderDropdown(type: 'ai' | 'more' | 'voices', view?: string): void {
    let items: any[] = []

    if (view === 'translate') {
      items = [
        { l: 'Back', i: '⬅️', a: () => this.toggleDropdown('ai'), back: true },
        { l: 'to English', i: '🇺🇸', a: () => this.handleAI('Translate this text to English.') },
        { l: 'to Spanish', i: '🇪🇸', a: () => this.handleAI('Translate this text to Spanish.') },
        { l: 'to French', i: '🇫🇷', a: () => this.handleAI('Translate this text to French.') },
        { l: 'to German', i: '🇩🇪', a: () => this.handleAI('Translate this text to German.') },
        { l: 'to Chinese', i: '🇨🇳', a: () => this.handleAI('Translate this text to Chinese.') },
        { l: 'to Japanese', i: '🇯🇵', a: () => this.handleAI('Translate this text to Japanese.') },
        { l: 'to Arabic', i: '🇸🇦', a: () => this.handleAI('Translate this text to Arabic.') }
      ]
    } else if (type === 'ai') {
      items = [
        {
          l: 'Fix Grammar & Spelling',
          i: '🛡️',
          s: 'AI',
          a: () =>
            this.handleAI(
              'Review and fix all grammar, punctuation, and spelling errors in the following text.'
            )
        },
        {
          l: 'Summarize',
          i: '📝',
          s: 'AI',
          a: () => this.handleAI('Provide a concise summary of this text.')
        },
        {
          l: 'Professional Tone',
          i: '👔',
          s: 'AI',
          a: () => this.handleAI('Rewrite this text to sound more professional and polished.')
        },
        {
          l: 'Humanize text',
          i: '🌿',
          s: 'AI',
          a: () =>
            this.handleAI(
              'Rewrite this text to sound more natural, human-like, and conversational.'
            )
        },
        {
          l: 'Casual Tone',
          i: '👋',
          s: 'AI',
          a: () => this.handleAI('Rewrite this text in a friendly, casual, and informal tone.')
        },
        {
          l: 'Make it longer',
          i: '➕',
          s: 'AI',
          a: () =>
            this.handleAI(
              'Expand on this text, adding more detail and depth while maintaining the core meaning.'
            )
        },
        {
          l: 'Make it shorter',
          i: '➖',
          s: 'AI',
          a: () => this.handleAI('Make this text significantly more concise and brief.')
        },
        {
          l: 'Explain Context',
          i: '💡',
          s: 'AI',
          a: () => this.handleAI('Explain the following context in detail.', 'explain')
        },
        {
          l: 'Translate...',
          i: '🌐',
          s: 'AI',
          a: () => this.toggleDropdown('ai', 'translate')
        }
      ]
    } else if (type === 'more') {
      items = [
        {
          l: 'Copy text',
          i: '📋',
          s: 'Ctrl+C',
          a: () => {
            const t = this.editor.getModel()?.getValueInRange(this.editor.getSelection()!)
            if (t) navigator.clipboard.writeText(t)
            this.hide()
          }
        },
        { l: 'WikiLink', i: '🔗', s: '[[', a: () => this.toggleWrap(this.editor, '[[', ']]') },
        { l: 'Strikethrough', i: '~~', s: '~~', a: () => this.toggleWrap(this.editor, '~~') },
        {
          l: 'Quote',
          i: '“',
          s: '> ',
          a: () => {
            const sel = this.editor.getSelection()!
            const val = this.editor.getModel()!.getValueInRange(sel)
            this.editor.executeEdits('toolbar', [
              { range: sel, text: `> ${val}`, forceMoveMarkers: true }
            ])
            this.hide()
          }
        },
        {
          l: 'Toggle Case',
          i: 'Aa',
          s: 'UP/lo',
          a: () => {
            const sel = this.editor.getSelection()!
            const val = this.editor.getModel()!.getValueInRange(sel)
            let rep = val
            if (val === val.toUpperCase()) rep = val.toLowerCase()
            else if (val === val.toLowerCase())
              rep = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
            else rep = val.toUpperCase()
            this.editor.executeEdits('toolbar', [{ range: sel, text: rep, forceMoveMarkers: true }])
            this.hide()
          }
        },
        {
          l: 'Change Voice...',
          i: '🗣️',
          s: 'TTS',
          a: () => this.toggleDropdown('voices')
        }
      ]
    } else if (type === 'voices') {
      items.push({
        l: 'Back',
        i: '⬅️',
        a: () => this.toggleDropdown('more'),
        back: true
      })

      // ONLY SHOW Cloud Voices as requested (System voices are "ugly" and problematic)
      if (state.settings?.openaiApiKey) {
        items.push({ l: 'Premium Voices', header: true })
        const v = ['alloy', 'nova', 'shimmer', 'onyx', 'fable', 'echo']
        v.forEach((name) => {
          items.push({
            l: `ChatGPT ${name.charAt(0).toUpperCase() + name.slice(1)}`,
            i: '✨',
            a: () => {
              if (state.settings) {
                state.settings.ttsVoice = `openai:${name}`
                window.api.updateSettings(state.settings)
                const sel = this.editor.getSelection()
                const txt = this.editor.getModel()?.getValueInRange(sel)
                if (txt) this.readAloudOpenAI(txt, name)
              }
            }
          })
        })
      }

      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        items.push({ l: 'System Voices', header: true })
        voices.forEach((voice) => {
          const cleanName = voice.name
            .replace(/Microsoft |Desktop |Natural | - /g, ' ')
            .replace(/\(.*?\)/g, '')
            .trim()

          items.push({
            l: `${cleanName} (${voice.lang.split('-')[0].toUpperCase()})`,
            i: '🗣️',
            a: () => {
              if (state.settings) {
                state.settings.ttsVoice = voice.voiceURI
                window.api.updateSettings(state.settings)
                const sel = this.editor.getSelection()
                const txt = this.editor.getModel()?.getValueInRange(sel)
                if (txt) {
                  this.stopSpeech()
                  const u = new SpeechSynthesisUtterance(txt)
                  u.voice = voice
                  if (state.settings.ttsSpeed) u.rate = state.settings.ttsSpeed
                  window.speechSynthesis.speak(u)
                }
              }
              this.hide()
            }
          })
        })
      } else if (!state.settings?.openaiApiKey) {
        items.push({
          l: 'Setup OpenAI for Voice...',
          i: '⚙️',
          a: () => {
            // Open settings to AI tab
            if ((window as any).app?.settingsView) {
              ;(window as any).app.settingsView.show('ai')
            }
          }
        })
      }
    }

    this.closeDropdown() // Clear old view
    this.dropdownEl = document.createElement('div')
    this.dropdownEl.className = 'hub-selection-toolbar__dropdown'
    this.dropdownEl.dataset.type = type
    if (view) this.dropdownEl.dataset.view = view
    this.dropdownIndex = -1

    items.forEach((item) => {
      if (item.header) {
        const h = document.createElement('div')
        h.className = 'hub-selection-toolbar__dropdown-header'
        h.textContent = item.l
        this.dropdownEl!.appendChild(h)
        return
      }

      const el = document.createElement('div')
      el.className = 'hub-selection-toolbar__dropdown-item'
      if (item.back) el.classList.add('is-back')

      const content = document.createElement('div')
      content.className = 'item-content'
      content.innerHTML = `<span class="item-icon">${item.i}</span><span class="item-label">${item.l}</span>`
      el.appendChild(content)

      if (item.s) {
        const shortcut = document.createElement('span')
        shortcut.className = 'item-shortcut'
        shortcut.textContent = item.s
        el.appendChild(shortcut)
      }

      el.onclick = (e) => {
        e.stopPropagation()
        item.a()
      }
      this.dropdownEl!.appendChild(el)
    })

    document.body.appendChild(this.dropdownEl)
    this.positionDropdown()
  }

  private navigateDropdown(dir: number): void {
    if (!this.dropdownEl) return
    const items = Array.from(
      this.dropdownEl.querySelectorAll('.hub-selection-toolbar__dropdown-item')
    )
    if (items.length === 0) return

    items.forEach((i) => i.classList.remove('is-hovered'))
    this.dropdownIndex += dir
    if (this.dropdownIndex < 0) this.dropdownIndex = items.length - 1
    if (this.dropdownIndex >= items.length) this.dropdownIndex = 0

    const target = items[this.dropdownIndex] as HTMLElement
    target.classList.add('is-hovered')
    target.scrollIntoView({ block: 'nearest' })
  }

  private positionDropdown(): void {
    if (!this.dropdownEl || !this.toolbarEl) return
    const rect = this.toolbarEl.getBoundingClientRect()

    // Position vertically below with 5px gap as requested
    this.dropdownEl.style.top = `${rect.bottom + 5}px`
    this.dropdownEl.style.left = `${rect.left}px`
  }

  private updateStats(): void {
    if (!this.statsEl || this.isProcessing) return
    const sel = this.editor.getSelection()
    const mod = this.editor.getModel()
    if (!sel || !mod) return
    const txt = mod.getValueInRange(sel).trim()
    const words = txt ? txt.split(/\s+/).length : 0
    const chars = txt.length
    this.statsEl.innerHTML = `<span>${words} words</span> • <span>${chars} chars</span>`
  }

  private positionToolbar(): void {
    if (!this.toolbarEl || !this.isVisible) return
    const sel = this.editor.getSelection()
    if (!sel) return

    // Position relative to the start of the selection to avoid "jumping to next block"
    // which happens with triple-clicks or paragraph selections.
    const startPos = this.editor.getScrolledVisiblePosition({
      lineNumber: sel.startLineNumber,
      column: sel.startColumn
    })
    const endPos = this.editor.getScrolledVisiblePosition({
      lineNumber: sel.endLineNumber,
      column: sel.endColumn
    })

    const domNode = this.editor.getDomNode()
    if (!startPos || !domNode) return

    const rect = domNode.getBoundingClientRect()
    const tw = this.toolbarEl.offsetWidth || 220
    const th = this.toolbarEl.offsetHeight || 32

    // Vertical: Above the start line
    let top = rect.top + startPos.top - th - 12
    let left: number

    // Horizontal: Center over the selection span
    if (sel.startLineNumber === sel.endLineNumber) {
      // Single line: center between selection edges
      left = rect.left + (startPos.left + endPos!.left) / 2 - tw / 2
    } else {
      // Multi-line: if it starts at col 1, it's likely a paragraph/block select.
      // Center it to the editor width instead of sticking to the left edge.
      if (sel.startColumn === 1) {
        left = rect.left + rect.width / 2 - tw / 2
      } else {
        left = rect.left + startPos.left - tw / 2
      }
    }

    // Flip to bottom if no space at top
    if (top < rect.top + 10) {
      top = rect.top + startPos.top + 28
    }

    // Keep in horizontal bounds
    left = Math.max(rect.left + 10, Math.min(left, rect.right - tw - 10))

    this.toolbarEl.style.top = `${top}px`
    this.toolbarEl.style.left = `${left}px`
  }
}
