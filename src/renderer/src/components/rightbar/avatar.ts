/**
 * Avatar component for chat messages
 */
export class Avatar {
  /**
   * Creates an avatar element for a user or AI
   */
  static create(role: 'user' | 'assistant', size: number = 20): HTMLElement {
    const avatar = document.createElement('div')
    avatar.className = `kb-avatar kb-avatar--${role}`
    avatar.setAttribute('role', 'img')
    avatar.setAttribute('aria-label', role === 'user' ? 'User' : 'AI Assistant')

    if (role === 'user') {
      avatar.innerHTML = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      `
    } else {
      avatar.innerHTML = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
      `
    }

    return avatar
  }

  /**
   * Creates avatar HTML string (for use in innerHTML)
   */
  static createHTML(role: 'user' | 'assistant', size: number = 20): string {
    const className = `kb-avatar kb-avatar--${role}`

    if (role === 'user') {
      return `
        <div class="${className}" role="img" aria-label="User">
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
      `
    } else {
      return `
        <div class="${className}" role="img" aria-label="AI Assistant">
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
        </div>
      `
    }
  }
}
