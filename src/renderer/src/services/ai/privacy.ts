// Lightweight privacy helpers for AI features.
// Lightweight privacy helpers for AI features.
// Helpers try to use an optional secure store exposed on `window.api` (main process)
// if available. Otherwise fall back to saving in settings (not recommended for
// high-security scenarios).

export async function isTelemetryEnabled(): Promise<boolean> {
  try {
    const s = await window.api.getSettings()
    return Boolean((s as any)?.telemetryEnabled) || false
  } catch (err) {
    console.error('[AI:privacy] Failed to read telemetry setting', err)
    return false
  }
}

export async function setTelemetryOptIn(enabled: boolean): Promise<void> {
  try {
    await window.api.updateSettings({ telemetryEnabled: enabled })
  } catch (err) {
    console.error('[AI:privacy] Failed to save telemetry preference', err)
  }
}

// Save API key, preferring an OS secure store if `window.api.storeSecret` is available.
export async function saveKeySecurely(token: string): Promise<void> {
  try {
    const apiAny = (window as any).api
    if (apiAny && typeof apiAny.storeSecret === 'function') {
      await apiAny.storeSecret('deepseekApiKey', token)
      return
    }
    // Fallback: persist in settings (less secure)
    await window.api.updateSettings({ deepseekApiKey: token })
  } catch (err) {
    console.error('[AI:privacy] Failed to save API key securely', err)
    throw err
  }
}

// Load API key from secure store if available, otherwise from settings.
export async function loadKeySecurely(): Promise<string | null> {
  try {
    const apiAny = (window as any).api
    if (apiAny && typeof apiAny.getSecret === 'function') {
      const val = await apiAny.getSecret('deepseekApiKey')
      return val || null
    }
    const s = await window.api.getSettings()
    return (s as any)?.deepseekApiKey || null
  } catch (err) {
    console.error('[AI:privacy] Failed to load API key', err)
    return null
  }
}

export async function clearKeySecurely(): Promise<void> {
  try {
    const apiAny = (window as any).api
    if (apiAny && typeof apiAny.deleteSecret === 'function') {
      await apiAny.deleteSecret('deepseekApiKey')
      return
    }
    await window.api.updateSettings({ deepseekApiKey: '' })
  } catch (err) {
    console.error('[AI:privacy] Failed to clear API key', err)
    throw err
  }
}

// Mask a key for UI display (keep first/last 4 chars)
export function maskKey(token: string | null): string {
  if (!token) return ''
  if (token.length <= 8) return '•'.repeat(Math.max(4, token.length))
  const first = token.slice(0, 4)
  const last = token.slice(-4)
  return `${first}${'•'.repeat(8)}${last}`
}

