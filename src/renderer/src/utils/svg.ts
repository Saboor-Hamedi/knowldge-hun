export function colorizeSvgString(svg: string, color?: string): string {
  if (!svg || !color) return svg
  // If svg already has a style attribute, append our color rules
  if (/style=/.test(svg)) {
    return svg.replace(/<svg([^>]*)style=("|')([^"']*)("|')/, (m, p1, q1, existing, q2) => {
      const merged = `${existing};stroke:${color};fill:${color};color:${color};`
      return `<svg${p1}style=${q1}${merged}${q2}`
    })
  }

  // Otherwise inject a fresh inline style into the opening <svg ...>
  return svg.replace(/<svg(\s*)([^>]*)>/, (m, s, attrs) => {
    return `<svg ${attrs} style="stroke:${color};fill:${color};color:${color};">`
  })
}

export default colorizeSvgString
