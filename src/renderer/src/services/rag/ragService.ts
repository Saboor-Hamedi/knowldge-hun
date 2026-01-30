import type { RagWorkerJob, RagWorkerResponse } from './worker/rag.worker.types'
import { EmbeddingProvider } from './embedding-provider'
import { LocalEmbeddingProvider } from './local-embedding-provider'
import { ApiEmbeddingProvider } from './api-embedding-provider'

/**
 * Service to manage the RAG Web Worker and Embedding Provider
 * Handles lifecycle of the worker, job dispatching, and embedding generation
 */
export class RagService {
  private worker: Worker | null = null
  private jobs: Map<string, { resolve: (val: unknown) => void; reject: (err: Error) => void }> =
    new Map()
  private embeddingProvider: EmbeddingProvider | null = null
  private initPromise: Promise<void> | null = null

  constructor() {
    this.initWorker()
  }

  /**
   * Configure the embedding provider
   */
  async configureProvider(type: 'local' | 'api', apiKey?: string): Promise<void> {
    if (type === 'local') {
      this.embeddingProvider = new LocalEmbeddingProvider()
    } else {
      if (!apiKey) {
        console.warn('[RagService] API provider selected but no key provided')
        return
      }
      this.embeddingProvider = new ApiEmbeddingProvider(apiKey)
    }

    await this.embeddingProvider.init()
    console.log(`[RagService] Initialized ${type} embedding provider`)
  }

  private initWorker(): void {
    try {
      // Use '?worker' suffix and types-only import for the worker script
      this.worker = new Worker(new URL('./worker/rag.worker.ts', import.meta.url), {
        type: 'module'
      })

      this.worker.onmessage = (event: MessageEvent<RagWorkerResponse>) => {
        const { id, success, payload, error } = event.data
        const job = this.jobs.get(id)

        if (job) {
          if (success) {
            job.resolve(payload)
          } else {
            job.reject(new Error(error))
          }
          this.jobs.delete(id)
        }
      }

      this.worker.onerror = (err) => {
        console.error('[RagService] Worker error:', err)
      }

      console.log('[RagService] Worker initialized')
    } catch (err) {
      console.error('[RagService] Failed to initialize worker:', err)
    }
  }

  /**
   * Dispatch a job to the worker
   */
  public async dispatch<T>(
    type: RagWorkerJob['type'],
    payload: unknown,
    timeoutMs: number = 120000
  ): Promise<T> {
    if (!this.worker) this.initWorker()
    if (!this.worker) throw new Error('RAG Worker not available')

    const id = crypto.randomUUID()

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.jobs.has(id)) {
          this.jobs.delete(id)
          reject(new Error(`RAG Worker timed out (${type})`))
        }
      }, timeoutMs)

      this.jobs.set(id, {
        resolve: (val: unknown) => {
          clearTimeout(timeout)
          resolve(val as T)
        },
        reject: (err: Error) => {
          clearTimeout(timeout)
          reject(err)
        }
      })
      this.worker!.postMessage({ id, type, payload })
    })
  }

  /**
   * Initialize the RAG system (Worker + DB)
   */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      // Init model check can take a long time on cold boot (downloads)
      // We give it 5 minutes instead of 2.
      await this.dispatch('init', {}, 300000)
    })()

    return this.initPromise
  }

  async search(
    query: string,
    limit: number = 5
  ): Promise<{ id: string; score: number; metadata: { title: string; path?: string } }[]> {
    if (!this.embeddingProvider) {
      // RAG is disabled, return empty to trigger TF-IDF fallback
      return []
    }

    try {
      if (this.embeddingProvider instanceof LocalEmbeddingProvider) {
        return this.dispatch('search', { query, limit })
      } else {
        const queryVector = await this.embeddingProvider.embed(query)
        return this.dispatch('search', { queryVector, limit })
      }
    } catch (err) {
      console.error('[RagService] Search failed:', err)
      return []
    }
  }

  async indexNote(
    noteId: string,
    content: string,
    metadata: { title: string; path?: string }
  ): Promise<void> {
    if (!this.embeddingProvider) return

    // Skip indexing if content is empty or only whitespace
    if (!content || !content.trim()) {
      return
    }

    try {
      if (this.embeddingProvider instanceof LocalEmbeddingProvider) {
        await this.dispatch('index', { id: noteId, content, metadata })
      } else {
        const vector = await this.embeddingProvider.embed(content)
        await this.dispatch('index', { id: noteId, vector, metadata })
      }
    } catch (err) {
      console.error(`[RagService] Failed to index note ${noteId}:`, err)
    }
  }

  async deleteNote(noteId: string): Promise<void> {
    try {
      await this.dispatch('delete', { id: noteId })
    } catch (err) {
      console.error(`[RagService] Failed to delete note ${noteId}:`, err)
    }
  }

  async getStats(): Promise<{ count: number; modelLoaded: boolean; dbName: string }> {
    return this.dispatch('debug', {})
  }

  async getAllMetadata(): Promise<Record<string, number>> {
    return this.dispatch('get-all-metadata', {})
  }
}

export const ragService = new RagService()

if (typeof window !== 'undefined') {
  ;(window as any).ragService = ragService
}
