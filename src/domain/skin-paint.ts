export type Texel = { x: number; y: number }

export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Texel[] {
  const points: Texel[] = []
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let error = dx + dy
  let x = x0
  let y = y0

  while (true) {
    points.push({ x, y })
    if (x === x1 && y === y1) break
    const doubledError = 2 * error
    if (doubledError >= dy) {
      error += dy
      x += sx
    }
    if (doubledError <= dx) {
      error += dx
      y += sy
    }
  }
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
