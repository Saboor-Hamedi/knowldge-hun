import { modalManager } from '../modal/modal'
import './details-modal.css'

export class DetailsModal {
  show(details: {
    words: number
    chars: number
    lines: number
    readTime: string
    wikiLinks: number
    tags: number
    created: string
    modified: string
  }): void {
    const content = document.createElement('div')
    content.className = 'details-modal-content'
    content.innerHTML = `
      <div class="details-modal__row">
        <span class="details-modal__label">Words</span>
        <span class="details-modal__value">${details.words}</span>
      </div>
      <div class="details-modal__row">
        <span class="details-modal__label">Characters</span>
        <span class="details-modal__value">${details.chars}</span>
      </div>
      <div class="details-modal__row">
        <span class="details-modal__label">Lines</span>
        <span class="details-modal__value">${details.lines}</span>
      </div>
      <div class="details-modal__row">
        <span class="details-modal__label">Read Time</span>
        <span class="details-modal__value">${details.readTime}</span>
      </div>
      <div class="details-modal__row">
        <span class="details-modal__label">Wiki Links</span>
        <span class="details-modal__value">${details.wikiLinks}</span>
      </div>
      <div class="details-modal__row">
        <span class="details-modal__label">Tags</span>
        <span class="details-modal__value">${details.tags}</span>
      </div>
      <div class="details-modal__row">
        <span class="details-modal__label">Created</span>
        <span class="details-modal__value">${details.created}</span>
      </div>
      <div class="details-modal__row">
        <span class="details-modal__label">Modified</span>
        <span class="details-modal__value">${details.modified}</span>
      </div>
    `

    modalManager.open({
      title: 'Note Details',
      customContent: content,
      size: 'sm',
      closeOnEscape: true,
      closeOnBackdrop: true
    })
  }
}

export const detailsModal = new DetailsModal()
