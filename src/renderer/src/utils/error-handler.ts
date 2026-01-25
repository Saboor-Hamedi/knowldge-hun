import { modalManager } from '../components/modal/modal'

/**
 * Robust Error handling utility for Knowledge Hub
 */
export class ErrorHandler {
  static init() {
    window.addEventListener('error', (event) => {
      this.showErrorModal(event.error || new Error(event.message))
    })

    window.addEventListener('unhandledrejection', (event) => {
      this.showErrorModal(event.reason || new Error('Unhandled Promise Rejection'))
    })
  }

  static showErrorModal(error: Error | any) {
    console.error('[Global Error]', error)

    const stack = error?.stack || 'No stack trace available'
    const message = error?.message || String(error)

    const content = document.createElement('div')
    content.className = 'error-modal-content'
    content.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="color: var(--text-soft); font-size: 14px; line-height: 1.5;">
                    The application encountered an unexpected error. You can try refreshing the workspace or resetting the state if it persists.
                </div>
                
                <div style="background: rgba(248, 113, 113, 0.1); border-left: 3px solid #f87171; padding: 12px; border-radius: 4px;">
                    <div style="color: #f87171; font-weight: 700; font-size: 13px; margin-bottom: 4px;">ERROR</div>
                    <div style="font-family: monospace; font-size: 12px; color: var(--text-strong); word-break: break-all;">
                        ${this.escapeHtml(message)}
                    </div>
                </div>

                <details style="cursor: pointer;">
                    <summary style="font-size: 12px; color: var(--text-muted); padding: 4px 0; user-select: none;">
                        Show Technical Details
                    </summary>
                    <pre style="background: var(--panel-strong); padding: 12px; border-radius: 4px; overflow: auto; max-height: 200px; font-size: 11px; margin-top: 8px; color: var(--text-soft); border: 1px solid var(--border);">
${this.escapeHtml(stack)}
                    </pre>
                </details>
            </div>
        `

    modalManager.open({
      title: 'Application Error',
      customContent: content,
      size: 'md',
      buttons: [
        {
          label: 'Refresh App',
          variant: 'primary',
          onClick: () => window.location.reload()
        },
        {
          label: 'Copy Details',
          variant: 'ghost',
          onClick: () => {
            navigator.clipboard.writeText(`Error: ${message}\n\nStack:\n${stack}`).then(() => {
              // Maybe a toast later
            })
          }
        },
        {
          label: 'Reset Workspace',
          variant: 'danger',
          onClick: async () => {
            if (confirm('Are you sure? This will reset all local settings and workspace state.')) {
              await window.api.resetSettings()
              window.location.reload()
            }
          }
        },
        {
          label: 'Dismiss',
          variant: 'ghost',
          onClick: (m) => m.close()
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
