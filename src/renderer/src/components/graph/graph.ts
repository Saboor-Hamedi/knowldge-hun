/**
 * Enhanced Graph View
 * Force-directed graph visualization with filtering, clustering, and rich interactions
 */

import * as d3 from 'd3'
import { state } from '../../core/state'
import { GraphControls, type GraphFilters } from './graph-controls'
import {
  type GraphNode,
  type GraphLink,
  type GraphData,
  processGraphData,
  filterNodes,
  getNodeRadius,
  getGroupColor,
  findShortestPath,
  getPathLinks
} from './graph-utils'
import './graph.css'
import '../window-header/window-header.css'

export class GraphView {
  private container: HTMLElement
  private modal: HTMLElement
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
  private g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
  private simulation: d3.Simulation<GraphNode, GraphLink> | null = null
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null
  private controls: GraphControls | null = null

  private graphData: GraphData | null = null
  private filteredData: GraphData | null = null
  private groupColors: Map<number, string> = new Map()
  private showLabels = true
  private forceStrength = -300
  private localGraphEnabled = false
  private localGraphDepth = 2
  private pathFindMode = false
  private pathFindStart: string | null = null
  private currentPath: string[] = []
  private minimap: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null

  // D3 selections
  private linkSelection: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null = null
  private nodeSelection: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null = null
  private particleGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
  private activeParticleAnimations: number[] = []

