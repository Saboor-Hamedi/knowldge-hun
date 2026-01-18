import './inline-ai.css'
import { aiService } from '../aiService'

type InsertCallback = (text: string) => void
type ReplaceCallback = (text: string) => void

export class InlineAIComponent {
  private host: HTMLElement
  private root: HTMLElement
  private promptInput: HTMLInputElement
  private responseEl: HTMLElement
  private insertCb: InsertCallback
  private replaceCb?: ReplaceCallback
  private getSelection?: () => string | null
  private generating = false
  private stopped = false
  private controller?: AbortController
  private shouldReplace: boolean = false
  private stopButton?: HTMLButtonElement
  private insertButton?: HTMLButtonElement
  private closeButton?: HTMLButtonElement
  private copyButton?: HTMLButtonElement
  private _globalKeydown?: (e: KeyboardEvent) => void

  constructor(host: HTMLElement, insertCb: InsertCallback, replaceCb?: ReplaceCallback, getSelection?: () => string | null) {
    this.host = host
    this.insertCb = insertCb
    this.replaceCb = replaceCb
    this.getSelection = getSelection
    this.root = document.createElement('div')
    this.root.className = 'inline-ai hidden'
    this.root.innerHTML = `
      <input class="prompt" placeholder="Ask: e.g. improve, rewrite, make bullets, code template..." />
      <div class="response" aria-live="polite"></div>
      <div class="controls">
        <button class="small stop">Stop</button>
        <button class="small copy">Copy</button>
        <button class="small insert primary">Insert</button>
        <button class="small close">Close</button>
      </div>
    `
    this.host.appendChild(this.root)

    this.promptInput = this.root.querySelector('.prompt') as HTMLInputElement
    this.responseEl = this.root.querySelector('.response') as HTMLElement

    this.stopButton = this.root.querySelector('.stop') as HTMLButtonElement
    this.copyButton = this.root.querySelector('.copy') as HTMLButtonElement
    this.insertButton = this.root.querySelector('.insert') as HTMLButtonElement
    this.closeButton = this.root.querySelector('.close') as HTMLButtonElement

    this.stopButton?.addEventListener('click', () => this.stop())
    this.copyButton?.addEventListener('click', async () => {
      const text = (this.responseEl.innerText || this.promptInput.value || '').trim()
      if (!text) return
      try {
        await navigator.clipboard.writeText(text)
        const old = this.copyButton?.textContent
        if (this.copyButton) this.copyButton.textContent = 'Copied!'
        setTimeout(() => {
          if (this.copyButton) this.copyButton.textContent = (old as string) || 'Copy'
        }, 1400)
      } catch (err) {
        console.warn('Copy failed', err)
      }
    })
    this.insertButton?.addEventListener('click', () => this.insert())
    // Ensure close also aborts any in-progress generation
    this.closeButton?.addEventListener('click', () => { this.stop(); this.hide() })

    this.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void this.submit()
      } else if (e.key === 'Escape') {
        // Abort generation and hide
        try { this.stop() } catch (_) {}
        this.hide()
      }
    })
  }

  show(x?: number, y?: number): void {
    this.root.classList.remove('hidden')
    // position relative to host
    const hostRect = this.host.getBoundingClientRect()
    this.root.style.position = 'absolute'
    this.root.style.left = `${(x ?? (hostRect.width / 2 - 180))}px`
    this.root.style.top = `${(y ?? 12)}px`
    this.focus()
    // Attach global Escape handler so Escape works even when prompt isn't focused
    this._globalKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        try { this.stop() } catch (_) {}
        this.hide()
      }
    }
    window.addEventListener('keydown', this._globalKeydown, true)
  }

  hide(): void {
    // Abort any in-progress generation before hiding
    try { this.stop() } catch (_) {}
    this.root.classList.add('hidden')
    this.clear()
    // Remove global key handler
    try {
      if (this._globalKeydown) {
        window.removeEventListener('keydown', this._globalKeydown, true)
        this._globalKeydown = undefined
      }
    } catch (_) {}
  }

  focus(): void { this.promptInput.focus(); this.promptInput.select() }

  clear(): void {
    this.promptInput.value = ''
    this.responseEl.innerText = ''
    this.generating = false
    this.stopped = false
    this.shouldReplace = false
    if (this.insertButton) this.insertButton.textContent = 'Insert'
  }

  stop(): void {
    this.stopped = true
    this.generating = false
    try { this.controller?.abort() } catch (_) {}
  }

  insert(): void {
    const text = this.responseEl.innerText || this.promptInput.value
    if (!text) return
    if (this.shouldReplace && this.replaceCb) {
      this.replaceCb(text)
    } else if (this.insertCb) {
      this.insertCb(text)
    }
    this.hide()
  }

  async submit(): Promise<void> {
    const prompt = this.promptInput.value.trim()
    if (!prompt) return
    this.responseEl.innerText = ''
    this.generating = true
    this.stopped = false

    // Determine selection-aware behavior
    const selection = this.getSelection ? this.getSelection() : null

    const improveTrigger = /\b(improve|rewrite|enhance|polish|fix|refactor|clarify|shorten|expand)\b/i

    // If user asked to improve and a selection exists, replace only the selection
    if (selection && improveTrigger.test(prompt) && !!this.replaceCb) {
      this.shouldReplace = true
      if (this.insertButton) this.insertButton.textContent = 'Replace'
      // Instruct the model to return replacement for the selection only
      const userPrompt = `Improve the following text and return ONLY the improved text (no commentary):\n\n${selection}\n\nInstruction: ${prompt}`
      const context = await aiService.buildContextMessage(userPrompt)
      const messages = [{ role: 'user', content: userPrompt }]
      this.controller = new AbortController()
      await aiService.callDeepSeekAPIStream(messages, context, (chunk: string) => {
        if (this.stopped) return
        this.responseEl.innerText += chunk
        this.responseEl.scrollTop = this.responseEl.scrollHeight
      }, this.controller.signal)
      this.generating = false
      return
    }

    // If no selection and user asked generic 'improve', be conservative: return short suggestion
    if (!selection && improveTrigger.test(prompt)) {
      this.shouldReplace = false
      if (this.insertButton) this.insertButton.textContent = 'Insert'
      const userPrompt = `You were asked: \"${prompt}\". DO NOT rewrite the entire note. Provide a concise improved version or a short suggestion (max 150 words). Return only the suggestion or improved snippet.`
      const context = await aiService.buildContextMessage(userPrompt)
      const messages = [{ role: 'user', content: userPrompt }]
      this.controller = new AbortController()
      await aiService.callDeepSeekAPIStream(messages, context, (chunk: string) => {
        if (this.stopped) return
        this.responseEl.innerText += chunk
        this.responseEl.scrollTop = this.responseEl.scrollHeight
      }, this.controller.signal)
      this.generating = false
      return
    }

    // Fallback: default behavior
    const replaceTrigger = /^\s*(replace|rewrite|overwrite|replace this|rewrite this)\b/i
    this.shouldReplace = replaceTrigger.test(prompt) && prompt.length < 80 && !!this.replaceCb
    if (this.shouldReplace) {
      if (this.insertButton) this.insertButton.textContent = 'Replace'
    } else {
      if (this.insertButton) this.insertButton.textContent = 'Insert'
    }

    try {
      // If shouldReplace, instruct the model to only return replacement content
      const userPrompt = this.shouldReplace
        ? `Please provide the replacement content only. Do NOT ask clarifying questions or add commentary. Return only the new note content.\n\nInstruction:\n${prompt}`
        : prompt
      const context = await aiService.buildContextMessage(userPrompt)
      const messages = [{ role: 'user', content: prompt }]
      this.controller = new AbortController()
      await aiService.callDeepSeekAPIStream(messages, context, (chunk: string) => {
        if (this.stopped) return
        this.responseEl.innerText += chunk
        // keep scroll at bottom
        this.responseEl.scrollTop = this.responseEl.scrollHeight
      }, this.controller.signal)
    } catch (err) {
      this.responseEl.innerText += `\n[Error] ${String(err)}`
    } finally {
      this.generating = false
    }
  }
}

export default InlineAIComponent
