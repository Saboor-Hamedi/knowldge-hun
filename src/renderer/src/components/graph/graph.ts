import * as d3 from 'd3'
import { state } from '../../core/state'
import './graph.css'
import '../window-header/window-header.css'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  title: string
  group: number
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
}

export class GraphView {
  private container: HTMLElement
  private modal: HTMLElement
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
  private simulation: d3.Simulation<GraphNode, GraphLink> | null = null
  private nodes: GraphNode[] = []
  private links: GraphLink[] = []

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
          </div>
          <div class="window-header__controls">
            <button class="wh-btn wh-close graph-modal__close" title="Close" aria-label="Close">×</button>
          </div>
        </div>
        <div class="graph-modal__canvas" id="graph-canvas"></div>
        <div class="graph-modal__controls">
            <span style="font-size: 12px; color: var(--text-soft);">Scroll to Zoom • Drag to Pan • Click Node to Open</span>
        </div>
      </div>
    `

    this.modal.querySelector('.graph-modal__close')?.addEventListener('click', () => this.close())
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
    
    // Check for API availability (requires restart after update)
    if (!window.api.getGraph) {
        alert('Graph API not found. Please restart the application to apply updates.')
        this.close()
        return
    }

    try {
        // Fetch Data
        const graphData = await window.api.getGraph()
        const allNotes = state.notes
        
        if (!graphData || !allNotes) return
    
        // Prepare Nodes
        this.nodes = allNotes.map(n => ({
            id: n.id,
            title: n.title || n.id,
            group: 1
        }))
        
        // Prepare Links
        // Filter links to ensure both source and target exist
        const nodeIds = new Set(this.nodes.map(n => n.id))
        this.links = graphData.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target)).map(l => ({
            source: l.source,
            target: l.target
        }))
    } catch (e) {
        console.error('Failed to load graph data', e)
        return
    }

    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // D3 Setup
    this.svg = d3.select(canvas).append('svg')
        .attr('width', width)
        .attr('height', height)
        .call(d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
            g.attr('transform', event.transform)
        }))

    const g = this.svg.append('g')

    this.simulation = d3.forceSimulation(this.nodes)
        .force('link', d3.forceLink(this.links).id((d: any) => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(20))

    const link = g.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(this.links)
        .enter().append('line')
        .attr('class', 'link')
        .attr('stroke-width', 1)

    const node = g.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(this.nodes)
        .enter().append('g')
        .attr('class', 'node')
        .call(d3.drag<SVGGElement, GraphNode>()
            .on('start', this.dragstarted.bind(this))
            .on('drag', this.dragged.bind(this))
            .on('end', this.dragended.bind(this)))

    node.append('circle')
        .attr('r', 5)
        .attr('fill', '#4fc1ff')

    node.append('text')
        .attr('dx', 8)
        .attr('dy', 3)
        .text(d => d.title)

    node.on('click', (_event, d) => {
        // Open the note
        const note = state.notes.find(n => n.id === d.id)
        if (note) {
            this.close()
            // Dispatch custom event or callback?
            // Since GraphView is imported in App, we can maybe pass a callback?
            // For now, let's emit a global event or assume app handles it?
            // Better: GraphView should accept an onNodeClick callback.
            // But for simplicity, let's dispatch a custom DOM event on window.
            window.dispatchEvent(new CustomEvent('knowledge-hub:open-note', { detail: { id: d.id, path: note.path } }))
        }
    })

    this.simulation.on('tick', () => {
        link
            .attr('x1', (d: any) => d.source.x)
            .attr('y1', (d: any) => d.source.y)
            .attr('x2', (d: any) => d.target.x)
            .attr('y2', (d: any) => d.target.y)

        node
            .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })
  }

  private dragstarted(event: any, d: any) {
    if (!event.active) this.simulation?.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  private dragged(event: any, d: any) {
    d.fx = event.x
    d.fy = event.y
  }

  private dragended(event: any, d: any) {
    if (!event.active) this.simulation?.alphaTarget(0)
    d.fx = null
    d.fy = null
  }
}
