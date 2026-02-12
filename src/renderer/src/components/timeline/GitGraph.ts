import { GitCommit } from './types'

const LANE_WIDTH = 12
const DOT_RADIUS = 3.5
const START_X = 10
const COLORS = [
  '#0ea5e9', // Sky Blue
  '#d946ef', // Fuchsia
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#84cc16' // Lime
]

interface Node {
  hash: string
  x: number
  y: number
  color: string
}

export class GitGraph {
  private svg: SVGSVGElement
  private commits: GitCommit[]
  private commitYPositions: Map<string, number>
  private commitNodes: Map<string, Node> = new Map()

  constructor(svg: SVGSVGElement, commits: GitCommit[], commitYPositions: Map<string, number>) {
    this.svg = svg
    this.commits = commits
    this.commitYPositions = commitYPositions
    this.render()
  }

  private render(): void {
    this.svg.innerHTML = ''
    this.commitNodes.clear()

    const lanes: (string | null)[] = [] // Maps lane index -> expected next commit hash
    const laneColors: string[] = [] // Maps lane index -> color
    let nextColorIdx = 0

    // Pass 1: Assign positions
    this.commits.forEach((commit) => {
      const y = this.commitYPositions.get(commit.hash)
      if (y === undefined) return // Should not happen if map is complete

      // Find lanes that point to this commit
      const matchingLanes: number[] = []
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] === commit.hash) {
          matchingLanes.push(i)
        }
      }

      let myLane = -1

      if (matchingLanes.length === 0) {
        // New branch tip (not expected by anyone)
        // Find first free lane
        const free = lanes.indexOf(null)
        if (free !== -1) {
          myLane = free
        } else {
          myLane = lanes.length
          lanes.push(null)
        }
        // Assign new color
        laneColors[myLane] = COLORS[nextColorIdx % COLORS.length]
        nextColorIdx++
      } else {
        // Continue the primary matched lane
        myLane = matchingLanes[0]
      }

      // Mark this commit's position
      const x = START_X + myLane * LANE_WIDTH
      this.commitNodes.set(commit.hash, {
        hash: commit.hash,
        x,
        y,
        color: laneColors[myLane] || COLORS[0]
      })

      // Update lanes for parents
      // Free the lanes that matched this commit (we consumed them)
      matchingLanes.forEach((l) => (lanes[l] = null))

