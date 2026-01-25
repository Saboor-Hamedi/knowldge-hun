export interface VectorRecord {
  id: string
  vector: Float32Array // efficient storage
  metadata: {
    title: string
    path: string
    [key: string]: any
  }
  updatedAt: number
}

export class VectorDB {
  private dbName = 'knowledgehub-rag'
  private version = 1
  private storeName = 'vectors'
  private db: IDBDatabase | null = null

  async connect(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = (): void => {
        console.error('[VectorDB] Database error:', request.error)
        reject(request.error)
      }

      request.onupgradeneeded = (event): void => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' })
        }
      }

      request.onsuccess = (event): void => {
        this.db = (event.target as IDBOpenDBRequest).result
        resolve()
      }
    })
  }

  async upsert(record: VectorRecord): Promise<void> {
    await this.ensureConnection()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put(record)

      request.onsuccess = (): void => resolve()
      request.onerror = (): void => {
        console.error('[VectorDB] Upsert error:', request.error)
        reject(request.error)
      }
    })
  }

  async delete(id: string): Promise<void> {
    await this.ensureConnection()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(id)

      request.onsuccess = (): void => resolve()
      request.onerror = (): void => reject(request.error)
    })
  }

  async get(id: string): Promise<VectorRecord | undefined> {
    await this.ensureConnection()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(id)

      request.onsuccess = (): void => resolve(request.result)
      request.onerror = (): void => reject(request.error)
      request.onerror = (): void => reject(request.error)
    })
  }

  async count(): Promise<number> {
    await this.ensureConnection()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.count()

      request.onsuccess = (): void => resolve(request.result)
      request.onerror = (): void => reject(request.error)
    })
  }

  /**
   * Opens a cursor to iterate over all vectors.
   * This is memory efficient for searching large datasets.
   */
  async iterate(callback: (record: VectorRecord) => void): Promise<void> {
    await this.ensureConnection()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.openCursor()

      request.onsuccess = (event): void => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          callback(cursor.value)
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = (): void => reject(request.error)
    })
  }

  private async ensureConnection(): Promise<void> {
    if (!this.db) {
      await this.connect()
    }
  }
}
