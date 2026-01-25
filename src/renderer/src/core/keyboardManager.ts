/**
 * Robust keyboard shortcut manager
 * Handles global and scoped keyboard bindings
 */

export interface KeyBinding {
  key: string // e.g., 'Control+r', 'Cmd+s', 'Escape'
  handler: (event: KeyboardEvent) => void | boolean
  scope?: string // 'global' (default) or custom scope
  description?: string
}

export class KeyboardManager {
  private bindings: Map<string, KeyBinding> = new Map()
  private activeScopes: Set<string> = new Set()
  private isListening = false

  constructor() {
    this.activeScopes.add('global')
  }

  /**
   * Register a keyboard shortcut
   */
  register(binding: KeyBinding): void {
    const key = this.normalizeKey(binding.key)
    const scope = binding.scope || 'global'
    const id = `${scope}:${key}`

    this.bindings.set(id, { ...binding, key, scope })

    if (!this.isListening) {
      this.listen()
    }
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(key: string, scope = 'global'): void {
    const normalizedKey = this.normalizeKey(key)
    const id = `${scope}:${normalizedKey}`
    this.bindings.delete(id)
  }

  /**
   * Enable a scope (e.g., 'rename', 'search')
   */
  enableScope(scope: string): void {
    this.activeScopes.add(scope)
  }

  /**
   * Disable a scope
   */
  disableScope(scope: string): void {
    this.activeScopes.delete(scope)
  }

  /**
   * Clear all scopes except global
   */
  clearScopes(): void {
    this.activeScopes.clear()
    this.activeScopes.add('global')
  }

  /**
   * Normalize key notation (Ctrl vs Control, Cmd vs Meta)
   */
  private normalizeKey(key: string): string {
    return key.toLowerCase().replace(/ctrl/g, 'control').replace(/cmd/g, 'meta').replace(/\s+/g, '')
  }

  /**
   * Build key notation from event
   */
  private getKeyNotation(event: KeyboardEvent): string {
    const parts: string[] = []

    if (event.ctrlKey) parts.push('control')
    if (event.altKey) parts.push('alt')
    if (event.shiftKey) parts.push('shift')
    if (event.metaKey) parts.push('meta')

    const key = event.key.toLowerCase()
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
      parts.push(key)
    }

    return parts.join('+')
  }

  /**
   * Listen to keyboard events
   */
  private listen(): void {
    document.addEventListener('keydown', (event) => {
      const keyNotation = this.getKeyNotation(event)

      // Check all active scopes
      for (const scope of this.activeScopes) {
        const id = `${scope}:${keyNotation}`
        const binding = this.bindings.get(id)

        if (binding) {
          const processed = binding.handler(event)
          // If the handler explicitly returns false, don't prevent default
          if (processed !== false) {
            event.preventDefault()
          }
          return
        }
      }
    })

    this.isListening = true
  }

  /**
   * Get all bindings for a scope
   */
  getBindings(scope?: string): KeyBinding[] {
    const s = scope || 'global'
    return Array.from(this.bindings.values()).filter((b) => b.scope === s)
  }
}

export const keyboardManager = new KeyboardManager()
