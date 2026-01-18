/**
 * Fetch with a timeout using AbortController.
 */
export async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeout = 15000,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController()

  // If an external signal is provided, abort our controller when it fires
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      const handler = () => controller.abort()
      externalSignal.addEventListener('abort', handler)
      // ensure we don't leak listener after fetch resolves
      const cleanup = () => externalSignal.removeEventListener('abort', handler)
      // attach cleanup after fetch completes below
      ;(init as any).__externalCleanup = cleanup
    }
  }

  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(input, { ...init, signal: controller.signal })
    clearTimeout(id)
    // run cleanup if present
    try { (init as any).__externalCleanup?.() } catch (_) {}
    return res
  } catch (err) {
    clearTimeout(id)
    try { (init as any).__externalCleanup?.() } catch (_) {}
    throw err
  }
}

/**
 * Retry an async function with exponential backoff and full jitter.
 * onRetry callback is optional and receives the attempt number and error.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  attempts = 3,
  initialDelay = 500,
  maxDelay = 10000,
  onRetry?: (attempt: number, err: any) => void
): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      attempt++
      if (attempt >= attempts) throw err
      if (onRetry) onRetry(attempt, err)
      // full jitter: sleep random between 0 and base
      const base = Math.min(maxDelay, initialDelay * Math.pow(2, attempt - 1))
      const jitter = Math.floor(Math.random() * base)
      await new Promise((res) => setTimeout(res, jitter))
    }
  }
}

/**
 * Read the response body stream into text and optionally report progress (bytes received).
 * Returns the full text.
 */
export async function streamToText(
  stream: ReadableStream<Uint8Array> | null,
  onChunk?: (chunk: string) => void,
  onProgress?: (receivedBytes: number) => void
): Promise<string> {
  if (!stream) return ''
  const reader = stream.getReader()
  let result = ''
  let received = 0
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    const chunk = decoder.decode(value, { stream: true })
    result += chunk
    received += value.byteLength
    if (onChunk) onChunk(chunk)
    if (onProgress) onProgress(received)
  }
  // flush
  result += decoder.decode()
  return result
}

/**
 * Perform a fetch with retries for transient failures (HTTP 5xx, 429) using retryWithBackoff.
 * Returns the Response if successful or throws after retries.
 */
export async function requestWithRetries(
  input: RequestInfo,
  init: RequestInit = {},
  options: { timeout?: number; attempts?: number; onRetry?: (attempt: number, err: any) => void } = {}
): Promise<Response> {
  const { timeout = 15000, attempts = 3, onRetry } = options

  return retryWithBackoff(async () => {
    const res = await fetchWithTimeout(input, init, timeout)
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      const errBody = await res.text().catch(() => '')
      const err: any = new Error(`Transient HTTP ${res.status}`)
      err.status = res.status
      err.body = errBody
      throw err
    }
    return res
  }, attempts, 500, 10000, onRetry)
}

/**
 * Parse a simple SSE/event-stream from a fetch response body and call onEvent for each data chunk.
 * Useful for streaming LLM responses that use SSE-style lines (e.g., "data: {...}\n\n").
 */
export async function parseSSE(stream: ReadableStream<Uint8Array> | null, onEvent: (data: string) => void): Promise<void> {
  if (!stream) return
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 2)
      // each block may contain multiple lines like 'data: {...}\ndata: {...}'
      const lines = block.split(/\r?\n/)
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') return
          onEvent(payload)
        }
      }
    }
  }
}

