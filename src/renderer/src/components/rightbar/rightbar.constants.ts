import { Avatar } from './avatar'

export const WELCOME_HTML = `
  <div class="rightbar__welcome">
    <div class="rightbar__welcome-icon">✨</div>
    <p class="rightbar__welcome-title">AI Chat</p>
    <p class="rightbar__welcome-text">Ask about your notes, get summaries, or brainstorm ideas. I have context from your current note.</p>
    <p class="rightbar__welcome-hint">Ctrl+I to toggle · Drag the left edge to resize</p>
  </div>
`

export const TYPING_HTML = `
  <div class="rightbar__message rightbar__message--assistant">
    <div class="rightbar__Avatar-wrapper">${Avatar.createHTML('assistant', 20)}</div>
    <div class="rightbar__message-body">
      <div class="kb-chat-pill" style="margin-top: 4px; padding: 6px 12px; display: inline-flex;">
        <div class="kb-typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  </div>
`

export const EXECUTING_HTML = `
  <div class="rightbar__message rightbar__message--assistant">
    <div class="rightbar__Avatar-wrapper">${Avatar.createHTML('assistant', 20)}</div>
    <div class="rightbar__message-body">
      <div class="kb-chat-pill" style="margin-top: 4px; padding: 6px 12px; display: inline-flex; border-color: var(--primary-alpha);">
        <div class="kb-typing-dots">
          <span style="background: var(--primary)"></span>
          <span style="background: var(--primary); animation-delay: 0.15s"></span>
          <span style="background: var(--primary); animation-delay: 0.3s"></span>
        </div>
        <span style="font-size: 11px; font-weight: 700; color: var(--primary); margin-left: 8px;">Running local actions...</span>
      </div>
    </div>
  </div>
`

export const RENDER_THROTTLE_MS = 200
