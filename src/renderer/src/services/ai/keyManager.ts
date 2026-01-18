export async function loadApiKeyFromSettings(): Promise<string | null> {
  try {
    const settings = await window.api.getSettings()
    return (settings as any)?.deepseekApiKey || null
  } catch (err) {
    console.error('[AI:keyManager] Failed to load API key from settings', err)
    return null
  }
}

export async function saveApiKeyToSettings(token: string): Promise<void> {
  try {
    await window.api.updateSettings({ deepseekApiKey: token })
  } catch (err) {
    console.error('[AI:keyManager] Failed to save API key to settings', err)
    throw err
  }
}

// Validate API key by making a lightweight request to the chat endpoint.
// This may consume a small amount of quota; we keep the request minimal and short-lived.
export async function validateApiKey(token: string, timeout = 5000): Promise<{ valid: boolean; message?: string }> {
  if (!token) return { valid: false, message: 'No API key' }

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      signal: controller.signal
    })
    clearTimeout(id)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { valid: false, message: body.error?.message || `HTTP ${res.status}` }
    }
    return { valid: true }
  } catch (err: any) {
    clearTimeout(id)
    if (err.name === 'AbortError') return { valid: false, message: 'Timeout' }
    return { valid: false, message: err.message || 'Validation failed' }
  }
}
