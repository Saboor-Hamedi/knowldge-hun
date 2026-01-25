export interface RagWorkerJob {
  id: string
  type: 'index' | 'search' | 'init' | 'delete' | 'embed' | 'debug'
  payload: any
}

export interface RagWorkerResponse {
  id: string
  success: boolean
  payload?: any
  error?: string
}
