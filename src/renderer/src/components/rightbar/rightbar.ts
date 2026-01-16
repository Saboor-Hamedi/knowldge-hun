import './rightbar.css';

export class RightBar {
  private container: HTMLElement;
  private tabDetails!: HTMLElement;
  private tabChat!: HTMLElement;
  private detailsPanel!: HTMLElement;
  private chatPanel!: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLElement;
    this.render();
    this.attachEvents();
  }

  private render() {
    this.container.innerHTML = `
      <div class="rightbar">
        <div class="rightbar__tabs">
          <button class="rightbar__tab rightbar__tab--active" data-tab="details">Details</button>
          <button class="rightbar__tab" data-tab="chat">Chat</button>
        </div>
        <div class="rightbar__panels">
          <div class="rightbar__panel rightbar__panel--active" data-panel="details">
            <div class="rightbar__details">
              <div class="rightbar__details-row"><span>Words:</span> <span id="rightbar-words">0</span></div>
              <div class="rightbar__details-row"><span>Characters:</span> <span id="rightbar-chars">0</span></div>
              <div class="rightbar__details-row"><span>Lines:</span> <span id="rightbar-lines">0</span></div>
              <div class="rightbar__details-row"><span>Created:</span> <span id="rightbar-created">-</span></div>
              <div class="rightbar__details-row"><span>Modified:</span> <span id="rightbar-modified">-</span></div>
            </div>
          </div>
          <div class="rightbar__panel" data-panel="chat">
            <div class="rightbar__chat-placeholder">AI chat coming soon...</div>
          </div>
        </div>
      </div>
    `;
    this.tabDetails = this.container.querySelector('[data-tab="details"]') as HTMLElement;
    this.tabChat = this.container.querySelector('[data-tab="chat"]') as HTMLElement;
    this.detailsPanel = this.container.querySelector('[data-panel="details"]') as HTMLElement;
    this.chatPanel = this.container.querySelector('[data-panel="chat"]') as HTMLElement;
  }

  private attachEvents() {
    this.tabDetails.addEventListener('click', () => this.switchTab('details'));
    this.tabChat.addEventListener('click', () => this.switchTab('chat'));
  }

  private switchTab(tab: 'details' | 'chat') {
    this.tabDetails.classList.toggle('rightbar__tab--active', tab === 'details');
    this.tabChat.classList.toggle('rightbar__tab--active', tab === 'chat');
    this.detailsPanel.classList.toggle('rightbar__panel--active', tab === 'details');
    this.chatPanel.classList.toggle('rightbar__panel--active', tab === 'chat');
  }

  updateDetails({ words, chars, lines, created, modified }: { words: number, chars: number, lines: number, created: string, modified: string }) {
    (this.container.querySelector('#rightbar-words') as HTMLElement).textContent = String(words);
    (this.container.querySelector('#rightbar-chars') as HTMLElement).textContent = String(chars);
    (this.container.querySelector('#rightbar-lines') as HTMLElement).textContent = String(lines);
    (this.container.querySelector('#rightbar-created') as HTMLElement).textContent = created;
    (this.container.querySelector('#rightbar-modified') as HTMLElement).textContent = modified;
  }
}
