import { getStudioOverlayUvRegions } from '@/src/domain/studio-uv-layout'

export type StudioUvOverlayCategory = '帽子' | '裤子' | '鞋子'

/**
 * Replace only the UV islands owned by a garment category.
 *
 * Clearing before drawing is essential: drawImage alone alpha-composites over
 * the base skin and leaves old opaque pixels underneath transparent garment
 * pixels. Clearing makes transparent regions stay transparent in both the
 * live character atlas and the exported vanilla skin PNG.
 */
export function drawStudioOverlayUvRegions(
  context: Pick<CanvasRenderingContext2D, 'clearRect' | 'drawImage'>,
  overlay: CanvasImageSource,
  category: StudioUvOverlayCategory,
  textureSize: 64 | 128,
): void {
  for (const region of getStudioOverlayUvRegions(category, textureSize)) {
    context.clearRect(region.x, region.y, region.width, region.height)
    context.drawImage(
      overlay,
      region.x, region.y, region.width, region.height,
      region.x, region.y, region.width, region.height,
    )
  }
}
