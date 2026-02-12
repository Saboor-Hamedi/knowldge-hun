export interface GitCommit {
  hash: string
  timestamp: number
  author: string
  subject: string
  body?: string
  parents?: string[]
  refs?: string[]
}

export interface CommitDetails {
  hash: string
  files: { path: string; additions: number; deletions: number }[]
  stats: {
    insertions: number
    deletions: number
    filesChanged: number
  }
}
