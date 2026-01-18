import type { GraphNode } from './types'

export class QuadTree {
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

export default QuadTree
