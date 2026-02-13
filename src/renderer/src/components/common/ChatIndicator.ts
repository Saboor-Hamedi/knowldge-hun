import { Avatar } from '../rightbar/avatar'

export type ChatIndicatorType = 'thinking' | 'searching'

/**
 * ChatIndicator - A standalone component for AI thinking and searching states.
 * Standardizes the high-quality UI response indicator across the application.
 */
export class ChatIndicator {
  /**
   * Creates the thinking/searching pill (dots + label).
   * Used when you already have a message structure and just need the indicator.
   */
  static createPill(type: ChatIndicatorType = 'thinking'): string {
    const isSearching = type === 'searching'
    const label = isSearching ? 'Doing...' : 'Thinking...'
    const pillStyles = isSearching
      ? 'border-color: var(--primary-alpha); box-shadow: 0 4px 12px var(--primary-alpha);'
      : ''
    const dotStyles = isSearching ? 'background: var(--primary)' : ''
    const labelStyles = isSearching
      ? 'font-size: 11px; font-weight: 700; color: var(--primary); margin-left: 2px;'
      : 'font-size: 11px; color: var(--text-soft); font-weight: 500;'

    return `
      <div class="kb-chat-pill" style="${pillStyles}">

        <div class="kb-typing-dots">
          <span class="kb-typing-dot" style="${dotStyles}"></span>
          <span class="kb-typing-dot" style="${dotStyles}; animation-delay: 0.15s"></span>
          <span class="kb-typing-dot" style="${dotStyles}; animation-delay: 0.3s"></span>
        </div>
        <span style="${labelStyles}">${label}</span>
      </div>
    `
  }

  /**
   * Creates a full message-wrapped indicator.
   * Standardizes the wrapper classes to ensure consistency.
   */
  static createFullResponse(type: ChatIndicatorType = 'thinking', avatarSize: number = 20): string {
    return `
      <div class="rightbar__message rightbar__message--assistant">
        ${Avatar.createHTML('assistant', avatarSize)}
        <div class="rightbar__message-body">
          ${this.createPill(type)}
        </div>
      </div>
    `
  }

  /**
   * Creates simple inline typing dots for streaming text.
   */
  static createInline(): string {
    return `
      <span class="kb-typing-indicator-inline">
        <span class="kb-typing-dot"></span>
        <span class="kb-typing-dot"></span>
        <span class="kb-typing-dot"></span>
      </span>
    `
  }
}
