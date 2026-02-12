import { TerminalSession } from './terminal.types'

export class TerminalSearchManager {
  private searchContainer: HTMLElement
  private searchInput: HTMLInputElement

  constructor(container: HTMLElement) {
    this.searchContainer = container.querySelector('#terminal-search-container') as HTMLElement
    this.searchInput = container.querySelector('#terminal-search-input') as HTMLInputElement
  }

  toggle(visible?: boolean): boolean {
    const nextVisible =
      visible !== undefined ? visible : this.searchContainer.style.display === 'none'
    this.searchContainer.style.display = nextVisible ? 'flex' : 'none'

    if (nextVisible) {
      this.searchInput.focus()
      this.searchInput.select()
    }

    return nextVisible
  }

  doSearch(
    session: TerminalSession | undefined,
    term: string,
    direction: 'prev' | 'next' = 'next'
  ): void {
    if (!session || !term) return

    if (direction === 'next') {
      session.searchAddon.findNext(term)
    } else {
      session.searchAddon.findPrevious(term)
    }
  }

  isVisible(): boolean {
    return this.searchContainer.style.display === 'flex'
  }
}
