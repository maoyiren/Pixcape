export type PixelEditorLayer = { id: string; name: string; visible: boolean; opacity: number; pixels: string[] }
export type PixelEditorDocument = { version: 1; width: 64 | 128; height: 64 | 128; activeId: string; layers: PixelEditorLayer[] }

/** Validate and normalize untrusted local/cloud draft data before it enters editor state. */
export function normalizePixelEditorDocument(value: unknown): PixelEditorDocument | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  let width = input.width
  let height = input.height
  // Migrate the previous local draft shape, which stored only layers + activeId.
  if (input.version === undefined && width === undefined && height === undefined && Array.isArray(input.layers)) {
    const firstLayer = input.layers[0] as Record<string, unknown> | undefined
    const pixels = firstLayer && Array.isArray(firstLayer.pixels) ? firstLayer.pixels.length : 0
    width = pixels === 4096 ? 64 : pixels === 16384 ? 128 : undefined
    height = width
  }
  if (typeof width !== 'number' || (width !== 64 && width !== 128) || typeof height !== 'number' || height !== width || (input.version !== undefined && input.version !== 1) || !Array.isArray(input.layers) || input.layers.length < 1 || input.layers.length > 64) return null

  const ids = new Set<string>()
  const layers: PixelEditorLayer[] = []
  for (const candidate of input.layers) {
    if (!candidate || typeof candidate !== 'object') return null
    const layer = candidate as Record<string, unknown>
    if (typeof layer.id !== 'string' || !layer.id.trim() || ids.has(layer.id) || !Array.isArray(layer.pixels) || layer.pixels.length !== width * height) return null
    if (!layer.pixels.every(pixel => pixel === '' || (typeof pixel === 'string' && /^#[0-9a-f]{6}$/i.test(pixel)))) return null
    ids.add(layer.id)
    layers.push({
      id: layer.id,
      name: typeof layer.name === 'string' ? layer.name.trim().slice(0, 80) || '未命名图层' : '未命名图层',
      visible: layer.visible !== false,
      opacity: typeof layer.opacity === 'number' && Number.isFinite(layer.opacity) ? Math.max(0, Math.min(100, Math.round(layer.opacity))) : 100,
      pixels: layer.pixels as string[],
    })
  }
  const activeId = typeof input.activeId === 'string' && ids.has(input.activeId) ? input.activeId : layers[0].id
  return { version: 1, width, height: width, activeId, layers }
}
