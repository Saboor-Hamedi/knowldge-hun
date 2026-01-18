import type { GraphNode, GraphLink } from './types'
import { BASE_NODE_RADIUS, CENTRAL_NODE_RADIUS, MAX_NODE_RADIUS } from './types'

export function getNodeRadius(node: GraphNode, isActive: boolean, isCentral: boolean): number {
  if (node.type === 'tag') {
    return Math.min(MAX_NODE_RADIUS, 5 + Math.sqrt(node.val) * 1.2)
  }
  if (isCentral) {
    return Math.min(MAX_NODE_RADIUS, CENTRAL_NODE_RADIUS + Math.sqrt(node.val) * 3)
  }
  if (isActive) {
    return Math.min(MAX_NODE_RADIUS, Math.max(BASE_NODE_RADIUS + 4 + Math.sqrt(node.val) * 2.5, CENTRAL_NODE_RADIUS - 4 + Math.sqrt(node.val) * 2.5))
  }
  // Give a bonus radius to nodes that have multiple wikilinks
  const wikiBonus = node.wikiLinkCount ? Math.sqrt(node.wikiLinkCount) * 2.2 : 0
  const connectionBonus = (node.connectionCount || 0) * 0.3
  return Math.min(MAX_NODE_RADIUS, BASE_NODE_RADIUS + Math.sqrt(node.val) * 2 + connectionBonus + wikiBonus)
}

export function getNodeColor(node: GraphNode, isActive: boolean, isHovered: boolean, isCentral: boolean, colorScheme: string): string {
  // Tag nodes keep teal coloring
  if (node.type === 'tag') {
    return isActive || isHovered ? '#14b8a6' : 'rgba(20, 184, 166, 0.8)'
  }

  // Highlight nodes that have wikilinks with warm accent
  if (node.hasWikiLinks) {
    return isActive || isHovered ? '#ffb347' : 'rgba(255, 179, 71, 0.95)'
  }

  // Nodes that have tags get a teal-ish emphasis
  if (node.hasTags) {
    return isActive || isHovered ? '#14b8a6' : 'rgba(20, 184, 166, 0.9)'
  }

  if (isCentral || isActive) {
    return '#ffaa00'
  }

  if (isHovered) {
    return '#64bafa'
  }

  if (colorScheme === 'folder' && node.folder) {
    const hash = node.folder.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const hue = hash % 360
    return `hsl(${hue}, 70%, 60%)`
  }

  if (colorScheme === 'connections' && node.connectionCount !== undefined) {
    const count = node.connectionCount
    if (count === 0) return 'rgba(150, 150, 150, 0.6)'
    if (count < 3) return 'rgba(100, 160, 255, 0.8)'
    if (count < 10) return 'rgba(100, 200, 255, 0.9)'
    return 'rgba(255, 200, 100, 0.95)'
  }

  return 'rgba(100, 160, 255, 0.95)'
}

export function searchNodes(allNodes: GraphNode[], query: string): GraphNode[] {
  if (!query.trim()) return []
  const lowerQuery = query.toLowerCase()
  return allNodes.filter(node => {
    return node.title.toLowerCase().includes(lowerQuery) ||
           node.id.toLowerCase().includes(lowerQuery) ||
           (node.tagName && node.tagName.toLowerCase().includes(lowerQuery))
  })
}

export function isNodeVisible(node: GraphNode, zoom: number, panX: number, panY: number, dimensions: { width: number, height: number }): boolean {
  if (node.x === undefined || node.y === undefined) return false
  const screenX = node.x * zoom + panX
  const screenY = node.y * zoom + panY
  const r = getNodeRadius(node, false, false) * zoom
  return screenX + r >= 0 && screenX - r <= dimensions.width &&
         screenY + r >= 0 && screenY - r <= dimensions.height - 60
}

export function findPathBFS(allNodes: GraphNode[], allLinks: GraphLink[], startId: string, endId: string): GraphNode[] | null {
  if (startId === endId) return allNodes.find(n => n.id === startId) ? [allNodes.find(n => n.id === startId)!] : null
  const nodeMap = new Map(allNodes.map(n => [n.id, n]))
  const adjacency = new Map<string, Set<string>>()
  allLinks.forEach(l => {
    const src = typeof l.source === 'string' ? l.source : l.source.id
    const tgt = typeof l.target === 'string' ? l.target : l.target.id
    if (!adjacency.has(src)) adjacency.set(src, new Set())
    if (!adjacency.has(tgt)) adjacency.set(tgt, new Set())
    adjacency.get(src)!.add(tgt)
    adjacency.get(tgt)!.add(src)
  })

  const queue: { id: string; path: string[] }[] = [{ id: startId, path: [startId] }]
  const visited = new Set<string>([startId])
  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    const neighbors = adjacency.get(id) || new Set()
    for (const nb of neighbors) {
      if (visited.has(nb)) continue
      visited.add(nb)
      const newPath = [...path, nb]
      if (nb === endId) return newPath.map(pid => nodeMap.get(pid)!).filter(Boolean) as GraphNode[]
      queue.push({ id: nb, path: newPath })
    }
  }
  return null
}
