export interface RagWorkerJob {
  id: string
  type: 'index' | 'search' | 'init' | 'delete' | 'embed' | 'debug' | 'get-all-metadata'
  payload: any
}

export interface RagWorkerResponse {
  id: string
  success: boolean
  payload?: any
  error?: string
}
