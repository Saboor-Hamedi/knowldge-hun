import type { AppSettings } from '../core/types'

/**
 * Apply search input styling from settings to CSS custom properties
 * This affects all search inputs: terminal, editor find widget, and global search
 */
export function applySearchInputStyles(settings: AppSettings): void {
  const root = document.documentElement
  const searchInput = settings.searchInput

  const props = {
    backgroundColor: '--search-bg',
    borderColor: '--search-border',
    focusBorderColor: '--search-focus-border',
    textColor: '--search-text',
    placeholderColor: '--search-placeholder',
    buttonColor: '--search-button',
    buttonHoverColor: '--search-button-hover',
    buttonActiveColor: '--search-button-active'
  }

  for (const [key, prop] of Object.entries(props)) {
    const val = searchInput?.[key as keyof typeof searchInput]
    if (val) {
      root.style.setProperty(prop, val)
    } else {
      root.style.removeProperty(prop)
    }
  }
}
