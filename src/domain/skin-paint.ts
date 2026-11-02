export type Texel = { x: number; y: number }

/**
 * Return every texel touched by a straight brush stroke. The dominant-axis
 * error accumulator uses a strict negative threshold so half-way ties are
 * stable in both drawing directions (important for mirrored pointer travel).
 */
export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Texel[] {
  const points: Texel[] = []
  let x = x0
  let y = y0
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1

  if (dx >= dy) {
    let error = Math.floor(dx / 2)
    while (x !== x1) {
      points.push({ x, y })
      x += sx
      error -= dy
      if (error < 0) {
        y += sy
        error += dx
      }
    }
  } else {
    let error = Math.floor(dy / 2)
    while (y !== y1) {
      points.push({ x, y })
      y += sy
      error -= dx
      if (error < 0) {
        x += sx
        error += dy
      }
    }
  }
  points.push({ x: x1, y: y1 })
  return points
}

/** Convert Three.js UV coordinates (bottom-left origin) to top-left image texels. */
export function uvToTexel(u: number, v: number, size = 64): Texel {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('Texture size must be a positive integer')
  return {
    x: Math.min(Math.max(Math.floor(u * size), 0), size - 1),
    y: Math.min(Math.max(Math.floor((1 - v) * size), 0), size - 1),
  }
}
