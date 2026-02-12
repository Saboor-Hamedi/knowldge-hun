import { SmartTextArea, SmartTextAreaOptions } from './SmartTextArea'
import { ModeSwitcher } from './ModeSwitcher'
import { codicons } from '../../utils/codicons'

import { ChatMode } from '../../services/aiService'

export interface ChatInputOptions extends SmartTextAreaOptions {
  showModeSwitcher?: boolean
  showPrompt?: boolean
  onStop?: () => void
  onModeChange?: (mode: 'terminal' | 'ai') => void
  onCapabilityChange?: (mode: ChatMode) => void
}

/**
 * Unified Chat Input Component for Console and Rightbar
 */
export class ChatInput {
  private container: HTMLElement
  private textArea!: SmartTextArea
  private modeSwitcher: ModeSwitcher | null = null
  private stopBtn!: HTMLButtonElement
  private sendBtn!: HTMLButtonElement
  private counterEl!: HTMLElement
  private promptEl!: HTMLElement
  private options: ChatInputOptions
  private currentMode: 'terminal' | 'ai' = 'ai'

  constructor(parent: HTMLElement, options: ChatInputOptions = {}) {
    this.options = options
    this.container = document.createElement('div')
    this.container.className = `kb-chat-input ${options.className || ''}`
    parent.appendChild(this.container)

    this.render()
    this.initSubComponents()
    this.attachEvents()
  }

  private render(): void {
    const stopIcon = `<div class="stop-core"></div><div class="spinner-ring"></div>`
    const sendIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>`

    this.container.innerHTML = `
      <div class="kb-chat-input__area-container"></div>
      <div class="kb-chat-input__footer">
        <div class="kb-chat-input__footer-left">
          <div class="kb-chat-input__mode-toggle" style="display: ${this.options.showModeSwitcher ? 'flex' : 'none'}">
             <button class="kb-chat-input__mode-btn" data-mode="terminal" title="Terminal Mode">${codicons.terminal}</button>
             <button class="kb-chat-input__mode-btn" data-mode="ai" title="AI Agent">${codicons.agent}</button>
          </div>
          <div class="kb-chat-input__prompt" style="display: ${this.options.showPrompt ? 'block' : 'none'}">λ</div>
          <div class="kb-chat-input__capability-container"></div>
          <div class="kb-chat-input__counter">0</div>
        </div>
        <div class="kb-chat-input__footer-right">
          <div class="kb-chat-input__actions">
            <button class="kb-chat-input__btn kb-chat-input__btn--stop" title="Stop generating" style="display: none;">${stopIcon}</button>
            <button class="kb-chat-input__btn kb-chat-input__btn--send" title="Send (Enter)">${sendIcon}</button>
          </div>
        </div>
      </div>
    `
  }

  private initSubComponents(): void {
    const areaCtx = this.container.querySelector('.kb-chat-input__area-container') as HTMLElement
    this.textArea = new SmartTextArea(areaCtx, {
      ...this.options,
      onInput: (text) => {
        this.updateCounter(text)
        if (this.options.onInput) this.options.onInput(text)
      }
    })

    const capabilityCtx = this.container.querySelector(
      '.kb-chat-input__capability-container'
    ) as HTMLElement
    this.modeSwitcher = new ModeSwitcher(capabilityCtx, {
      onModeChange: (mode) => {
        if (this.options.onCapabilityChange) this.options.onCapabilityChange(mode)
      }
    })

    this.stopBtn = this.container.querySelector('.kb-chat-input__btn--stop') as HTMLButtonElement
    this.sendBtn = this.container.querySelector('.kb-chat-input__btn--send') as HTMLButtonElement
    this.counterEl = this.container.querySelector('.kb-chat-input__counter') as HTMLElement
    this.promptEl = this.container.querySelector('.kb-chat-input__prompt') as HTMLElement
  }

  private attachEvents(): void {
    this.sendBtn.addEventListener('click', () => {
      const text = this.textArea.getPlainText().trim()
      if (text && this.options.onSend) {
        this.options.onSend(text)
        this.textArea.clear()
      }
    })

    this.stopBtn.addEventListener('click', () => {
      if (this.options.onStop) this.options.onStop()
    })

    // Mode toggle buttons (Terminal vs AI)
    const modeBtns = this.container.querySelectorAll('.kb-chat-input__mode-btn')
    modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.mode as 'terminal' | 'ai'
        this.setMode(mode)
        if (this.options.onModeChange) this.options.onModeChange(mode)
      })
    })

    // Sync active state
    this.setMode(this.currentMode)
  }

  public setMode(mode: 'terminal' | 'ai'): void {
    this.currentMode = mode
    this.container.querySelectorAll('.kb-chat-input__mode-btn').forEach((btn) => {
      btn.classList.toggle('is-active', (btn as HTMLElement).dataset.mode === mode)
    })

    // Capability switcher is only for AI mode
    const capabilityCtx = this.container.querySelector(
      '.kb-chat-input__capability-container'
    ) as HTMLElement
    if (capabilityCtx) {
      capabilityCtx.style.display = mode === 'ai' ? 'flex' : 'none'
    }

    // Default placeholders
    if (this.textArea) {
      const ph = mode === 'ai' ? 'Ask anything... @note to mention' : 'Type a command...'
      this.textArea.setPlaceholder(ph)
    }
  }

  public setBusy(busy: boolean, placeholder?: string): void {
    this.textArea.setEnabled(!busy)
    if (busy) {
      this.stopBtn.style.display = 'flex'
      this.sendBtn.style.display = 'none'
      if (placeholder) this.textArea.setPlaceholder(placeholder)
    } else {
      this.stopBtn.style.display = 'none'
      this.sendBtn.style.display = 'flex'
      this.setMode(this.currentMode) // Restore default placeholder
    }
  }

  public focus(): void {
    this.textArea.focus()
  }

  public setValue(val: string): void {
    this.textArea.setValue(val)
  }

  public getValue(): string {
    return this.textArea.getPlainText()
  }

  public setSlashCommands(
    commands: { command: string; description: string; icon?: any; action?: () => void }[]
  ): void {
    this.textArea.setSlashCommands(commands)
  }

  public updatePrompt(text: string): void {
    if (this.promptEl) this.promptEl.textContent = text
  }

  private updateCounter(text: string): void {
    if (this.counterEl) {
      this.counterEl.textContent = text.length.toString()
      this.counterEl.style.display = text.length > 0 ? 'block' : 'none'
    }
  }

  public getPlainText(): string {
    return this.textArea.getPlainText()
  }

  public clear(): void {
    this.textArea.clear()
    this.updateCounter('')
  }

  public destroy(): void {
    if (this.modeSwitcher) this.modeSwitcher.destroy()
    this.container.remove()
  }
}
