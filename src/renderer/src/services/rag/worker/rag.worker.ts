import { VectorDB } from './vector-db'
import * as Transformers from '@xenova/transformers'
import type { RagWorkerJob } from './rag.worker.types'

const env = (Transformers as any).env || (Transformers as any).default?.env || (Transformers as any)
if (env) {
  env.allowLocalModels = false
  env.allowRemoteModels = true
  env.useBrowserCache = false
  env.remoteHost = 'https://huggingface.co'
  env.remotePrefix = 'models/'
}

const db = new VectorDB()
let extractor: any = null

let initPromise: Promise<void> | null = null

async function initModel(): Promise<void> {
  if (extractor) return

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      console.log('[RagWorker] Pipeline loading...')
      extractor = await (Transformers as any).pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          quantized: false
        }
      )
      console.log('[RagWorker] Pipeline ready')
    } catch (err: any) {
      console.error('[RagWorker] Init error:', err)
      // Reset promise so we can retry later
      initPromise = null
      throw err
    }
  })()

  return initPromise
}

// Basic cosine similarity function for vector comparison
export function cosineSimilarity(
  vecA: Float32Array | number[],
  vecB: Float32Array | number[]
): number {
  if (vecA.length !== vecB.length) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

const ctx: Worker = self as any

ctx.addEventListener('message', async (event: MessageEvent<RagWorkerJob>) => {
  const { id, type, payload } = event.data

  try {
    let result: any

    switch (type) {
      case 'init':
        await db.connect()
        await initModel()
        result = { status: 'ready' }
        break

      case 'embed': {
        const { text } = payload
        if (!extractor) await initModel()
        const output = await extractor(text, { pooling: 'mean', normalize: true })
        result = Array.from(output.data)
        break
      }

      case 'search': {
        let { queryVector, query, limit = 5 } = payload
        if (query && !queryVector) {
          if (!extractor) await initModel()
          const output = await extractor(query, { pooling: 'mean', normalize: true })
          queryVector = Array.from(output.data)
        }
        if (!queryVector) throw new Error('No search vector provided')
        const queryVec = new Float32Array(queryVector)
        const candidates: { id: string; score: number; metadata: any }[] = []
        await db.iterate((record) => {
          const score = cosineSimilarity(queryVec, record.vector)
          if (score > 0.1) {
            candidates.push({ id: record.id, score, metadata: record.metadata })
          }
        })
        candidates.sort((a, b) => b.score - a.score)
        result = candidates.slice(0, limit)
        break
      }

      case 'index': {
        const { id, vector, content, metadata } = payload
        let finalVector = vector
        if (content && !finalVector) {
          if (!extractor) await initModel()
          const output = await extractor(content, { pooling: 'mean', normalize: true })
          finalVector = Array.from(output.data)
        }
        if (!finalVector) throw new Error('No vector or content provided for indexing')
        await db.upsert({
          id,
          vector: new Float32Array(finalVector),
          metadata: { ...metadata, path: metadata.path || '' },
          updatedAt: Date.now()
        })
        result = { indexed: true, id }
        break
      }

      case 'delete': {
        const { id } = payload
        await db.delete(id)
        result = { deleted: true, id }
        break
      }

      case 'debug': {
        await db.connect()
        let lastError: string | undefined
        // Try to verify/kickstart model if not loaded
        if (!extractor) {
          try {
            await initModel()
          } catch (e: any) {
            lastError = e.message || String(e)
          }
        }

        const count = await db.count()
        result = {
          count,
          modelLoaded: !!extractor,
          dbName: 'knowledge-hub-vectors',
          lastError
        }
        break
      }

      case 'get-all-metadata': {
        await db.connect()
        const meta = await db.getAllMetadata()
        // Convert Map to Object for serialization
        result = Object.fromEntries(meta)
        break
      }

      default:
        throw new Error(`Unknown job type: ${type}`)
    }

    ctx.postMessage({
      id,
      success: true,
      payload: result
    })
  } catch (err: any) {
    ctx.postMessage({
      id,
      success: false,
      error: err.message || 'Unknown worker error'
    })
  }
})
