import type { AppSettings } from '../core/types'

/**
 * Apply search input styling from settings to CSS custom properties
 * This affects all search inputs: terminal, editor find widget, and global search
 */
export function applySearchInputStyles(settings: AppSettings): void {
  if (!settings.searchInput) return

  const root = document.documentElement
  const searchInput = settings.searchInput

  if (searchInput.backgroundColor) {
    root.style.setProperty('--search-bg', searchInput.backgroundColor)
  }

  if (searchInput.borderColor) {
    root.style.setProperty('--search-border', searchInput.borderColor)
  }

  if (searchInput.focusBorderColor) {
    root.style.setProperty('--search-focus-border', searchInput.focusBorderColor)
  }

  if (searchInput.textColor) {
    root.style.setProperty('--search-text', searchInput.textColor)
  }

  if (searchInput.placeholderColor) {
    root.style.setProperty('--search-placeholder', searchInput.placeholderColor)
  }

  if (searchInput.buttonColor) {
    root.style.setProperty('--search-button', searchInput.buttonColor)
  }

  if (searchInput.buttonHoverColor) {
    root.style.setProperty('--search-button-hover', searchInput.buttonHoverColor)
  }

  if (searchInput.buttonActiveColor) {
    root.style.setProperty('--search-button-active', searchInput.buttonActiveColor)
  }
}
