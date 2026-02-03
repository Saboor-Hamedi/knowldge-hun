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
    <div class="rightbar__message-body">
      <div class="rightbar__typing" aria-live="polite">
        <div class="rightbar__typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  </div>
`

export const EXECUTING_HTML = `
  <div class="rightbar__message rightbar__message--assistant">
    <div class="rightbar__message-body">
      <div class="rightbar__message-content rightbar__executing" aria-live="polite">
        <div class="rightbar__typing-dots">
          <span style="background: var(--primary)"></span>
          <span style="background: var(--primary); animation-delay: 0.15s"></span>
          <span style="background: var(--primary); animation-delay: 0.3s"></span>
          <span style="margin-left: 6px; font-size: 10px; font-weight: 600; color: var(--primary); opacity: 0.9;">Running actions...</span>
        </div>
      </div>
    </div>
  </div>
`

export const RENDER_THROTTLE_MS = 100
