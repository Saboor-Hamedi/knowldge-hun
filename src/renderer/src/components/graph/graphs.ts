import { state } from '../../core/state'
import { forceSimulation, forceLink, forceManyBody, forceRadial, forceCenter } from 'd3-force'
import { createElement, Network, Globe, Focus, Atom, Search, Download, BarChart3, X, Maximize2, RotateCcw, Home } from 'lucide'
import { extractWikiLinks, extractTags } from '../../utils/helpers'
import '../window-header/window-header.css'
import './graph.css'

type GraphNode = {
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
}

type GraphLink = {
  source: string | GraphNode
  target: string | GraphNode
  type?: 'wikilink' | 'tag' | 'direct'
}

type GraphStats = {
  totalNodes: number
  totalLinks: number
  orphanNodes: number
  hubNodes: number
  tagCount: number
  noteCount: number
}

// Performance constants
const MAX_VISIBLE_NODES = 5000
const MIN_NODE_RADIUS = 3
const MAX_NODE_RADIUS = 30
const BASE_NODE_RADIUS = 6
const TAG_NODE_RADIUS = 5
const CENTRAL_NODE_RADIUS = 22
const ANIMATION_SPEED = 0.02

// Simple Quadtree for spatial indexing
class QuadTree {
  private bounds: { x: number; y: number; width: number; height: number }
  private nodes: GraphNode[] = []
  private divided = false
  private nw?: QuadTree
  private ne?: QuadTree
  private sw?: QuadTree
  private se?: QuadTree
  private capacity = 4

  constructor(bounds: { x: number; y: number; width: number; height: number }) {
    this.bounds = bounds
  }

  insert(node: GraphNode): boolean {
    if (node.x === undefined || node.y === undefined) return false
    if (!this.contains(node.x, node.y)) return false

    if (this.nodes.length < this.capacity) {
      this.nodes.push(node)
      return true
    }

    if (!this.divided) {
      this.subdivide()
    }

    return (this.nw?.insert(node) || this.ne?.insert(node) ||
            this.sw?.insert(node) || this.se?.insert(node)) || false
  }

  private subdivide(): void {
    const x = this.bounds.x
    const y = this.bounds.y
    const w = this.bounds.width / 2
    const h = this.bounds.height / 2

    this.nw = new QuadTree({ x, y, width: w, height: h })
    this.ne = new QuadTree({ x: x + w, y, width: w, height: h })
    this.sw = new QuadTree({ x, y: y + h, width: w, height: h })
    this.se = new QuadTree({ x: x + w, y: y + h, width: w, height: h })
    this.divided = true

    for (const node of this.nodes) {
      this.nw?.insert(node) || this.ne?.insert(node) ||
      this.sw?.insert(node) || this.se?.insert(node)
    }
    this.nodes = []
  }

  query(range: { x: number; y: number; width: number; height: number }, found: GraphNode[] = []): GraphNode[] {
    if (!this.intersects(range)) return found

    for (const node of this.nodes) {
      if (node.x !== undefined && node.y !== undefined &&
          node.x >= range.x && node.x <= range.x + range.width &&
          node.y >= range.y && node.y <= range.y + range.height) {
        found.push(node)
      }
    }

    if (this.divided) {
      this.nw?.query(range, found)
      this.ne?.query(range, found)
      this.sw?.query(range, found)
      this.se?.query(range, found)
    }

    return found
  }

  private contains(x: number, y: number): boolean {
    return x >= this.bounds.x && x <= this.bounds.x + this.bounds.width &&
           y >= this.bounds.y && y <= this.bounds.y + this.bounds.height
  }

  private intersects(range: { x: number; y: number; width: number; height: number }): boolean {
    return !(range.x > this.bounds.x + this.bounds.width ||
             range.x + range.width < this.bounds.x ||
             range.y > this.bounds.y + this.bounds.height ||
             range.y + range.height < this.bounds.y)
  }
}

export class GraphView {
  private container: HTMLElement
  private overlay: HTMLElement | null = null
  private isOpen = false
  private activeMode: 'universe' | 'neighborhood' | 'orb' = 'universe'
  private graphLinks: { source: string; target: string }[] = []
  private simulation: any = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private hoverNode: GraphNode | null = null
  private selectedNote = () => state.notes.find(n => n.id === state.activeId)
  private dimensions = { width: 0, height: 0 }
  private zoom = 1
  private panX = 0
  private panY = 0
  private isDragging = false
  private isDraggingNode = false
  private draggedNode: GraphNode | null = null
  private dragStartX = 0
  private dragStartY = 0
  private allNodes: GraphNode[] = []
  private allLinks: GraphLink[] = []
  private visibleNodes: GraphNode[] = []
  private visibleLinks: GraphLink[] = []
  private animationFrameId: number | null = null
  private lastDrawTime = 0
  private noteContentCache = new Map<string, string>()
  private quadTree: QuadTree | null = null
  private animationTime = 0
  private linkParticles = new Map<string, number>()

  // New features
  private searchQuery = ''
  private searchResults: GraphNode[] = []
  private pathStart: GraphNode | null = null
  private pathEnd: GraphNode | null = null
  private pathNodes: Set<string> = new Set()
  private showStats = false
  private showFilters = false
  private filterTags: Set<string> = new Set()
  private filterFolders: Set<string> = new Set()
  private minConnections = 0
  private colorScheme: 'default' | 'folder' | 'tag' | 'connections' = 'default'
  private stats: GraphStats = {
    totalNodes: 0,
    totalLinks: 0,
    orphanNodes: 0,
    hubNodes: 0,
    tagCount: 0,
    noteCount: 0
  }

  constructor() {
    this.container = document.getElementById('app') as HTMLElement
  }

  open(): void {
    if (this.isOpen) return
    this.isOpen = true
    this.render()
    void this.loadGraphData()
    this.attachEvents()
  }

  close(): void {
    if (!this.isOpen) return
    this.isOpen = false

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    if (this.simulation) {
      this.simulation.stop()
      this.simulation = null
    }

    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }

    this.canvas = null
    this.ctx = null
    this.allNodes = []
    this.allLinks = []
    this.visibleNodes = []
    this.visibleLinks = []
    this.noteContentCache.clear()
    this.quadTree = null
    this.searchQuery = ''
    this.searchResults = []
    this.pathStart = null
    this.pathEnd = null
    this.pathNodes.clear()