      // Now propagate parents.
      if (commit.parents && commit.parents.length > 0) {
        // P0 takes the current lane (straight line usually)
        lanes[myLane] = commit.parents[0]

        // P1..Pn take new lanes
        for (let p = 1; p < commit.parents.length; p++) {
          const parentHash = commit.parents[p]
          if (!lanes.includes(parentHash)) {
            const free = lanes.indexOf(null)
            if (free !== -1) {
              lanes[free] = parentHash
              laneColors[free] = COLORS[nextColorIdx % COLORS.length]
              nextColorIdx++
            } else {
              lanes.push(parentHash)
              laneColors[lanes.length - 1] = COLORS[nextColorIdx % COLORS.length]
              nextColorIdx++
            }
          }
        }
      } else {
        // Root commit, lane terminates
        lanes[myLane] = null
      }
    })

    // Pass 2: Render
    // Draw paths first (behind dots)
    this.commits.forEach((commit) => {
      const node = this.commitNodes.get(commit.hash)
      if (!node) return

      if (commit.parents) {
        commit.parents.forEach((pHash, pIndex) => {
          const pNode = this.commitNodes.get(pHash)
          if (pNode) {
            // For primary parent (continuation/branching), use CHILD color
            // For secondary parents (merges), use PARENT color (the branch being merged)
            const strokeColor = pIndex === 0 ? node.color : pNode.color
            this.drawCurve(node.x, node.y, pNode.x, pNode.y, strokeColor)
          } else {
            // Parent not in view (truncated history), draw stub
            this.drawStub(node.x, node.y, node.color)
          }
        })
      }
    })

    // Draw dots and badges
    this.commits.forEach((commit) => {
      const node = this.commitNodes.get(commit.hash)
      if (!node) return

      this.drawDot(node.x, node.y, node.color)

      if (commit.refs && Array.isArray(commit.refs) && commit.refs.length > 0) {
        this.renderBadges(node.x + 12, node.y, commit.refs)
      }
    })
  }

  private drawCurve(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')

    // Bezier Logic
    // Vertical distance
    const distY = y2 - y1
    // Control point offset usually half distance, but capped for distinct turn
    const cpOffset = distY * 0.5 // Use half distance for smooth S-curve
    // const cpOffset = Math.min(distY * 0.5, 60)

    const d = `M ${x1} ${y1} C ${x1} ${y1 + cpOffset}, ${x2} ${y2 - cpOffset}, ${x2} ${y2}`

    path.setAttribute('d', d)
    path.setAttribute('stroke', color)
    path.setAttribute('stroke-width', '2') // Slightly thicker
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('opacity', '0.8')

    this.svg.appendChild(path)
  }

  private drawStub(x: number, y: number, color: string): void {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', x.toString())
    line.setAttribute('y1', y.toString())
    line.setAttribute('x2', x.toString())
    line.setAttribute('y2', (y + 25).toString()) // Longer stub
    line.setAttribute('stroke', color)
    line.setAttribute('stroke-width', '2')
    line.setAttribute('stroke-dasharray', '4,2')
    line.setAttribute('opacity', '0.5')
    this.svg.appendChild(line)
  }

  private drawDot(x: number, y: number, color: string): void {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', x.toString())
    circle.setAttribute('cy', y.toString())
    circle.setAttribute('r', DOT_RADIUS.toString())
    circle.setAttribute('fill', color)
    circle.setAttribute('stroke', 'var(--sidebar-bg, #1a1a1a)')
    circle.setAttribute('stroke-width', '2')
    this.svg.appendChild(circle)
  }

  private renderBadges(startX: number, y: number, refs: string[]): void {
    let currentX = startX
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')

    refs.forEach((ref) => {
      let text = ref.trim()
      let color = '#3b82f6' // blue

      if (text.startsWith('HEAD ->')) {
        text = text.replace('HEAD ->', '').trim()
        color = '#3b82f6' // blue active
      } else if (text === 'HEAD') {
        color = '#3b82f6'
      } else if (text.startsWith('tag:')) {
        text = text.replace('tag:', '').trim()
        color = '#10b981' // green
      } else if (text.startsWith('origin/')) {
        text = text.replace('origin/', '')
        color = '#8b5cf6' // purple
      } else {
        // Branch or other
        color = '#64748b' // slate
      }

      // Truncate long refs to avoid massive overflow
      const fullText = text
      if (text.length > 15) {
        text = text.substring(0, 12) + '...'
      }

      // Only show if text is not empty
      if (!text) return

      // SVG Text
      const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      textEl.textContent = text
      textEl.setAttribute('x', (currentX + 5).toString())
      textEl.setAttribute('y', (y + 3).toString()) // Baseline adj
      textEl.setAttribute('font-size', '10px')
      textEl.setAttribute('fill', '#fff')
      textEl.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif')
      textEl.setAttribute('font-weight', '500')
      if (fullText !== text) {
        textEl.innerHTML = `<title>${fullText}</title>` // Tooltip
      }

      // Approximate width
      const width = Math.max(text.length * 7 + 12, 24)

      // Background rect
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', currentX.toString())
      rect.setAttribute('y', (y - 7).toString())
      rect.setAttribute('width', width.toString())
      rect.setAttribute('height', '14')
      rect.setAttribute('rx', '3')
      rect.setAttribute('fill', color)
      // rect.setAttribute('opacity', '0.9')

      g.appendChild(rect)
      g.appendChild(textEl)

      currentX += width + 4
    })

    this.svg.appendChild(g)
  }
}
