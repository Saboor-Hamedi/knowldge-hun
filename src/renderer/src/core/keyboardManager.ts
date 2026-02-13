/**
 * KEYBOARD SHORTCUT ENGINE:
 *
 * This manager centralizes all hotkeys (e.g., Ctrl+S to save, Ctrl+I for AI).
 * It uses a "Capture Phase" listener to intercept keys before they reach
 * individual components like the editor or sidebar.
 *
 * SECURITY ROLE:
 * When the app is locked (Firewall active), the SecurityService calls
 * 'setEnabled(false)'. This acts as a master circuit breaker, killing
 * all shortcuts so no one can "bypass" the login screen using hotkeys.
 */

export interface KeyBinding {
  key: string // e.g., 'Control+r', 'Cmd+s', 'Escape'
  handler: (event: KeyboardEvent) => void | boolean | Promise<void>
  scope?: string // 'global' (default) or custom scope
  description?: string
}

export class KeyboardManager {
  private bindings: Map<string, KeyBinding> = new Map()
  private activeScopes: Set<string> = new Set()
  private isListening = false
  // Flag controlled by SecurityService.ts
  private enabled = true

  constructor() {
    this.activeScopes.add('global')
  }

  /**
   * Master switch for the shortcut system.
   * Called by: securityService.ts (during showFirewall/handleUnlock)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
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
    const parts = key
      .toLowerCase()
      .replace(/ctrl/g, 'control')
      .replace(/cmd/g, 'meta')
      .replace(/\s+/g, '')
      .split('+')

    const modifiers = parts.filter((p) => ['control', 'alt', 'shift', 'meta'].includes(p))
    const keys = parts.filter((p) => !['control', 'alt', 'shift', 'meta'].includes(p))

    // Enforce specific order that matches getKeyNotation: control, alt, shift, meta
    const orderedModifiers: string[] = []
    if (modifiers.includes('control')) orderedModifiers.push('control')
    if (modifiers.includes('alt')) orderedModifiers.push('alt')
    if (modifiers.includes('shift')) orderedModifiers.push('shift')
    if (modifiers.includes('meta')) orderedModifiers.push('meta')

    return [...orderedModifiers, ...keys].join('+')
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
    // 🛡️ SECURITY INTERCEPTOR
    // Uses capture phase (true) to intercept events before Monaco or Chrome defaults
    document.addEventListener(
      'keydown',
      (event) => {
        // If disabled by SecurityService, ignore all shortcuts
        if (!this.enabled) return

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
              event.stopPropagation() // Stop bubbling to other listeners
            }
            return
          }
        }
      },
      true
    )

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