  constructor() {
    this.container = document.body
    this.modal = document.createElement('div')
    this.modal.className = 'graph-modal'
    this.render()
    this.container.appendChild(this.modal)

    // Bind Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('is-visible')) {
        this.close()
      }
    })
  }

  private render(): void {
    this.modal.innerHTML = `
      <div class="graph-modal__content">
        <div class="window-header" style="border-radius: 8px 8px 0 0; flex-shrink: 0;">
          <div class="window-header__brand">
            <span class="window-header__title">Vault Graph</span>
            <span class="graph-modal__stats" id="graph-stats"></span>
          </div>
          <div class="window-header__controls">
            <button class="wh-btn wh-close graph-modal__close" title="Close (Esc)" aria-label="Close">×</button>
          </div>
        </div>
        <div class="graph-modal__toolbar" id="graph-toolbar"></div>
        <div class="graph-modal__canvas" id="graph-canvas"></div>
        <div class="graph-modal__minimap" id="graph-minimap"></div>
        <div class="graph-modal__tooltip" id="graph-tooltip"></div>
        <div class="graph-modal__pathfind-hint" id="graph-pathfind-hint" style="display: none;">
          Click on a node to select the start point, then click another node to find the path.
          <button class="graph-modal__pathfind-cancel">Cancel</button>
        </div>
        <div class="graph-modal__legend" id="graph-legend"></div>
      </div>
    `

    this.modal.querySelector('.graph-modal__close')?.addEventListener('click', () => this.close())

    // Initialize controls
    const toolbar = this.modal.querySelector('#graph-toolbar') as HTMLElement
    if (toolbar) {
      this.controls = new GraphControls(toolbar, {
        onSearch: (query) => this.handleSearch(query),
        onFilterChange: (filters) => this.handleFilterChange(filters),
        onZoomIn: () => this.handleZoom(1.3),
        onZoomOut: () => this.handleZoom(0.7),
        onZoomReset: () => this.handleZoomReset(),
        onToggleLabels: (show) => this.handleToggleLabels(show),
        onForceStrengthChange: (strength) => this.handleForceStrengthChange(strength),
        onDepthChange: (depth) => this.handleDepthChange(depth),
        onToggleLocalGraph: (enabled) => this.handleToggleLocalGraph(enabled),
        onExport: (format) => this.handleExport(format),
        onStartPathFind: () => this.handleStartPathFind()
      })
    }
  }

  async open(): Promise<void> {
    this.modal.classList.add('is-visible')
    await this.initGraph()
  }

  close(): void {
    this.modal.classList.remove('is-visible')
    if (this.simulation) {
      this.simulation.stop()
    }
  }

  private async initGraph(): Promise<void> {
    const canvas = this.modal.querySelector('#graph-canvas') as HTMLElement
    if (!canvas) return

    // Clear previous
    canvas.innerHTML = ''
    this.hideTooltip()

    // Check for API availability
    if (!window.api.getGraph) {
      this.showError('Graph API not found. Please restart the application.')
      return
    }

    try {
      // Fetch data
      const graphData = await window.api.getGraph()
      const allNotes = state.notes

      if (!graphData || !allNotes) {
        this.showError('No notes found in vault.')
        return
      }

      // Load note contents for tag extraction
      const noteContents = new Map<string, string>()
      const notesToLoad = allNotes.filter((n) => n.type !== 'folder').slice(0, 200) // Limit for performance

      await Promise.all(
        notesToLoad.map(async (note) => {
          try {
            const loaded = await window.api.loadNote(note.id, note.path)
            if (loaded?.content) {
              noteContents.set(note.id, loaded.content)
            }
          } catch {
            // Ignore load errors
          }
        })
      )

      // Process graph data
      this.graphData = processGraphData(allNotes, graphData.links, noteContents, state.activeId)
      this.filteredData = this.graphData

      // Generate group colors
      const uniqueGroups = new Set(this.graphData.nodes.map((n) => n.group))
      uniqueGroups.forEach((group, index) => {
        this.groupColors.set(group, getGroupColor(index, uniqueGroups.size))
      })

      // Update controls with available filters
      if (this.controls) {
        this.controls.setAvailableTags(Array.from(this.graphData.tags.keys()))
        this.controls.setAvailableFolders(Array.from(this.graphData.clusters.keys()))
      }

      // Render legend
      this.renderLegend()

      // Initialize D3
      this.initD3(canvas)

      // Update stats
      this.updateStats()
    } catch (e) {
      console.error('Failed to load graph data', e)
      this.showError('Failed to load graph data.')
    }
  }

  private initD3(canvas: HTMLElement): void {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // Create SVG
    this.svg = d3
      .select(canvas)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'graph-svg')

    // Add defs for gradients/filters
    const defs = this.svg.append('defs')

    // Glow filter for active/hovered nodes
    const glowFilter = defs
      .append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')

    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur')

    const feMerge = glowFilter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Arrow marker for directed links (smaller)
    defs
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -3 6 6')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-3L6,0L0,3')
      .attr('fill', 'var(--text-soft)')
      .attr('opacity', 0.6)

    // Highlighted arrow marker (for hover state)
    defs
      .append('marker')
      .attr('id', 'arrow-highlighted')
      .attr('viewBox', '0 -3 6 6')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-3L6,0L0,3')
      .attr('fill', 'var(--primary)')

    // Main group for zoom/pan
    this.g = this.svg.append('g').attr('class', 'graph-container')

    // Zoom behavior
    this.zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        this.g?.attr('transform', event.transform)
      })

    this.svg.call(this.zoom)

    // Initialize simulation
    this.initSimulation(width, height)

    // Render graph
    this.renderGraph()
  }

  private initSimulation(width: number, height: number): void {
    if (!this.filteredData) return

    this.simulation = d3
      .forceSimulation<GraphNode, GraphLink>(this.filteredData.nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(this.filteredData.links)
          .id((d) => d.id)
          .distance((d) => (d.bidirectional ? 80 : 120))
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength(this.forceStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide<GraphNode>().radius((d) => getNodeRadius(d) + 10)
      )
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))

    this.simulation.on('tick', () => this.tick())
  }

  private renderGraph(): void {
    if (!this.g || !this.filteredData) return

    // Clear previous
    this.g.selectAll('.links').remove()
    this.g.selectAll('.nodes').remove()
    this.g.selectAll('.particles').remove()

    // Links
    const linkGroup = this.g.append('g').attr('class', 'links')
    this.linkSelection = linkGroup
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(this.filteredData.links)
      .enter()
      .append('line')
      .attr('class', (d) => `link ${d.bidirectional ? 'link--bidirectional' : ''}`)
      .attr('stroke-width', (d) => (d.bidirectional ? 2 : 1))
      .attr('marker-end', (d) => (d.bidirectional ? '' : 'url(#arrow)'))

    // Nodes
    const nodeGroup = this.g.append('g').attr('class', 'nodes')
    this.nodeSelection = nodeGroup
      .selectAll<SVGGElement, GraphNode>('g')
      .data(this.filteredData.nodes)
      .enter()
      .append('g')
      .attr('class', (d) => {
        let classes = 'node'
        if (d.isActive) classes += ' node--active'
        if (d.isOrphan) classes += ' node--orphan'
        if (d.isHub) classes += ' node--hub'
        return classes
      })
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => this.dragStarted(event, d))
          .on('drag', (event, d) => this.dragged(event, d))
          .on('end', (event, d) => this.dragEnded(event, d))
      )

    // Node circles
    this.nodeSelection
      .append('circle')
      .attr('r', (d) => getNodeRadius(d))
      .attr('fill', (d) => this.getNodeColor(d))
      .attr('filter', (d) => (d.isActive ? 'url(#glow)' : null))

    // Node labels
    this.nodeSelection
      .append('text')
      .attr('class', 'node__label')
      .attr('dx', (d) => getNodeRadius(d) + 4)
      .attr('dy', 4)
      .text((d) => d.title)
      .style('display', this.showLabels ? 'block' : 'none')

    // Node interactions
    this.nodeSelection
      .on('mouseenter', (_event, d) => this.handleNodeHover(d, true))
      .on('mouseleave', (_event, d) => this.handleNodeHover(d, false))
      .on('click', (_event, d) => this.handleNodeClick(d))

    // Particle group (for animated dots on links)
    this.particleGroup = this.g.append('g').attr('class', 'particles')

    // Restart simulation
    if (this.simulation) {
      this.simulation.nodes(this.filteredData.nodes)
      const linkForce = this.simulation.force('link') as d3.ForceLink<GraphNode, GraphLink>
      linkForce?.links(this.filteredData.links)
      this.simulation.alpha(1).restart()
    }
  }

  private tick(): void {
    if (!this.linkSelection || !this.nodeSelection) return

    this.linkSelection
      .attr('x1', (d) => (d.source as GraphNode).x || 0)
      .attr('y1', (d) => (d.source as GraphNode).y || 0)
      .attr('x2', (d) => (d.target as GraphNode).x || 0)
      .attr('y2', (d) => (d.target as GraphNode).y || 0)

    this.nodeSelection.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`)
  }

  private getNodeColor(node: GraphNode): string {
    if (node.isActive) {
      return '#fbbf24' // Gold for active
    }
    if (node.isOrphan) {
      return '#6b7280' // Gray for orphans
    }
    if (node.isHub) {
      return '#f97316' // Orange for hubs
    }
    return this.groupColors.get(node.group) || '#4fc1ff'
  }

  private handleNodeHover(node: GraphNode, isEntering: boolean): void {
    if (isEntering) {
      this.showTooltip(node)
      this.highlightConnections(node)
    } else {
      this.hideTooltip()
      this.clearHighlight()
    }
  }

  private highlightConnections(node: GraphNode): void {
    if (!this.linkSelection || !this.nodeSelection || !this.filteredData) return

    const connectedIds = new Set<string>([node.id])
    const connectedLinks: GraphLink[] = []

    // Find connected nodes and links
    this.filteredData.links.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      if (sourceId === node.id || targetId === node.id) {
        connectedLinks.push(link)
        connectedIds.add(sourceId)
        connectedIds.add(targetId)
      }
    })

    // Dim non-connected nodes
    this.nodeSelection
      .classed('node--dimmed', (d) => !connectedIds.has(d.id))
      .classed('node--highlighted', (d) => connectedIds.has(d.id) && d.id !== node.id)

    // Highlight connected links
    this.linkSelection
      .classed('link--highlighted', (link) => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id
        const targetId = typeof link.target === 'string' ? link.target : link.target.id
        return sourceId === node.id || targetId === node.id
      })
      .attr('marker-end', (link) => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id
        const targetId = typeof link.target === 'string' ? link.target : link.target.id
        const isHighlighted = sourceId === node.id || targetId === node.id
        if ((link as GraphLink).bidirectional) return ''
        return isHighlighted ? 'url(#arrow-highlighted)' : 'url(#arrow)'
      })

    // Start particle animations on connected links
    this.startParticleAnimations(node, connectedLinks)
  }

  private startParticleAnimations(hoveredNode: GraphNode, links: GraphLink[]): void {
    if (!this.particleGroup) return

    // Clear any existing animations
    this.stopParticleAnimations()

    // Performance limits
    const MAX_TOTAL_PARTICLES = 24
    const PARTICLES_PER_LINK = 2

    // Calculate how many particles per link based on total links
    const totalLinks = links.length
    const particlesPerLink = Math.min(
      PARTICLES_PER_LINK,
      Math.max(1, Math.floor(MAX_TOTAL_PARTICLES / totalLinks))
    )

    // Skip animation entirely if too many links (performance)
    if (totalLinks > 30) {
      return
    }

    // Prepare particle data for efficient rendering
    interface ParticleData {
      source: GraphNode
      target: GraphNode
      isOutgoing: boolean
      offset: number // 0 to 1, stagger position
      speed: number // duration in ms
    }

    const particleData: ParticleData[] = []

    links.forEach((link) => {
      const source = link.source as GraphNode
      const target = link.target as GraphNode
      const isOutgoing = source.id === hoveredNode.id

      for (let i = 0; i < particlesPerLink; i++) {
        particleData.push({
          source,
          target,
          isOutgoing,
          offset: i / particlesPerLink,
          speed: 2000 + Math.random() * 500 // Slight variation
        })
      }
    })

    // Create all particles at once (batch DOM operation)
    const particles = this.particleGroup
      .selectAll<SVGCircleElement, ParticleData>('.link-particle')
      .data(particleData)
      .enter()
      .append('circle')
      .attr('class', 'link-particle')
      .attr('r', 2.5)

    // Use requestAnimationFrame for smooth, batched animation
    let startTime: number | null = null
    let animationId: number

    const animate = (timestamp: number): void => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime

      particles.each(function (this: SVGCircleElement, d) {
        const duration = d.speed
        // Calculate progress with offset for stagger effect
        const progress = (elapsed / duration + d.offset) % 1

        // Get current positions (nodes may have moved due to simulation)
        const x1 = d.source.x || 0
        const y1 = d.source.y || 0
        const x2 = d.target.x || 0
        const y2 = d.target.y || 0

        // Interpolate position based on direction
        let x: number, y: number
        if (d.isOutgoing) {
          x = x1 + (x2 - x1) * progress
          y = y1 + (y2 - y1) * progress
        } else {
          x = x2 + (x1 - x2) * progress
          y = y2 + (y1 - y2) * progress
        }

        // Update position directly (no D3 transition overhead)
        this.setAttribute('cx', String(x))
        this.setAttribute('cy', String(y))
      })

      // Continue animation loop
      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)

    // Store the animation frame ID for cleanup (use negative to distinguish)
    this.activeParticleAnimations.push(-animationId)
  }

  private stopParticleAnimations(): void {
    // Clear all pending timeouts and animation frames
    this.activeParticleAnimations.forEach((id) => {
      if (id < 0) {
        cancelAnimationFrame(-id)
      } else {
        window.clearTimeout(id)
      }
    })
    this.activeParticleAnimations = []

    // Remove all particles
    this.particleGroup?.selectAll('.link-particle').remove()
  }

  private clearHighlight(): void {
    this.nodeSelection?.classed('node--dimmed', false).classed('node--highlighted', false)
    this.linkSelection
      ?.classed('link--highlighted', false)
      .attr('marker-end', (d) => ((d as GraphLink).bidirectional ? '' : 'url(#arrow)'))

    // Stop particle animations
    this.stopParticleAnimations()
  }

  private showTooltip(node: GraphNode): void {
    const tooltip = this.modal.querySelector('#graph-tooltip') as HTMLElement
    if (!tooltip) return

    const tags =
      node.tags.length > 0
        ? `<div class="graph-tooltip__tags">${node.tags.map((t) => `<span class="graph-tooltip__tag">#${t}</span>`).join('')}</div>`
        : ''

    tooltip.innerHTML = `
      <div class="graph-tooltip__title">${this.escapeHtml(node.title)}</div>
      <div class="graph-tooltip__meta">
        <span>${node.incomingCount} incoming</span>
        <span>•</span>
        <span>${node.outgoingCount} outgoing</span>
        ${node.path ? `<span>•</span><span>${node.path}</span>` : ''}
      </div>
      ${tags}
      ${node.isHub ? '<div class="graph-tooltip__badge graph-tooltip__badge--hub">Hub Note</div>' : ''}
      ${node.isOrphan ? '<div class="graph-tooltip__badge graph-tooltip__badge--orphan">Orphan</div>' : ''}
    `

    tooltip.classList.add('is-visible')

    // Position tooltip near mouse
    const updatePosition = (e: MouseEvent): void => {
      tooltip.style.left = `${e.clientX + 15}px`
      tooltip.style.top = `${e.clientY + 15}px`
    }

    this.modal.addEventListener('mousemove', updatePosition)
    tooltip.dataset.moveHandler = 'active'
  }

  private hideTooltip(): void {
    const tooltip = this.modal.querySelector('#graph-tooltip') as HTMLElement
    tooltip?.classList.remove('is-visible')
  }

  private handleNodeClick(node: GraphNode): void {
    // Path finding mode
    if (this.pathFindMode) {
      if (!this.pathFindStart) {
        // First click - set start
        this.pathFindStart = node.id
        this.highlightPathNode(node.id, 'start')
        this.updatePathFindHint('Now click on the destination node.')
      } else {
        // Second click - find path
        this.findAndHighlightPath(this.pathFindStart, node.id)
        this.endPathFindMode()
      }
      return
    }

    // Normal mode - open note
    const note = state.notes.find((n) => n.id === node.id)
    if (note) {
      this.close()
      window.dispatchEvent(
        new CustomEvent('knowledge-hub:open-note', {
          detail: { id: node.id, path: note.path }
        })
      )
    }
  }

  private renderLegend(): void {
    const legend = this.modal.querySelector('#graph-legend') as HTMLElement
    if (!legend) return

    legend.innerHTML = `
      <div class="graph-legend__title">Legend</div>
      <div class="graph-legend__items">
        <div class="graph-legend__item">
          <span class="graph-legend__dot" style="background: #fbbf24;"></span>
          <span>Active Note</span>
        </div>
        <div class="graph-legend__item">
          <span class="graph-legend__dot" style="background: #f97316;"></span>
          <span>Hub Note</span>
        </div>
        <div class="graph-legend__item">
          <span class="graph-legend__dot" style="background: #6b7280;"></span>
          <span>Orphan</span>
        </div>
        <div class="graph-legend__item">
          <span class="graph-legend__sizes">
            <span class="graph-legend__size graph-legend__size--sm"></span>
            <span class="graph-legend__size graph-legend__size--md"></span>
            <span class="graph-legend__size graph-legend__size--lg"></span>
          </span>
          <span>Size = Connections</span>
        </div>
      </div>
    `
  }

  private updateStats(): void {
    const stats = this.modal.querySelector('#graph-stats') as HTMLElement
    if (!stats || !this.filteredData) return

    const nodeCount = this.filteredData.nodes.length
    const linkCount = this.filteredData.links.length
    const orphanCount = this.filteredData.nodes.filter((n) => n.isOrphan).length

    stats.textContent = `${nodeCount} notes • ${linkCount} links • ${orphanCount} orphans`
  }

  // Control handlers
  private handleSearch(query: string): void {
    if (!this.graphData) return

    this.filteredData = filterNodes(this.graphData, {
      searchQuery: query,
      showOrphans: true,
      selectedTags: [],
      selectedFolders: []
    })

    this.renderGraph()
    this.updateStats()
  }

  private handleFilterChange(filters: GraphFilters): void {
    if (!this.graphData) return

    this.filteredData = filterNodes(this.graphData, {
      showOrphans: filters.showOrphans,
      selectedTags: filters.selectedTags,
      selectedFolders: filters.selectedFolders,
      localGraphCenter: this.localGraphEnabled ? state.activeId || undefined : undefined,
      localGraphDepth: this.localGraphEnabled ? this.localGraphDepth : undefined
    })

    this.renderGraph()
    this.updateStats()
    this.updateMinimap()
  }

  private handleZoom(factor: number): void {
    if (!this.svg || !this.zoom) return
    this.svg
      .transition()
      .duration(300)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(this.zoom.scaleBy as any, factor)
  }

  private handleZoomReset(): void {
    if (!this.svg || !this.zoom) return
    this.svg
      .transition()
      .duration(300)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(this.zoom.transform as any, d3.zoomIdentity)
  }

  private handleToggleLabels(show: boolean): void {
    this.showLabels = show
    this.nodeSelection?.selectAll('.node__label').style('display', show ? 'block' : 'none')
  }

  private handleForceStrengthChange(strength: number): void {
    this.forceStrength = -strength
    if (this.simulation) {
      const chargeForce = this.simulation.force('charge') as d3.ForceManyBody<GraphNode>
      chargeForce?.strength(this.forceStrength)
      this.simulation.alpha(0.5).restart()
    }
  }

  private handleDepthChange(depth: number): void {
    this.localGraphDepth = depth
    if (this.localGraphEnabled && this.graphData) {
      this.filteredData = filterNodes(this.graphData, {
        showOrphans: true,
        selectedTags: [],
        selectedFolders: [],
        localGraphCenter: state.activeId || undefined,
        localGraphDepth: depth
      })
      this.renderGraph()
      this.updateStats()
      this.updateMinimap()
    }
  }

  private handleToggleLocalGraph(enabled: boolean): void {
    this.localGraphEnabled = enabled
    if (this.graphData) {
      this.filteredData = filterNodes(this.graphData, {
        showOrphans: true,
        selectedTags: [],
        selectedFolders: [],
        localGraphCenter: enabled ? state.activeId || undefined : undefined,
        localGraphDepth: enabled ? this.localGraphDepth : undefined
      })
      this.renderGraph()
      this.updateStats()
      this.updateMinimap()
    }
  }

  private handleExport(format: 'svg' | 'png'): void {
    if (!this.svg) return

    const svgElement = this.svg.node()
    if (!svgElement) return

    // Clone SVG and prepare for export
    const clone = svgElement.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

    // Inline styles for export
    const styles = `
      .link { stroke: #6b7280; stroke-opacity: 0.5; }
      .link--bidirectional { stroke: #7fa7ff; }
      .link--highlighted { stroke: #7fa7ff; stroke-width: 3px; }
      .node circle { stroke: #1e1e1e; stroke-width: 2px; }
      .node__label { font-family: system-ui, sans-serif; font-size: 11px; fill: #e0e0e0; }
    `
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    styleEl.textContent = styles
    clone.insertBefore(styleEl, clone.firstChild)

    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(clone)
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })

    if (format === 'svg') {
      const url = URL.createObjectURL(svgBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vault-graph-${Date.now()}.svg`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      // PNG export using canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        canvas.width = img.width * 2 // 2x for retina
        canvas.height = img.height * 2
        ctx?.scale(2, 2)
        ctx?.drawImage(img, 0, 0)

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `vault-graph-${Date.now()}.png`
            a.click()
            URL.revokeObjectURL(url)
          }
        }, 'image/png')
      }

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)))
    }
  }

  private handleStartPathFind(): void {
    this.pathFindMode = true
    this.pathFindStart = null
    this.currentPath = []
    this.clearPathHighlight()

    const hint = this.modal.querySelector('#graph-pathfind-hint') as HTMLElement
    if (hint) {
      hint.style.display = 'flex'
      hint.querySelector('.graph-modal__pathfind-cancel')?.addEventListener('click', () => {
        this.endPathFindMode()
      })
    }

    this.updatePathFindHint('Click on a node to select the starting point.')
  }

  private endPathFindMode(): void {
    this.pathFindMode = false
    this.pathFindStart = null

    const hint = this.modal.querySelector('#graph-pathfind-hint') as HTMLElement
    if (hint) hint.style.display = 'none'
  }

  private updatePathFindHint(message: string): void {
    const hint = this.modal.querySelector('#graph-pathfind-hint') as HTMLElement
    if (hint) {
      const textNode = hint.childNodes[0]
      if (textNode) textNode.textContent = message + ' '
    }
  }

  private highlightPathNode(nodeId: string, type: 'start' | 'end' | 'path'): void {
    this.nodeSelection?.each(function (d) {
      if (d.id === nodeId) {
        const circle = d3.select(this).select('circle')
        if (type === 'start') {
          circle.attr('stroke', '#22c55e').attr('stroke-width', 4)
        } else if (type === 'end') {
          circle.attr('stroke', '#ef4444').attr('stroke-width', 4)
        } else {
          circle.attr('stroke', '#7fa7ff').attr('stroke-width', 3)
        }
      }
    })
  }

  private findAndHighlightPath(startId: string, endId: string): void {
    if (!this.graphData) return

    const path = findShortestPath(this.graphData, startId, endId)

    if (path.length === 0) {
      this.updatePathFindHint('No path found between these notes.')
      setTimeout(() => this.endPathFindMode(), 2000)
      return
    }

    this.currentPath = path

    // Highlight path nodes
    this.highlightPathNode(startId, 'start')
    this.highlightPathNode(endId, 'end')
    for (let i = 1; i < path.length - 1; i++) {
      this.highlightPathNode(path[i], 'path')
    }

    // Highlight path links
    const pathLinks = getPathLinks(this.graphData, path)
    this.linkSelection?.classed('link--path', (link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      return pathLinks.some((pl) => {
        const plSourceId = typeof pl.source === 'string' ? pl.source : pl.source.id
        const plTargetId = typeof pl.target === 'string' ? pl.target : pl.target.id
        return (
          (sourceId === plSourceId && targetId === plTargetId) ||
          (sourceId === plTargetId && targetId === plSourceId)
        )
      })
    })

    this.updatePathFindHint(`Path found: ${path.length} nodes (${path.length - 1} hops)`)
  }

  private clearPathHighlight(): void {
    this.nodeSelection?.selectAll('circle').attr('stroke', null).attr('stroke-width', null)
    this.linkSelection?.classed('link--path', false)
    this.currentPath = []
  }

  private updateMinimap(): void {
    if (!this.filteredData || !this.g) return

    const minimapContainer = this.modal.querySelector('#graph-minimap') as HTMLElement
    if (!minimapContainer) return

    // Clear existing minimap
    minimapContainer.innerHTML = ''

    const minimapWidth = 150
    const minimapHeight = 100

    // Calculate bounds
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity
    this.filteredData.nodes.forEach((n) => {
      if (n.x !== undefined && n.y !== undefined) {
        minX = Math.min(minX, n.x)
        maxX = Math.max(maxX, n.x)
        minY = Math.min(minY, n.y)
        maxY = Math.max(maxY, n.y)
      }
    })

    if (!isFinite(minX)) return

    const padding = 20
    const scaleX = (minimapWidth - padding * 2) / (maxX - minX || 1)
    const scaleY = (minimapHeight - padding * 2) / (maxY - minY || 1)
    const scale = Math.min(scaleX, scaleY, 1)

    this.minimap = d3
      .select(minimapContainer)
      .append('svg')
      .attr('width', minimapWidth)
      .attr('height', minimapHeight)
      .attr('class', 'graph-minimap__svg')

    const g = this.minimap.append('g').attr('transform', `translate(${padding}, ${padding})`)

    // Draw links
    g.selectAll('line')
      .data(this.filteredData.links)
      .enter()
      .append('line')
      .attr('x1', (d) => ((d.source as GraphNode).x! - minX) * scale)
      .attr('y1', (d) => ((d.source as GraphNode).y! - minY) * scale)
      .attr('x2', (d) => ((d.target as GraphNode).x! - minX) * scale)
      .attr('y2', (d) => ((d.target as GraphNode).y! - minY) * scale)
      .attr('stroke', 'var(--text-soft)')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 0.5)

    // Draw nodes
    g.selectAll('circle')
      .data(this.filteredData.nodes)
      .enter()
      .append('circle')
      .attr('cx', (d) => (d.x! - minX) * scale)
      .attr('cy', (d) => (d.y! - minY) * scale)
      .attr('r', 2)
      .attr('fill', (d) => (d.isActive ? '#fbbf24' : 'var(--primary)'))
  }

  // Drag handlers
  private dragStarted(
    event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>,
    d: GraphNode
  ): void {
    if (!event.active) this.simulation?.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  private dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode): void {
    d.fx = event.x
    d.fy = event.y
  }

  private dragEnded(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode): void {
    if (!event.active) this.simulation?.alphaTarget(0)
    d.fx = null
    d.fy = null
  }

  private showError(message: string): void {
    const canvas = this.modal.querySelector('#graph-canvas') as HTMLElement
    if (canvas) {
      canvas.innerHTML = `
        <div class="graph-modal__error">
          <span>${message}</span>
        </div>
      `
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
