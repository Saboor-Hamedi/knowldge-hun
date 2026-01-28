import { modalManager } from '../components/modal/modal'
import { notificationManager } from '../components/notification/notification'

/**
 * Robust Error handling utility for Knowledge Hub
 */
export class ErrorHandler {
  static init(): void {
    window.addEventListener('error', (event) => {
      // Suppress Monaco Editor's "Canceled" errors and expected user errors
      if (this.isMonacoCanceledError(event.error) || this.isExpectedUserError(event.error)) {
        event.preventDefault()
        return
      }
      this.showErrorModal(event.error || new Error(event.message))
    })

    window.addEventListener('unhandledrejection', (event) => {
      // Suppress Monaco Editor's "Canceled" promise rejections and expected user errors
      if (this.isMonacoCanceledError(event.reason) || this.isExpectedUserError(event.reason)) {
        event.preventDefault()
        return
      }
      this.showErrorModal(event.reason || new Error('Unhandled Promise Rejection'))
    })
  }

  /**
   * Check if error is an "expected" user or validation error that shouldn't
   * trigger the scary "Application Error" modal.
   */
  private static isExpectedUserError(error: unknown): boolean {
    if (!error) return false
    const message = (error as { message?: string })?.message || String(error)

    const patterns = ['already exists', 'File exists', 'folder exists', 'Note exists']

    return patterns.some((p) => message.toLowerCase().includes(p.toLowerCase()))
  }

  /**
   * Check if error is Monaco's harmless "Canceled" error
   */
  private static isMonacoCanceledError(error: unknown): boolean {
    if (!error) return false

    // Check for Monaco's "Canceled" error message
    const err = error as { message?: string; stack?: string }
    const message = err.message || String(error)
    if (message === 'Canceled') {
      // Additional check: ensure it's from Monaco (check stack trace)
      const stack = err.stack || ''
      if (
        stack.includes('monaco') ||
        stack.includes('UniqueContainer') ||
        stack.includes('chunk-')
      ) {
        return true
      }
    }

    return false
  }

  static showErrorModal(error: Error | unknown): void {
    console.error('[Global Error]', error)

    const stack = (error as Error)?.stack || 'No stack trace available'
    const message = (error as Error)?.message || String(error)

    const content = document.createElement('div')
    content.className = 'error-modal-content'
    content.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="width: 42px; height: 42px; background: rgba(248, 113, 113, 0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #f87171; flex-shrink: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    </div>
                    <div style="flex: 1;">
                        <div style="color: var(--text-strong); font-size: 15px; font-weight: 600; margin-bottom: 4px;">System Failure Detected</div>
                        <div style="color: var(--text-soft); font-size: 13px; line-height: 1.5; opacity: 0.8;">
                            The application encountered an unexpected error. Your technical data is safe, but a workspace refresh may be required.
                        </div>
                    </div>
                </div>
                
                <div style="background: var(--panel-strong); border: 1px solid var(--border); padding: 16px; border-radius: 12px; position: relative; overflow: hidden;">
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #f87171;"></div>
                    <div style="color: #f87171; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; opacity: 0.9;">Error Diagnostic</div>
                    <div style="font-family: var(--font-mono, monospace); font-size: 12px; color: var(--text-strong); word-break: break-all; line-height: 1.5;">
                        ${this.escapeHtml(message)}
                    </div>
                </div>

                <details style="cursor: pointer; border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.02);">
                    <summary style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); padding: 10px 14px; user-select: none; display: flex; align-items: center; gap: 8px;">
                        Technical Stack Trace
                    </summary>
                    <div style="padding: 0 14px 14px 14px;">
                        <pre style="background: rgba(0, 0, 0, 0.2); padding: 12px; border-radius: 8px; overflow: auto; max-height: 180px; font-size: 11px; font-family: var(--font-mono, monospace); color: var(--text-soft); border: 1px solid var(--border); margin: 0; line-height: 1.6;">${this.escapeHtml(
                          stack
                        )}</pre>
                    </div>
                </details>
            </div>
        `

    modalManager.open({
      title: 'Application Error',
      customContent: content,
      size: 'md',
      closeOnEscape: false,
      closeOnBackdrop: false,
      buttons: [
        {
          label: 'Restart',
          variant: 'primary',
          onClick: () => window.location.reload()
        },
        {
          label: 'Copy logs',
          variant: 'ghost',
          onClick: () => {
            const text = `Error: ${message}\n\nStack:\n${stack}`
            navigator.clipboard
              .writeText(text)
              .then(() => {
                notificationManager.show('Error logs copied to clipboard', 'info')
              })
              .catch(() => {
                // Fallback for older browsers or restricted contexts
                const textarea = document.createElement('textarea')
                textarea.value = text
                textarea.style.position = 'fixed'
                textarea.style.left = '-9999px'
                textarea.style.top = '0'
                document.body.appendChild(textarea)
                textarea.focus()
                textarea.select()
                try {
                  document.execCommand('copy')
                  notificationManager.show('Error logs copied to clipboard', 'info')
                } catch (err) {
                  console.error('Fallback copy failed', err)
                }
                document.body.removeChild(textarea)
              })
          }
        }
      ]
    })
  }

  private static escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