    // Reset state
    this.zoom = 1
    this.panX = 0
    this.panY = 0
    this.hoverNode = null
    this.draggedNode = null
  }

  private async loadGraphData(): Promise<void> {
    try {
      const data = await window.api?.getGraph()
      this.graphLinks = data?.links || []
      await this.buildGraphData()
      this.calculateStats()
      this.updateSimulation()
    } catch (err) {
      console.error('Failed to load graph data', err)
    }
  }

  private async loadNoteContent(noteId: string): Promise<string | null> {
    if (this.noteContentCache.has(noteId)) {
      return this.noteContentCache.get(noteId) || null
    }
    try {
      const note = await window.api?.loadNote(noteId)
      const content = note?.content || null
      if (content) {
        this.noteContentCache.set(noteId, content)
      }
      return content
    } catch {
      return null
    }
  }

  // Calculate graph statistics
  private calculateStats(): void {
    const noteNodes = this.allNodes.filter(n => n.type === 'note')
    const tagNodes = this.allNodes.filter(n => n.type === 'tag')

    // Calculate connection counts
    const connectionMap = new Map<string, number>()
    this.allLinks.forEach(link => {
      const src = typeof link.source === 'string' ? link.source : link.source.id
      const tgt = typeof link.target === 'string' ? link.target : link.target.id
      connectionMap.set(src, (connectionMap.get(src) || 0) + 1)
      connectionMap.set(tgt, (connectionMap.get(tgt) || 0) + 1)
    })

    noteNodes.forEach(node => {
      node.connectionCount = connectionMap.get(node.id) || 0
    })

    const orphanNodes = noteNodes.filter(n => (n.connectionCount || 0) === 0)
    const hubNodes = noteNodes.filter(n => (n.connectionCount || 0) >= 10)

    this.stats = {
      totalNodes: this.allNodes.length,
      totalLinks: this.allLinks.length,
      orphanNodes: orphanNodes.length,
      hubNodes: hubNodes.length,
      tagCount: tagNodes.length,
      noteCount: noteNodes.length
    }
  }

  // Path finding using BFS
  private findPath(start: GraphNode, end: GraphNode): GraphNode[] | null {
    if (start.id === end.id) return [start]

    const queue: { node: GraphNode; path: GraphNode[] }[] = [{ node: start, path: [start] }]
    const visited = new Set<string>([start.id])
    const nodeMap = new Map(this.allNodes.map(n => [n.id, n]))
    const adjacencyList = new Map<string, Set<string>>()

    // Build adjacency list
    this.allLinks.forEach(link => {
      const src = typeof link.source === 'string' ? link.source : link.source.id
      const tgt = typeof link.target === 'string' ? link.target : link.target.id
      if (!adjacencyList.has(src)) adjacencyList.set(src, new Set())
      if (!adjacencyList.has(tgt)) adjacencyList.set(tgt, new Set())
      adjacencyList.get(src)!.add(tgt)
      adjacencyList.get(tgt)!.add(src)
    })

    while (queue.length > 0) {
      const { node, path } = queue.shift()!

      const neighbors = adjacencyList.get(node.id) || new Set()
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue
        visited.add(neighborId)

        const neighbor = nodeMap.get(neighborId)
        if (!neighbor) continue

        const newPath = [...path, neighbor]
        if (neighbor.id === end.id) {
          return newPath
        }

        queue.push({ node: neighbor, path: newPath })
      }
    }

    return null
  }

  // Search nodes
  private searchNodes(query: string): GraphNode[] {
    if (!query.trim()) return []
    const lowerQuery = query.toLowerCase()
    return this.allNodes.filter(node => {
      return node.title.toLowerCase().includes(lowerQuery) ||
             node.id.toLowerCase().includes(lowerQuery) ||
             (node.tagName && node.tagName.toLowerCase().includes(lowerQuery))
    })
  }

  // DRY: Calculate node radius
  private getNodeRadius(node: GraphNode, isActive: boolean, isCentral: boolean): number {
    if (node.type === 'tag') {
      return Math.min(MAX_NODE_RADIUS, TAG_NODE_RADIUS + Math.sqrt(node.val) * 1.2)
    }
    if (isCentral) {
      // Central node is significantly bigger
      return Math.min(MAX_NODE_RADIUS, CENTRAL_NODE_RADIUS + Math.sqrt(node.val) * 3)
    }
    if (isActive) {
      // Active node is bigger than normal
      return Math.min(MAX_NODE_RADIUS, BASE_NODE_RADIUS + 4 + Math.sqrt(node.val) * 2.5)
    }
    // Vary size based on connection count for more visual interest
    const connectionBonus = (node.connectionCount || 0) * 0.3
    return Math.min(MAX_NODE_RADIUS, BASE_NODE_RADIUS + Math.sqrt(node.val) * 2 + connectionBonus)
  }

  // DRY: Check if node is visible in viewport
  private isNodeVisible(node: GraphNode): boolean {
    if (node.x === undefined || node.y === undefined) return false

    const screenX = node.x * this.zoom + this.panX
    const screenY = node.y * this.zoom + this.panY
    const r = this.getNodeRadius(node, false, false) * this.zoom

    return screenX + r >= 0 && screenX - r <= this.dimensions.width &&
           screenY + r >= 0 && screenY - r <= this.dimensions.height - 60
  }

  // DRY: Filter visible nodes and links based on viewport
  private updateVisibleElements(): void {
    if (this.allNodes.length === 0) return

    // Apply filters - for search, we keep nodes but mark them as hidden
    let filtered = this.allNodes.map(node => {
      // Search filter - mark non-matching nodes but don't filter them out completely
      // so their links can still be visible
      if (this.searchQuery && !node.searchMatch) {
        node.highlighted = false
      } else if (this.searchQuery && node.searchMatch) {
        node.highlighted = true
      }
      return node
    }).filter(node => {
      // Only filter out nodes that don't match search (but links will still show)
      if (this.searchQuery && !node.searchMatch) {
        // Keep node in data but mark as hidden for rendering
        return false
      }

      // Tag filter
      if (this.filterTags.size > 0 && node.type === 'note') {
        const note = state.notes.find(n => n.id === node.noteId)
        if (note) {
          const content = this.noteContentCache.get(note.id) || ''
          const tags = extractTags(content)
          const hasTag = tags.some(t => this.filterTags.has(t.toLowerCase()))
          if (!hasTag) return false
        }
      }

      // Folder filter
      if (this.filterFolders.size > 0 && node.type === 'note') {
        const note = state.notes.find(n => n.id === node.noteId)
        if (note && note.path) {
          if (!this.filterFolders.has(note.path)) return false
        } else if (this.filterFolders.size > 0) {
          return false
        }
      }

      // Connection filter
      if (node.connectionCount !== undefined && node.connectionCount < this.minConnections) {
        return false
      }

      return true
    })

    // Viewport culling - only show nodes in view
    this.visibleNodes = filtered.filter(node => this.isNodeVisible(node))

    // Limit visible nodes for performance
    if (this.visibleNodes.length > MAX_VISIBLE_NODES) {
      this.visibleNodes.sort((a, b) => b.val - a.val)
      this.visibleNodes = this.visibleNodes.slice(0, MAX_VISIBLE_NODES)
    }

    // Filter links - for search, show links even if one node is hidden
    const visibleNodeIds = new Set(this.visibleNodes.map(n => n.id))
    const searchMatchedIds = this.searchQuery ? new Set(this.searchResults.map(n => n.id)) : new Set(this.allNodes.map(n => n.id))

    this.visibleLinks = this.allLinks.filter(link => {
      const src = typeof link.source === 'string' ? link.source : link.source.id
      const tgt = typeof link.target === 'string' ? link.target : link.target.id

      // If searching, show links if at least one node matches search
      if (this.searchQuery) {
        return searchMatchedIds.has(src) || searchMatchedIds.has(tgt)
      }

      // Normal filtering - both nodes must be visible
      return visibleNodeIds.has(src) && visibleNodeIds.has(tgt)
    })

    // Update quadtree for spatial indexing
    this.updateQuadTree()
  }

  private updateQuadTree(): void {
    if (this.allNodes.length === 0) return

    const bounds = {
      x: -1000,
      y: -1000,
      width: 2000,
      height: 2000
    }

    this.quadTree = new QuadTree(bounds)
    this.allNodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        this.quadTree?.insert(node)
      }
    })
  }

  private async buildGraphData(): Promise<void> {
    if (!this.canvas || !this.ctx) return

    const notes = state.notes
    const nodeMap = new Map<string, GraphNode>()
    const tagMap = new Map<string, GraphNode>()
    const nodes: GraphNode[] = []
    const links: GraphLink[] = []

    // Create note nodes
    notes.forEach(note => {
      const node: GraphNode = {
        id: note.id,
        title: note.title,
        noteId: note.id,
        val: 1,
        ageFactor: 0.5,
        type: 'note',
        folder: note.path || 'root'
      }
      nodeMap.set(note.id, node)
      nodes.push(node)
    })

    // Create links from vault
    this.graphLinks.forEach(link => {
      const sourceNode = nodeMap.get(link.source)
      const targetNode = nodeMap.get(link.target)
      if (sourceNode && targetNode) {
        links.push({ source: sourceNode, target: targetNode, type: 'direct' })
        sourceNode.val += 1
        targetNode.val += 1
      }
    })

    // Load note contents in batches
    const batchSize = 50
    for (let i = 0; i < notes.length; i += batchSize) {
      const batch = notes.slice(i, i + batchSize)
      await Promise.all(batch.map(async note => {
        const content = await this.loadNoteContent(note.id)
        if (!content) return

        const sourceNode = nodeMap.get(note.id)
        if (!sourceNode) return

        // Extract and process wikilinks
        const wikiLinks = extractWikiLinks(content)
        wikiLinks.forEach(wikiLink => {
          const targetNote = notes.find(n =>
            n.id.toLowerCase() === wikiLink.toLowerCase() ||
            n.title.toLowerCase() === wikiLink.toLowerCase()
          )
          if (targetNote) {
            const targetNode = nodeMap.get(targetNote.id)
            if (targetNode && sourceNode !== targetNode) {
              const exists = links.some(l => {
                const src = typeof l.source === 'string' ? l.source : l.source.id
                const tgt = typeof l.target === 'string' ? l.target : l.target.id
                return (src === sourceNode.id && tgt === targetNode.id) ||
                       (src === targetNode.id && tgt === sourceNode.id)
              })
              if (!exists) {
                links.push({ source: sourceNode, target: targetNode, type: 'wikilink' })
                sourceNode.val += 0.5
                targetNode.val += 0.5
              }
            }
          }
        })

        // Extract and process tags
        const tags = extractTags(content)
        tags.forEach(tag => {
          let tagNode = tagMap.get(tag)
          if (!tagNode) {
            tagNode = {
              id: `tag:${tag}`,
              title: `#${tag}`,
              tagName: tag,
              val: 1,
              ageFactor: 0.3,
              type: 'tag'
            }
            tagMap.set(tag, tagNode)
            nodes.push(tagNode)
          }
          links.push({ source: sourceNode, target: tagNode, type: 'tag' })
          sourceNode.val += 0.3
          tagNode.val += 0.3
        })
      }))
    }

    // Calculate age factors
    const now = Date.now()
    const maxAge = 30 * 24 * 60 * 60 * 1000
    nodes.forEach(n => {
      if (n.noteId) {
        const note = notes.find(nn => nn.id === n.noteId)
        if (note) {
          const age = now - (note.updatedAt || now)
          n.ageFactor = Math.min(1, age / maxAge)
        }
      }
    })

    this.allNodes = nodes
    this.allLinks = links
  }

  private filterGraphData(): { nodes: GraphNode[], links: GraphLink[] } {
    let filteredNodes = this.allNodes
    let filteredLinks = this.allLinks
    const selected = this.selectedNote()

    // Apply search highlighting
    if (this.searchQuery) {
      this.searchResults = this.searchNodes(this.searchQuery)
      const searchIds = new Set(this.searchResults.map(n => n.id))
      this.allNodes.forEach(n => {
        n.searchMatch = searchIds.has(n.id)
      })
      filteredNodes = this.allNodes.filter(n => !this.searchQuery || n.searchMatch)
    } else {
      this.allNodes.forEach(n => {
        n.searchMatch = true
      })
    }

    // Filter for neighborhood mode
    if (this.activeMode === 'neighborhood' && selected) {
      const neighbors = new Set([selected.id])
      this.allLinks.forEach(l => {
        const src = typeof l.source === 'string' ? l.source : l.source.id
        const tgt = typeof l.target === 'string' ? l.target : l.target.id
        if (src === selected.id) neighbors.add(tgt)
        if (tgt === selected.id) neighbors.add(src)
      })
      filteredNodes = filteredNodes.filter(n => neighbors.has(n.id))
      filteredLinks = filteredLinks.filter(l => {
        const src = typeof l.source === 'string' ? l.source : l.source.id
        const tgt = typeof l.target === 'string' ? l.target : l.target.id
        return neighbors.has(src) && neighbors.has(tgt)
      })
    }

    return { nodes: filteredNodes, links: filteredLinks }
  }

  private initializeNodePositions(nodes: GraphNode[]): void {
    const selected = this.selectedNote()
    const centerX = this.dimensions.width / 2
    const centerY = (this.dimensions.height - 60) / 2

    nodes.forEach((node, i) => {
      if (node.x === undefined || node.y === undefined || isNaN(node.x) || isNaN(node.y)) {
        if (this.activeMode === 'orb' && selected && node.noteId === selected.id) {
          node.x = centerX
          node.y = centerY
        } else {
          const angle = (i / Math.max(1, nodes.length)) * 2 * Math.PI
          const radius = Math.min(400, 100 + nodes.length * 1.5)
          node.x = centerX + radius * Math.cos(angle)
          node.y = centerY + radius * Math.sin(angle)
        }
        node.vx = 0
        node.vy = 0
      }
      // Keep nodes pinned if user has dragged them (fx/fy are set)
      // Only reset unpinned nodes
      if (node !== this.draggedNode) {
        const isCentral = this.activeMode === 'orb' && selected && node.noteId === selected.id
        if (isCentral) {
          // Central node should be pinned at center
          node.fx = centerX
          node.fy = centerY
        } else if (node.fx === null && node.fy === null) {
          // Node is not pinned, initialize position normally
          // Don't change fx/fy if they're already set (user dragged the node)
        }
        // If fx/fy are set (not null), keep them - user dragged the node
      }
    })
  }

  private updateSimulation(): void {
    if (!this.canvas || !this.ctx) return
    if (this.isDraggingNode && this.draggedNode) return

    const { nodes, links } = this.filterGraphData()

    if (this.simulation) {
      this.simulation.stop()
      this.simulation.on('tick', null)
      this.simulation.on('end', null)
    }

    this.initializeNodePositions(nodes)

    const selected = this.selectedNote()
    if (this.activeMode === 'orb' && selected) {
      const centerNode = nodes.find(n => n.noteId === selected.id)
      if (centerNode && centerNode !== this.draggedNode) {
        if (!centerNode.x || !centerNode.y || isNaN(centerNode.x) || isNaN(centerNode.y)) {
          centerNode.x = this.dimensions.width / 2
          centerNode.y = (this.dimensions.height - 60) / 2
        }
        centerNode.fx = centerNode.x
        centerNode.fy = centerNode.y
        centerNode.vx = 0
        centerNode.vy = 0
      }
    }

    const nodeCount = nodes.length
    const linkDistance = Math.max(50, Math.min(150, 2000 / Math.sqrt(nodeCount)))
    const chargeStrength = Math.max(-200, Math.min(-800, -100 * Math.sqrt(nodeCount)))
    const centerStrength = nodeCount > 1000 ? 0.02 : 0.05

    this.simulation = forceSimulation(nodes)
      .force('link', forceLink(links).id((d: any) => d.id).distance(linkDistance).strength(0.8))
      .force('charge', forceManyBody().strength(chargeStrength))
      .force('center', forceCenter(this.dimensions.width / 2, (this.dimensions.height - 60) / 2).strength(centerStrength))
      .alphaDecay(0.022)
      .velocityDecay(0.6)
      .alpha(0.3)

    if (this.activeMode === 'orb' && selected) {
      const centerNode = nodes.find(n => n.noteId === selected.id)
      if (centerNode && centerNode.x !== undefined && centerNode.y !== undefined) {
        this.simulation.force('radial', forceRadial((d: any) => {
          if (d.id === selected.id) return 0
          return (d.ageFactor || 0.5) * 200
        }, centerNode.x, centerNode.y).strength(0.9))
      } else {
        this.simulation.force('radial', forceRadial((d: any) => (d.ageFactor || 0.5) * 150, this.dimensions.width / 2, (this.dimensions.height - 60) / 2).strength(0.8))
      }
    } else if (this.activeMode === 'neighborhood') {
      this.simulation.force('radial', forceRadial((d: any) => (d.ageFactor || 0.5) * 150, this.dimensions.width / 2, (this.dimensions.height - 60) / 2).strength(0.8))
    } else {
      this.simulation.force('radial', forceRadial((d: any) => (d.ageFactor || 0.5) * 450, this.dimensions.width / 2, (this.dimensions.height - 60) / 2).strength(0.4))
    }

    this.updateVisibleElements()

    this.simulation.on('tick', () => {
      if (this.isDraggingNode && this.draggedNode) return

      this.updateVisibleElements()

      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId)
      }

      this.animationFrameId = requestAnimationFrame(() => {
        const now = performance.now()
        if (now - this.lastDrawTime > 16) {
          this.animationTime += ANIMATION_SPEED
          if (this.animationTime > 1) this.animationTime = 0
          this.drawGraph()
          this.lastDrawTime = now
        }
        this.animationFrameId = null
      })
    })

    this.simulation.on('end', () => {
      this.updateVisibleElements()
      this.drawGraph()
    })

    this.drawGraph()
    this.simulation.alpha(1).restart()

    setTimeout(() => {
      if (this.simulation && !this.isDraggingNode) {
        this.simulation.alphaTarget(0.1)
        this.simulation.restart()
      }
    }, 3000)

    if (selected && this.overlay) {
      const focusInfo = this.overlay.querySelector('#focus-info') as HTMLElement
      if (focusInfo) {
        focusInfo.style.display = 'block'
        focusInfo.innerHTML = `Focusing: <strong>${selected.title}</strong>`
      }
    }
  }

  // Graph controls
  private fitToScreen(): void {
    if (this.allNodes.length === 0) return

    const nodes = this.visibleNodes.length > 0 ? this.visibleNodes : this.allNodes
    const positions = nodes.filter(n => n.x !== undefined && n.y !== undefined)

    if (positions.length === 0) return

    const xs = positions.map(n => n.x!)
    const ys = positions.map(n => n.y!)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    const graphWidth = maxX - minX
    const graphHeight = maxY - minY
    const padding = 50

    const scaleX = (this.dimensions.width - padding * 2) / graphWidth
    const scaleY = (this.dimensions.height - 60 - padding * 2) / graphHeight
    this.zoom = Math.min(scaleX, scaleY, 5)

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    this.panX = this.dimensions.width / 2 - centerX * this.zoom
    this.panY = (this.dimensions.height - 60) / 2 - centerY * this.zoom

    this.updateVisibleElements()
    this.drawGraph()
  }

  private resetView(): void {
    this.zoom = 1
    this.panX = 0
    this.panY = 0
    this.updateVisibleElements()
    this.drawGraph()
  }

  private centerOnSelected(): void {
    const selected = this.selectedNote()
    if (!selected) return

    const node = this.allNodes.find(n => n.noteId === selected.id)
    if (!node || node.x === undefined || node.y === undefined) return

    this.panX = this.dimensions.width / 2 - node.x * this.zoom
    this.panY = (this.dimensions.height - 60) / 2 - node.y * this.zoom

    this.updateVisibleElements()
    this.drawGraph()
  }

  // Export graph
  private exportGraph(format: 'png' | 'svg'): void {
    if (!this.canvas) return

    if (format === 'png') {
      const dataUrl = this.canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `graph-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } else {
      // SVG export would require converting canvas to SVG
      // For now, just export PNG
      this.exportGraph('png')
    }
  }

  private render(): void {
    if (this.overlay) return

    this.dimensions = {
      width: window.innerWidth * 0.95,
      height: window.innerHeight * 0.92
    }

    const folders = Array.from(new Set(state.notes.map(n => n.path || 'root')))
    const allTags = new Set<string>()
    this.allNodes.forEach(n => {
      if (n.tagName) allTags.add(n.tagName)
    })

    this.overlay = document.createElement('div')
    this.overlay.className = 'nexus-overlay'
    this.overlay.innerHTML = `
      <div class="nexus-container">
        <header class="window-header" style="position: relative; top: 0; left: 0; right: 0; z-index: 10; -webkit-app-region: no-drag; justify-content: center;">
          <div class="window-header__brand" style="position: absolute; left: 8px;">
            ${this.createIconSVG(Network, 14)}
          </div>
          <div class="nexus-tabs-icon-only" style="display: flex; align-items: center; gap: 8px; -webkit-app-region: no-drag; margin: 0 auto; background: transparent; padding: 4px;">
            <button class="nexus-tab-icon ${this.activeMode === 'universe' ? 'active' : ''}" data-mode="universe" title="Universe">
              ${this.createIconSVG(Globe, 16)}
            </button>
            <button class="nexus-tab-icon ${this.activeMode === 'neighborhood' ? 'active' : ''}" data-mode="neighborhood" title="Neighborhood">
              ${this.createIconSVG(Focus, 16)}
            </button>
            <button class="nexus-tab-icon ${this.activeMode === 'orb' ? 'active' : ''}" data-mode="orb" title="Orb">
              ${this.createIconSVG(Atom, 16)}
            </button>
          </div>
          <div class="window-header__controls" style="-webkit-app-region: no-drag; position: absolute; right: 0;">
            <button class="wh-btn wh-close" id="graph-close" title="Close">×</button>
          </div>
        </header>
        <div class="nexus-body" style="position: relative;">
          <div class="graph-controls" style="position: absolute; top: 10px; left: 10px; z-index: 100; display: flex; gap: 4px; flex-direction: column;">
            <button class="graph-control-btn" id="btn-fit" title="Fit to Screen (F)">${this.createIconSVG(Maximize2, 14)}</button>
            <button class="graph-control-btn" id="btn-reset" title="Reset View (R)">${this.createIconSVG(RotateCcw, 14)}</button>
            <button class="graph-control-btn" id="btn-center" title="Center Selected (C)">${this.createIconSVG(Home, 14)}</button>
            <button class="graph-control-btn" id="btn-stats" title="Statistics">${this.createIconSVG(BarChart3, 14)}</button>
            <button class="graph-control-btn" id="btn-export" title="Export Graph">${this.createIconSVG(Download, 14)}</button>
          </div>
          <div class="graph-search" style="position: absolute; top: 10px; right: 10px; z-index: 100; background: rgba(0,0,0,0.7); padding: 8px; border-radius: 4px; min-width: 200px;">
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
              ${this.createIconSVG(Search, 14)}
              <input type="text" id="graph-search-input" placeholder="Search nodes..." style="flex: 1; background: transparent; border: none; color: white; outline: none; font-size: 12px;" />
            </div>
            <div id="search-results" style="font-size: 11px; color: rgba(255,255,255,0.7); max-height: 100px; overflow-y: auto;"></div>
          </div>
          <canvas id="graph-canvas"></canvas>
          ${this.activeMode === 'orb' ? '<div class="orb-lens"></div>' : ''}
          <div class="nexus-insight-card" id="insight-card" style="display: none;"></div>
          <div class="graph-stats-panel" id="stats-panel" style="display: none; position: absolute; bottom: 60px; right: 10px; background: rgba(0,0,0,0.8); padding: 12px; border-radius: 4px; min-width: 200px; z-index: 100;">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px;">Graph Statistics</div>
            <div id="stats-content" style="font-size: 11px; line-height: 1.6;"></div>
          </div>
          <div class="graph-filters-panel" id="filters-panel" style="display: none; position: absolute; bottom: 60px; left: 10px; background: rgba(0,0,0,0.8); padding: 12px; border-radius: 4px; min-width: 200px; z-index: 100; max-height: 300px; overflow-y: auto;">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px;">Filters</div>
            <div style="margin-bottom: 8px;">
              <label style="font-size: 11px; display: block; margin-bottom: 4px;">Min Connections:</label>
              <input type="number" id="filter-connections" min="0" value="0" style="width: 100%; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 2px; color: white; font-size: 11px;" />
            </div>
            <div style="margin-bottom: 8px;">
              <label style="font-size: 11px; display: block; margin-bottom: 4px;">Color By:</label>
              <select id="color-scheme" style="width: 100%; padding: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 2px; color: white; font-size: 11px;">
                <option value="default">Default</option>
                <option value="folder">Folder</option>
                <option value="tag">Tag</option>
                <option value="connections">Connections</option>
              </select>
            </div>
          </div>
        </div>
        <footer class="nexus-footer">
          <div class="nexus-hint">ESC to close • F: Fit • R: Reset • C: Center • Click node to teleport</div>
          <div class="nexus-focus-info" id="focus-info" style="display: none;"></div>
        </footer>
      </div>
    `

    this.container.appendChild(this.overlay)
    this.canvas = this.overlay.querySelector('#graph-canvas') as HTMLCanvasElement
    if (this.canvas) {
      this.canvas.width = this.dimensions.width
      this.canvas.height = this.dimensions.height - 60
      this.ctx = this.canvas.getContext('2d')
      this.attachCanvasEvents()
    }
    this.attachUIEvents()
  }

  private attachUIEvents(): void {
    if (!this.overlay) return

    // Search
    const searchInput = this.overlay.querySelector('#graph-search-input') as HTMLInputElement
    const searchResults = this.overlay.querySelector('#search-results') as HTMLElement
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value
      this.searchResults = this.searchNodes(this.searchQuery)

      if (this.searchQuery && this.searchResults.length > 0) {
        searchResults.innerHTML = `${this.searchResults.length} result(s)`
        this.updateSimulation()
      } else {
        searchResults.innerHTML = ''
        this.updateSimulation()
      }
    })

    // Controls
    const btnFit = this.overlay.querySelector('#btn-fit')
    btnFit?.addEventListener('click', () => this.fitToScreen())

    const btnReset = this.overlay.querySelector('#btn-reset')
    btnReset?.addEventListener('click', () => this.resetView())

    const btnCenter = this.overlay.querySelector('#btn-center')
    btnCenter?.addEventListener('click', () => this.centerOnSelected())

    const btnStats = this.overlay.querySelector('#btn-stats')
    btnStats?.addEventListener('click', () => {
      this.showStats = !this.showStats
      const panel = this.overlay?.querySelector('#stats-panel') as HTMLElement
      if (panel) {
        panel.style.display = this.showStats ? 'block' : 'none'
        if (this.showStats) {
          this.updateStatsPanel()
        }
      }
    })

    const btnExport = this.overlay.querySelector('#btn-export')
    btnExport?.addEventListener('click', () => this.exportGraph('png'))

    // Filters
    const filterConnections = this.overlay.querySelector('#filter-connections') as HTMLInputElement
    filterConnections?.addEventListener('change', (e) => {
      this.minConnections = parseInt((e.target as HTMLInputElement).value) || 0
      this.updateSimulation()
    })

    const colorScheme = this.overlay.querySelector('#color-scheme') as HTMLSelectElement
    colorScheme?.addEventListener('change', (e) => {
      this.colorScheme = (e.target as HTMLSelectElement).value as any
      this.drawGraph()
    })
  }

  private updateStatsPanel(): void {
    const statsContent = this.overlay?.querySelector('#stats-content') as HTMLElement
    if (!statsContent) return

    statsContent.innerHTML = `
      <div>Total Nodes: <strong>${this.stats.totalNodes}</strong></div>
      <div>Total Links: <strong>${this.stats.totalLinks}</strong></div>
      <div>Notes: <strong>${this.stats.noteCount}</strong></div>
      <div>Tags: <strong>${this.stats.tagCount}</strong></div>
      <div>Orphan Nodes: <strong>${this.stats.orphanNodes}</strong></div>
      <div>Hub Nodes (10+): <strong>${this.stats.hubNodes}</strong></div>
    `
  }

  private attachCanvasEvents(): void {
    if (!this.canvas) return

    const screenToGraph = (screenX: number, screenY: number) => {
      return {
        x: (screenX - this.panX) / this.zoom,
        y: (screenY - this.panY) / this.zoom
      }
    }

    const findNodeAtPosition = (graphX: number, graphY: number): GraphNode | null => {
      // Use quadtree for faster lookup
      if (this.quadTree) {
        const range = { x: graphX - 20, y: graphY - 20, width: 40, height: 40 }
        const candidates = this.quadTree.query(range)

        for (let i = candidates.length - 1; i >= 0; i--) {
          const node = candidates[i]
          if (node.x === undefined || node.y === undefined) continue

          const selected = this.selectedNote()
          const isActive = selected?.id === node.noteId
          const isCentral = isActive && this.activeMode === 'orb'
          const r = this.getNodeRadius(node, isActive, isCentral) + 3

          const dx = graphX - node.x
          const dy = graphY - node.y
          if (dx * dx + dy * dy < r * r) {
            return node
          }
        }
      }

      // Fallback to linear search
      const nodesToCheck = this.visibleNodes.length > 0 ? this.visibleNodes : this.allNodes
      for (let i = nodesToCheck.length - 1; i >= 0; i--) {
        const node = nodesToCheck[i]
        if (node.x === undefined || node.y === undefined) continue

        const selected = this.selectedNote()
        const isActive = selected?.id === node.noteId
        const isCentral = isActive && this.activeMode === 'orb'
        const r = this.getNodeRadius(node, isActive, isCentral) + 3

        const dx = graphX - node.x
        const dy = graphY - node.y
        if (dx * dx + dy * dy < r * r) {
          return node
        }
      }
      return null
    }

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas!.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const graphPos = screenToGraph(screenX, screenY)

      if (this.isDraggingNode && this.draggedNode) {
        this.draggedNode.fx = graphPos.x
        this.draggedNode.fy = graphPos.y
        this.draggedNode.vx = 0
        this.draggedNode.vy = 0
        this.draggedNode.x = graphPos.x
        this.draggedNode.y = graphPos.y
        this.updateVisibleElements()
        this.drawGraph()
        return
      }

      if (this.isDragging && !this.isDraggingNode) {
        this.panX += e.movementX
        this.panY += e.movementY
        this.updateVisibleElements()
        this.drawGraph()
        return
      }

      const hoveredNode = findNodeAtPosition(graphPos.x, graphPos.y)
      if (hoveredNode !== this.hoverNode) {
        this.handleNodeHover(hoveredNode)
      }
    })

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        const rect = this.canvas!.getBoundingClientRect()
        const screenX = e.clientX - rect.left
        const screenY = e.clientY - rect.top
        const graphPos = screenToGraph(screenX, screenY)

        const clickedNode = findNodeAtPosition(graphPos.x, graphPos.y)
        if (clickedNode) {
          // Handle path finding - Ctrl+Click for start, Ctrl+Click again for end
          if (e.ctrlKey || e.metaKey) {
            if (!this.pathStart) {
              this.pathStart = clickedNode
              clickedNode.highlighted = true
            } else if (this.pathStart.id !== clickedNode.id) {
              this.pathEnd = clickedNode
              const path = this.findPath(this.pathStart, clickedNode)
              if (path) {
                this.pathNodes.clear()
                path.forEach(n => {
                  n.pathNode = true
                  this.pathNodes.add(n.id)
                })
              }
              this.pathStart = null
              this.pathEnd = null
            }
            this.drawGraph()
          } else {
            this.isDraggingNode = true
            this.draggedNode = clickedNode
            this.canvas!.style.cursor = 'grabbing'
          }
        } else {
          this.isDragging = true
          this.dragStartX = e.clientX
          this.dragStartY = e.clientY
          this.canvas!.style.cursor = 'grabbing'
        }
      }
    })

    this.canvas.addEventListener('mouseup', () => {
      if (this.isDraggingNode && this.draggedNode) {
        // Keep the node pinned at its dragged position
        // Only unpin if it's the central node in orb mode (which should stay centered)
        const selected = this.selectedNote()
        const isCentral = this.activeMode === 'orb' && selected && this.draggedNode.noteId === selected.id

        // If not central, keep it pinned where user dragged it
        // The fx and fy are already set during drag, so just keep them
        if (isCentral) {
          // For central nodes in orb mode, reset to center
          this.draggedNode.fx = this.dimensions.width / 2
          this.draggedNode.fy = (this.dimensions.height - 60) / 2
        }
        // Otherwise, fx and fy remain set from the drag, keeping the node pinned

        this.isDraggingNode = false
        this.draggedNode = null
      }
      this.isDragging = false
      if (this.canvas) {
        this.canvas.style.cursor = 'default'
      }
    })

    this.canvas.addEventListener('click', (e) => {
      if (this.isDraggingNode ||
          Math.abs(e.clientX - this.dragStartX) > 5 ||
          Math.abs(e.clientY - this.dragStartY) > 5) {
        return
      }

      if (e.ctrlKey || e.metaKey) return // Path finding handled in mousedown

      const rect = this.canvas!.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const graphPos = screenToGraph(screenX, screenY)

      const clickedNode = findNodeAtPosition(graphPos.x, graphPos.y)
      if (clickedNode) {
        this.handleNodeClick(clickedNode)
      }
    })

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const rect = this.canvas!.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.1, Math.min(5, this.zoom * zoomFactor))

      const graphX = (mouseX - this.panX) / this.zoom
      const graphY = (mouseY - this.panY) / this.zoom

      this.zoom = newZoom
      this.panX = mouseX - graphX * this.zoom
      this.panY = mouseY - graphY * this.zoom

      this.updateVisibleElements()
      this.drawGraph()
    })

    this.canvas.addEventListener('mouseleave', () => {
      this.isDragging = false
      this.isDraggingNode = false
      this.handleNodeHover(null)
      if (this.canvas) {
        this.canvas.style.cursor = 'default'
      }
    })
  }

  private createIconSVG(Icon: any, size: number): string {
    const icon = createElement(Icon, {
      size,
      'stroke-width': 1.5,
      stroke: 'currentColor',
      color: 'currentColor'
    })
    return icon?.outerHTML || ''
  }

  private attachEvents(): void {
    if (!this.overlay) return

    const closeBtn = this.overlay.querySelector('#graph-close')
    closeBtn?.addEventListener('click', () => this.close())


    this.overlay.querySelectorAll('.nexus-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.mode as 'universe' | 'neighborhood' | 'orb'
        if (mode) {
          this.activeMode = mode
          this.updateSimulation()
          this.overlay?.querySelectorAll('.nexus-tab').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
        }
      })
    })

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!this.isOpen) return

      if (e.key === 'Escape') {
        this.close()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        this.fitToScreen()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        this.resetView()
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        this.centerOnSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    this.overlay.addEventListener('remove', () => {
      window.removeEventListener('keydown', handleKeyDown)
    })

    const handleResize = () => {
      this.dimensions = {
        width: window.innerWidth * 0.95,
        height: window.innerHeight * 0.92
      }
      if (this.canvas) {
        this.canvas.width = this.dimensions.width
        this.canvas.height = this.dimensions.height - 60
      }
      this.updateVisibleElements()
      void this.updateSimulation()
    }
    window.addEventListener('resize', handleResize)
  }

  // Get node color based on color scheme
  private getNodeColor(node: GraphNode, isActive: boolean, isHovered: boolean, isCentral: boolean): string {
    if (node.type === 'tag') {
      return isActive || isHovered ? '#14b8a6' : 'rgba(20, 184, 166, 0.8)'
    }

    if (isCentral || isActive) {
      return '#ffaa00'
    }

    if (isHovered) {
      return '#64bafa'
    }

    // Color coding
    if (this.colorScheme === 'folder' && node.folder) {
      const hash = node.folder.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const hue = hash % 360
      return `hsl(${hue}, 70%, 60%)`
    }

    if (this.colorScheme === 'connections' && node.connectionCount !== undefined) {
      const count = node.connectionCount
      if (count === 0) return 'rgba(150, 150, 150, 0.6)'
      if (count < 3) return 'rgba(100, 160, 255, 0.8)'
      if (count < 10) return 'rgba(100, 200, 255, 0.9)'
      return 'rgba(255, 200, 100, 0.95)'
    }

    return 'rgba(100, 160, 255, 0.95)'
  }

  private drawGraph(): void {
    if (!this.canvas || !this.ctx) return

    const ctx = this.ctx
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    const nodes = this.visibleNodes.length > 0 ? this.visibleNodes : this.allNodes
    const links = this.visibleLinks.length > 0 ? this.visibleLinks : this.allLinks

    // LOD: Simplify rendering at low zoom
    const lodLevel = this.zoom < 0.5 ? 'low' : this.zoom < 1 ? 'medium' : 'high'

    ctx.save()
    ctx.translate(this.panX, this.panY)
    ctx.scale(this.zoom, this.zoom)

    // Draw links with curved bezier paths and animations
    if (lodLevel !== 'low') {
      links.forEach(link => {
        const source = typeof link.source === 'string' ? nodes.find(n => n.id === link.source) : link.source
        const target = typeof link.target === 'string' ? nodes.find(n => n.id === link.target) : link.target

        // For search, also check all nodes (not just visible) to show links to hidden nodes
        const allNodesForLinks = this.searchQuery ? this.allNodes : nodes
        const sourceNode = source || (typeof link.source === 'string' ? allNodesForLinks.find(n => n.id === link.source) : link.source)
        const targetNode = target || (typeof link.target === 'string' ? allNodesForLinks.find(n => n.id === link.target) : link.target)

        if (sourceNode && targetNode && sourceNode.x !== undefined && sourceNode.y !== undefined && targetNode.x !== undefined && targetNode.y !== undefined) {
          let strokeStyle = 'rgba(255, 255, 255, 0.25)'
          let lineWidth = 1.5 / this.zoom
          const isPathLink = this.pathNodes.has(sourceNode.id) && this.pathNodes.has(targetNode.id)
          const linkId = `${sourceNode.id}-${targetNode.id}`

          // Link type visualization
          if (link.type === 'tag') {
            strokeStyle = 'rgba(20, 184, 166, 0.4)'
          } else if (link.type === 'wikilink') {
            strokeStyle = 'rgba(100, 160, 255, 0.3)'
          }

          const isConnectedToHover = this.hoverNode && (sourceNode.id === this.hoverNode.id || targetNode.id === this.hoverNode.id)

          if (isPathLink) {
            strokeStyle = '#ffaa00'
            lineWidth = 3 / this.zoom
          } else if (isConnectedToHover) {
            strokeStyle = link.type === 'tag'
              ? 'rgba(20, 184, 166, 0.8)'
              : 'rgba(100, 160, 255, 0.7)'
            lineWidth = 2.5 / this.zoom
          } else if (this.hoverNode) {
            strokeStyle = 'rgba(255, 255, 255, 0.08)'
            lineWidth = 1 / this.zoom
          }

          // Draw straight link
          ctx.strokeStyle = strokeStyle
          ctx.lineWidth = lineWidth
          ctx.beginPath()
          ctx.moveTo(sourceNode.x, sourceNode.y)
          ctx.lineTo(targetNode.x, targetNode.y)
          ctx.stroke()

          // Draw animated particles on hovered links - bidirectional flow
          if (isConnectedToHover && this.hoverNode) {
            const particleCount = 3
            const isFromHovered = sourceNode.id === this.hoverNode.id
            const dx = targetNode.x - sourceNode.x
            const dy = targetNode.y - sourceNode.y

            for (let i = 0; i < particleCount; i++) {
              // Create particles flowing in both directions
              const offset1 = (this.animationTime * 0.8 + i / particleCount) % 1
              const offset2 = (1 - this.animationTime * 0.8 + i / particleCount) % 1

              // Particle flowing from hovered node (straight line interpolation)
              const t1 = isFromHovered ? offset1 : 1 - offset1
              const px1 = sourceNode.x + dx * t1
              const py1 = sourceNode.y + dy * t1

              // Particle flowing to hovered node (straight line interpolation)
              const t2 = isFromHovered ? 1 - offset2 : offset2
              const px2 = sourceNode.x + dx * t2
              const py2 = sourceNode.y + dy * t2

              // Draw glowing particles
              const particleColor = link.type === 'tag' ? 'rgba(20, 184, 166, 0.9)' : 'rgba(100, 160, 255, 0.9)'

              // First particle
              const gradient1 = ctx.createRadialGradient(px1, py1, 0, px1, py1, 5)
              gradient1.addColorStop(0, particleColor)
              gradient1.addColorStop(0.5, particleColor.replace('0.9', '0.5'))
              gradient1.addColorStop(1, 'transparent')

              ctx.fillStyle = gradient1
              ctx.beginPath()
              ctx.arc(px1, py1, 5, 0, 2 * Math.PI)
              ctx.fill()

              // Second particle (bidirectional)
              const gradient2 = ctx.createRadialGradient(px2, py2, 0, px2, py2, 5)
              gradient2.addColorStop(0, particleColor)
              gradient2.addColorStop(0.5, particleColor.replace('0.9', '0.5'))
              gradient2.addColorStop(1, 'transparent')

              ctx.fillStyle = gradient2
              ctx.beginPath()
              ctx.arc(px2, py2, 5, 0, 2 * Math.PI)
              ctx.fill()
            }
          }
        }
      })
    }

    // Draw nodes with LOD - include search-matched nodes even if not in visible set
    const selected = this.selectedNote()
    const nodesToDraw = this.searchQuery
      ? [...nodes, ...this.searchResults.filter(n => !nodes.find(vn => vn.id === n.id))]
      : nodes

    nodesToDraw.forEach(node => {
      if (node.x === undefined || node.y === undefined) return

      const isActive = selected?.id === node.noteId
      const isHovered = this.hoverNode?.id === node.id
      const isCentral = isActive && this.activeMode === 'orb'
      const isHighlighted = node.highlighted || node.pathNode || node.searchMatch
      const r = lodLevel === 'low' ? Math.max(2, this.getNodeRadius(node, isActive, isCentral) * 0.7) : this.getNodeRadius(node, isActive, isCentral)

      let alpha = 1.0
      if (this.hoverNode && this.hoverNode.id !== node.id) {
        const isNeighbor = links.some(l => {
          const src = typeof l.source === 'string' ? l.source : l.source.id
          const tgt = typeof l.target === 'string' ? l.target : l.target.id
          return (src === this.hoverNode!.id && tgt === node.id) || (src === node.id && tgt === this.hoverNode!.id)
        })
        if (!isNeighbor) alpha = 0.2
      }

      ctx.globalAlpha = alpha

      const baseColor = this.getNodeColor(node, isActive, isHovered, isCentral)
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r)

      if (node.type === 'tag') {
        gradient.addColorStop(0, isActive || isHovered ? '#14b8a6' : 'rgba(20, 184, 166, 0.8)')
        gradient.addColorStop(1, isActive || isHovered ? '#0d9488' : 'rgba(13, 148, 136, 0.6)')
      } else {
        if (isCentral) {
          gradient.addColorStop(0, '#ffaa00')
          gradient.addColorStop(0.5, '#ff8800')
          gradient.addColorStop(1, '#ff6600')
        } else if (isActive) {
          gradient.addColorStop(0, '#ffaa00')
          gradient.addColorStop(0.7, '#ff8800')
          gradient.addColorStop(1, '#ff6600')
        } else if (isHovered) {
          gradient.addColorStop(0, '#64bafa')
          gradient.addColorStop(0.7, '#4a9ef5')
          gradient.addColorStop(1, '#3b82f6')
        } else {
          const color = baseColor
          gradient.addColorStop(0, color.replace('0.95', '1').replace('0.8', '0.95'))
          gradient.addColorStop(0.7, color)
          gradient.addColorStop(1, color.replace('0.95', '0.75').replace('0.8', '0.6'))
        }
      }

      // No glow effects - removed shadow for cleaner look

      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
      ctx.fillStyle = gradient
      ctx.fill()

      // Border
      const borderColor = isHighlighted ? (node.pathNode ? '#ffaa00' : '#64bafa') :
                          isCentral ? '#ffaa00' :
                          isActive ? '#ffaa00' :
                          isHovered ? (node.type === 'tag' ? '#14b8a6' : '#64bafa') :
                          'rgba(255, 255, 255, 0.3)'
      ctx.strokeStyle = borderColor
      ctx.lineWidth = isHighlighted || isCentral ? 3 / this.zoom : (isActive || isHovered ? 2 / this.zoom : 1 / this.zoom)
      ctx.stroke()

      ctx.globalAlpha = 1.0

      // Draw label (LOD)
      if (lodLevel === 'high' && (isActive || isHovered || this.zoom > 2.5 || isHighlighted)) {
        const fontSize = Math.max(8, Math.min(10, 9 / this.zoom))
        ctx.font = `${fontSize}px Inter, sans-serif`
        const label = (node.title || node.id).replace(/[*"']/g, '').substring(0, 15)

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        const textWidth = ctx.measureText(label).width
        const textX = node.x
        const textY = node.y + r + 3

        ctx.fillRect(textX - textWidth / 2 - 3, textY - 1, textWidth + 6, fontSize + 3)

        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = isActive ? '#ffaa00' : isHovered ? '#fff' : 'rgba(255, 255, 255, 0.95)'
        ctx.fillText(label, textX, textY)
      }
    })

    ctx.restore()
  }

  private handleNodeHover(node: GraphNode | null): void {
    this.hoverNode = node
    if (this.overlay) {
      const insightCard = this.overlay.querySelector('#insight-card') as HTMLElement
      if (node && insightCard) {
        if (node.type === 'tag') {
          insightCard.style.display = 'block'
          insightCard.innerHTML = `
            <div class="card-header">
              <div class="card-title">${node.title}</div>
              <div class="card-meta">Tag</div>
            </div>
          `
        } else if (node.noteId) {
          const note = state.notes.find(n => n.id === node.noteId)
          if (note) {
            const connectionCount = node.connectionCount || 0
            insightCard.style.display = 'block'
            insightCard.innerHTML = `
              <div class="card-header">
                <div class="card-title">${note.title}</div>
                <div class="card-meta">${note.path || 'root'} • ${connectionCount} connections • Updated ${new Date(note.updatedAt).toLocaleDateString()}</div>
              </div>
              <div class="card-footer">Last edited ${new Date(note.updatedAt).toLocaleDateString()}</div>
            `
          }
        }
      } else if (insightCard) {
        insightCard.style.display = 'none'
      }
    }
    this.drawGraph()
  }

  private handleNodeClick(node: GraphNode): void {
    if (node.type === 'tag') return

    const note = state.notes.find(n => n.id === node.noteId)
    if (note) {
      const event = new CustomEvent('knowledge-hub:open-note', {
        detail: { id: note.id, path: note.path || '' }
      })
      window.dispatchEvent(event)
      this.close()
    }
  }
}
