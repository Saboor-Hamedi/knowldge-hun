export type GraphNode = {
  id: string
  title: string
  noteId?: string
  tagName?: string
  val: number
  ageFactor: number
  type: 'note' | 'tag'
  folder?: string
  connectionCount?: number
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
  highlighted?: boolean
  searchMatch?: boolean
  pathNode?: boolean
  hasWikiLinks?: boolean
  hasTags?: boolean
  wikiLinkCount?: number
  pinned?: boolean
}

export type GraphLink = {
  source: string | GraphNode
  target: string | GraphNode
  type?: 'wikilink' | 'tag' | 'direct'
}

export type GraphStats = {
  totalNodes: number
  totalLinks: number
  orphanNodes: number
  hubNodes: number
  tagCount: number
  noteCount: number
}

// Performance constants
export const MAX_VISIBLE_NODES = 5000
export const MIN_NODE_RADIUS = 3
export const MAX_NODE_RADIUS = 30
export const BASE_NODE_RADIUS = 6
export const TAG_NODE_RADIUS = 5
export const CENTRAL_NODE_RADIUS = 22
export const ANIMATION_SPEED = 0.02
