import { ChatIndicator } from '../common/ChatIndicator'

export const WELCOME_HTML = `
  <div class="rightbar__welcome">
    <div class="rightbar__welcome-icon">✨</div>
    <p class="rightbar__welcome-title">AI Chat</p>
    <p class="rightbar__welcome-text">Ask about your notes, get summaries, or brainstorm ideas. I have context from your current note.</p>
    <p class="rightbar__welcome-hint">Ctrl+I to toggle · Drag the left edge to resize</p>
  </div>
`

export const TYPING_HTML = ChatIndicator.createFullResponse('thinking', 20)

export const EXECUTING_HTML = ChatIndicator.createFullResponse('searching', 20)

export const RENDER_THROTTLE_MS = 200
