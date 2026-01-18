import { state } from '../../core/state'
import { forceSimulation, forceLink, forceManyBody, forceRadial, forceCenter } from 'd3-force'
import { createElement, Network, Globe, Focus, Atom, Search, Download, BarChart3, X, Maximize2, RotateCcw, Home } from 'lucide'
import { extractWikiLinks, extractTags } from '../../utils/helpers'
import '../window-header/window-header.css'
import './graph.css'

import type { GraphNode, GraphLink, GraphStats } from './types'
import { MAX_VISIBLE_NODES, ANIMATION_SPEED } from './types'
import { QuadTree } from './quadtree'
import { getNodeRadius, getNodeColor, searchNodes, isNodeVisible, findPathBFS } from './helpers'

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
 
  // Bound handlers for proper cleanup
  private handleKeyDownBound: ((e: KeyboardEvent) => void) | null = null
  private handleResizeBound: (() => void) | null = null
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

    // Remove global listeners if bound
    if (this.handleKeyDownBound) {
      window.removeEventListener('keydown', this.handleKeyDownBound)
      this.handleKeyDownBound = null
    }
    if (this.handleResizeBound) {
      window.removeEventListener('resize', this.handleResizeBound)
      this.handleResizeBound = null
    }
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

  // path/search/radius/visibility logic moved to helpers

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
    this.visibleNodes = filtered.filter(node => isNodeVisible(node, this.zoom, this.panX, this.panY, this.dimensions))

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

      // If searching, show links only when both nodes match search (hide stray lines)
      if (this.searchQuery) {
        return searchMatchedIds.has(src) && searchMatchedIds.has(tgt)
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
      // Preserve pinned/fx/fy state from previous data if present
      const prev = this.allNodes ? this.allNodes.find(n => n.id === note.id) : undefined
      if (prev && (prev.pinned || prev.fx != null || prev.fy != null)) {
        node.pinned = prev.pinned
        node.fx = prev.fx
        node.fy = prev.fy
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
                  // Mark nodes that participate in wikilinks for special rendering
                  sourceNode.hasWikiLinks = true
                  targetNode.hasWikiLinks = true
                  sourceNode.wikiLinkCount = (sourceNode.wikiLinkCount || 0) + 1
                  targetNode.wikiLinkCount = (targetNode.wikiLinkCount || 0) + 1
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
            // Preserve pinned/fx/fy for tag nodes if recreated
            const prevTag = this.allNodes ? this.allNodes.find(n => n.id === `tag:${tag}`) : undefined
            if (prevTag && (prevTag.pinned || prevTag.fx != null || prevTag.fy != null)) {
              tagNode.pinned = prevTag.pinned
              tagNode.fx = prevTag.fx
              tagNode.fy = prevTag.fy
            }
            tagMap.set(tag, tagNode)
            nodes.push(tagNode)
          }
          links.push({ source: sourceNode, target: tagNode, type: 'tag' })
          // Mark note node as having tags to emphasize it
          sourceNode.hasTags = true
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
      this.searchResults = searchNodes(this.allNodes, this.searchQuery)
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
        } else if (node.fx == null && node.fy == null) {
          // Node is not pinned (null or undefined), initialize position normally
          // Don't change fx/fy if they're already set (user dragged the node)
        }
        // If fx/fy are set (not null/undefined), keep them - user dragged the node
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
      <style>
        /* Mode/menu styling */
        #mode-menu {
          background: #0b1220; /* solid, not transparent */
          border: 1px solid rgba(255,255,255,0.06);
          padding: 8px;
          border-radius: 8px;
          min-width: 160px;
          box-shadow: 0 10px 30px rgba(2,6,23,0.9);
          z-index: 1200;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        #mode-menu .mode-item {
          cursor: pointer;
          font-size: 11px;
          padding: 6px 8px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          color: #fff;
          border-radius: 6px;
          white-space: nowrap;
          background: transparent;
          border: none;
          -webkit-appearance: none;
          appearance: none;
        }
        #mode-menu .graph-action-btn {
          cursor: pointer;
          font-size: 11px;
          padding: 6px 8px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          color: #fff;
          border-radius: 6px;
          white-space: nowrap;
          background: transparent;
          border: none;
          -webkit-appearance: none;
          appearance: none;
        }
        #mode-menu .graph-action-btn .icon { width: 18px; height: 18px; display:flex; align-items:center; justify-content:center; }
        #mode-menu .graph-action-btn .icon svg { width: 14px !important; height: 14px !important; }
        /* Hover only on icon, not whole item */
        #mode-menu .graph-action-btn .icon:hover { background: rgba(255,255,255,0.03); transform: translateY(-1px); border-radius:6px; }
        #mode-menu .mode-item:focus, #mode-menu .graph-action-btn:focus { outline: none; box-shadow: none; }
        #mode-menu .mode-item .icon { width: 18px; height: 18px; display:flex; align-items:center; justify-content:center; }
        #mode-menu .mode-item .icon svg { width: 14px !important; height: 14px !important; }
        #mode-menu .mode-item .label { font-size: 11px; margin-left: 6px; }
        /* Hover only on icon, not whole item */
        #mode-menu .mode-item .icon:hover {
          background: rgba(255,255,255,0.03);
          transform: translateY(-1px);
          border-radius:6px;
        }
        /* make svg/icon color change on hover and active */
        #mode-menu .mode-item .icon:hover svg,
        #mode-menu .graph-action-btn .icon:hover svg {
          color: var(--text-muted);
          stroke: currentColor;
          fill: currentColor;
        }
        #mode-menu .mode-item.active .icon svg,
        #mode-menu .graph-action-btn.active .icon svg {
          color: var(--text-accent);
          stroke: currentColor;
          fill: currentColor;
        }
        #mode-menu .mode-item.active {
          background: linear-gradient(90deg, rgba(255,170,0,0.14), rgba(255,136,0,0.06));
          box-shadow: 0 6px 18px rgba(255,136,0,0.06);
        }
        /* Ensure mode items visually match action buttons */
        #mode-menu .mode-item .icon:hover, #mode-menu .graph-action-btn .icon:hover { background: rgba(255,255,255,0.03); }
        #mode-menu .mode-item.active .icon, #mode-menu .graph-action-btn.active .icon { background: linear-gradient(90deg, rgba(255,170,0,0.14), rgba(255,136,0,0.06)); }
        @media (max-width: 600px) {
          #mode-menu { min-width: 120px }
          #mode-menu .mode-item { padding: 6px; }
        }
      </style>
      <div class="nexus-container">
          <header class="window-header" style="position: relative; top: 0; left: 0; right: 0; z-index: 10; -webkit-app-region: no-drag; justify-content: center;">
          <div class="window-header__brand" style="position: absolute; left: 8px;">
            ${this.createIconSVG(Network, 14)}
          </div>
          <div class="window-header__controls" style="-webkit-app-region: no-drag; position: absolute; right: 0;">
            <button class="wh-btn wh-close" id="graph-close" title="Close">×</button>
          </div>
        </header>
        <div class="nexus-body" style="position: relative;">
          <div class="graph-controls" style="position: absolute; top: 10px; left: 10px; z-index: 200;">
            <div id="mode-dropdown" style="position: relative;">
              <button id="mode-toggle" title="View mode" style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); color: white;">
                ${this.createIconSVG(Network, 14)}
              </button>
              <div id="mode-menu" style="display: none; position: absolute; left: 0; top: 44px; background: rgba(0,0,0,0.85); padding: 8px; border-radius: 6px; min-width: 120px; box-shadow: 0 6px 18px rgba(0,0,0,0.6);">
                <div style="display:flex; flex-direction: column; gap:6px;">
                  <button class="mode-item nexus-tab-icon" data-mode="universe" title="Universe">
                    <span class="icon">${this.createIconSVG(Globe, 14)}</span><span class="label">Universe</span>
                  </button>
                  <button class="mode-item nexus-tab-icon" data-mode="neighborhood" title="Neighbors">
                    <span class="icon">${this.createIconSVG(Focus, 14)}</span><span class="label">Neighbors</span>
                  </button>
                  <button class="mode-item nexus-tab-icon" data-mode="orb" title="Orb">
                    <span class="icon">${this.createIconSVG(Atom, 14)}</span><span class="label">Orb</span>
                  </button>
                </div>
                <hr style="border:none; height:1px; background: rgba(255,255,255,0.04); margin:6px 0;" />
                <div style="display:flex; flex-direction: column; gap:6px; margin-top:4px;">
                  <button class="graph-action-btn" id="btn-fit" title="Fit to Screen (F)">
                    <span class="icon">${this.createIconSVG(Maximize2, 14)}</span><span class="label">Fit to Screen</span>
                  </button>
                  <button class="graph-action-btn" id="btn-reset" title="Reset View (R)">
                    <span class="icon">${this.createIconSVG(RotateCcw, 14)}</span><span class="label">Reset View</span>
                  </button>
                  <button class="graph-action-btn" id="btn-center" title="Center Selected (C)">
                    <span class="icon">${this.createIconSVG(Home, 14)}</span><span class="label">Center Selected</span>
                  </button>
                  <button class="graph-action-btn" id="btn-stats" title="Statistics">
                    <span class="icon">${this.createIconSVG(BarChart3, 14)}</span><span class="label">Statistics</span>
                  </button>
                  <button class="graph-action-btn" id="btn-export" title="Export Graph">
                    <span class="icon">${this.createIconSVG(Download, 14)}</span><span class="label">Export</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="graph-search" style="position: absolute; top: 10px; right: 10px; z-index: 100; background: rgba(0,0,0,0.7); padding: 8px; border-radius: 4px; min-width: 200px;">
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
              ${this.createIconSVG(Search, 14)}
              <input type="text" id="graph-search-input" placeholder="Search nodes..." style="flex: 1; background: transparent; border: none; color: white; outline: none; font-size: 12px;" />
            </div>
            <div id="search-results" style="font-size: 11px; color: rgba(255,255,255,0.7); max-height: 100px; overflow-y: auto;"></div>
          </div>
          <!-- actions are moved into the left mode dropdown to act as a single toolbar -->
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
      this.searchResults = searchNodes(this.allNodes, this.searchQuery)

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

    // Mode & actions dropdown toggle
    const modeToggle = this.overlay.querySelector('#mode-toggle') as HTMLButtonElement
    const modeMenu = this.overlay.querySelector('#mode-menu') as HTMLElement
    if (modeToggle && modeMenu) {
      modeToggle.addEventListener('click', (ev) => {
        ev.stopPropagation()
        modeMenu.style.display = modeMenu.style.display === 'block' ? 'none' : 'block'
      })

      modeToggle.addEventListener('mouseenter', () => {
        modeToggle.style.boxShadow = '0 6px 16px rgba(0,0,0,0.6)'
        modeToggle.style.transform = 'translateY(-1px)'
      })
      modeToggle.addEventListener('mouseleave', () => {
        modeToggle.style.boxShadow = ''
        modeToggle.style.transform = ''
      })

      // Close mode menu when clicking outside
      document.addEventListener('click', (ev) => {
        if (!this.overlay) return
        const target = ev.target as Node
        if (modeMenu.style.display === 'block' && !this.overlay.contains(target)) {
          modeMenu.style.display = 'none'
        }
      })
    }
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
          const r = getNodeRadius(node, isActive, isCentral) + 3

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
        const r = getNodeRadius(node, isActive, isCentral) + 3

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
              const path = findPathBFS(this.allNodes, this.allLinks, this.pathStart.id, clickedNode.id)
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
        // Mark the node as pinned so it persists across rebuilds
        this.draggedNode.pinned = true

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


    this.overlay.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.mode as 'universe' | 'neighborhood' | 'orb'
        if (mode) {
          this.activeMode = mode
          this.updateSimulation()
          this.overlay?.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          // Close left dropdown after selection
          const modeMenu = this.overlay?.querySelector('#mode-menu') as HTMLElement
          if (modeMenu) modeMenu.style.display = 'none'
          // Add or remove orb lens for orb mode
          const existingLens = this.overlay?.querySelector('.orb-lens') as HTMLElement | null
          if (mode === 'orb') {
            if (!existingLens && this.overlay) {
              const lens = document.createElement('div')
              lens.className = 'orb-lens'
              this.overlay.querySelector('.nexus-body')?.appendChild(lens)
            }
            this.overlay?.querySelector('.nexus-container')?.classList.add('orb-mode')
          } else {
            if (existingLens) existingLens.remove()
            this.overlay?.querySelector('.nexus-container')?.classList.remove('orb-mode')
          }
        }
      })
    })

    // Keyboard shortcuts
    this.handleKeyDownBound = (e: KeyboardEvent) => {
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
    window.addEventListener('keydown', this.handleKeyDownBound)

    this.handleResizeBound = () => {
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
    window.addEventListener('resize', this.handleResizeBound)
  }

  // Node color logic moved to helpers

  private drawGraph(): void {
    if (!this.canvas || !this.ctx) return

    const ctx = this.ctx
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Determine node set to draw. When searching, only draw matching nodes.
    const nodes = this.searchQuery
      ? this.allNodes.filter(n => n.searchMatch)
      : (this.visibleNodes.length > 0 ? this.visibleNodes : this.allNodes)

    // Determine links to draw. If search is active, rely on this.visibleLinks (which now only contains
    // links whose both endpoints match the search). Otherwise fall back to visibleLinks or allLinks.
    const links = this.searchQuery
      ? this.visibleLinks
      : (this.visibleLinks.length > 0 ? this.visibleLinks : this.allLinks)

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
      const r = lodLevel === 'low' ? Math.max(2, getNodeRadius(node, isActive, isCentral) * 0.7) : getNodeRadius(node, isActive, isCentral)

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

      const baseColor = getNodeColor(node, isActive, isHovered, isCentral, this.colorScheme)
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
              (node.hasWikiLinks ? 'rgba(255, 179, 71, 0.95)' : (node.hasTags ? '#0d9488' : 'rgba(255, 255, 255, 0.3)'))
      ctx.strokeStyle = borderColor
      const baseLineWidth = isHighlighted || isCentral ? 3 : (isActive || isHovered ? 2 : 1)
      const wikiBoost = Math.max(0, (node.wikiLinkCount || 0) - 1) // extra width for multiple wikilinks
      ctx.lineWidth = (baseLineWidth + Math.min(wikiBoost, 6) * 0.4) / this.zoom
      ctx.stroke()

      // Subtle halo for highly-linked nodes
      if ((node.wikiLinkCount || 0) >= 4) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, r + 4 + Math.min((node.wikiLinkCount || 0) - 3, 6), 0, 2 * Math.PI)
        ctx.strokeStyle = 'rgba(255, 179, 71, 0.12)'
        ctx.lineWidth = (2 + Math.min((node.wikiLinkCount || 0) - 3, 6)) / this.zoom
        ctx.stroke()
      }

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
        // Position insight card at bottom-right for better visibility
        insightCard.style.display = 'block'
        // Override stylesheet top/left by setting to 'auto'
        insightCard.style.top = 'auto'
        insightCard.style.left = 'auto'
        insightCard.style.right = '20px'
        insightCard.style.bottom = '30px'
        // Constrain size to avoid stretching (smaller)
        insightCard.style.width = '260px'
        insightCard.style.maxHeight = '160px'
        insightCard.style.overflow = 'auto'
      } else if (insightCard) {
        insightCard.style.display = 'none'
        // Reset positioning
        insightCard.style.top = ''
        insightCard.style.left = ''
        insightCard.style.right = ''
        insightCard.style.bottom = ''
        insightCard.style.width = ''
        insightCard.style.maxHeight = ''
        insightCard.style.overflow = ''
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
