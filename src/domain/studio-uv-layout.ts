export type StudioOverlayCategory = '披肩' | '外套' | '帽子' | '裤子' | '鞋子'
export type StudioShoeUvRegion = {
  side: 'left' | 'right'
  u: number
  v: number
  width: number
  height: number
  depth: number
}
export type StudioUvProfile = {
  category: StudioOverlayCategory
  assetCategory: 'SHAWL' | 'COAT' | 'HAT' | 'PANTS' | 'SHOES'
  atlas: 'minecraft-skin'
  composition: 'full-atlas-alpha' | 'outer-layer-parts' | 'separate-box-geometry'
  targetParts: readonly ('head' | 'leftLeg' | 'rightLeg')[] | null
  mutuallyExclusiveWith: StudioOverlayCategory | null
}

/** Native Minecraft skin UV islands are rendered by skinview3d's model geometry. */
export const STUDIO_OVERLAY_UV_PROFILES: Record<StudioOverlayCategory, StudioUvProfile> = {
  披肩: { category: '披肩', assetCategory: 'SHAWL', atlas: 'minecraft-skin', composition: 'full-atlas-alpha', targetParts: null, mutuallyExclusiveWith: '外套' },
  外套: { category: '外套', assetCategory: 'COAT', atlas: 'minecraft-skin', composition: 'full-atlas-alpha', targetParts: null, mutuallyExclusiveWith: '披肩' },
  帽子: { category: '帽子', assetCategory: 'HAT', atlas: 'minecraft-skin', composition: 'outer-layer-parts', targetParts: ['head'], mutuallyExclusiveWith: null },
  裤子: { category: '裤子', assetCategory: 'PANTS', atlas: 'minecraft-skin', composition: 'outer-layer-parts', targetParts: ['leftLeg', 'rightLeg'], mutuallyExclusiveWith: null },
  鞋子: { category: '鞋子', assetCategory: 'SHOES', atlas: 'minecraft-skin', composition: 'separate-box-geometry', targetParts: null, mutuallyExclusiveWith: null },
}

/**
 * Minecraft outer-leg UVs are 4×12×4. Shoes occupy the bottom four texture
 * rows of each outer-leg island and are rendered as independent 4.5-unit boxes.
 * Coordinates are expressed in the canonical 64×64 atlas and scaled for 128px.
 */
export function getStudioShoeUvRegions(textureSize: 64 | 128): readonly StudioShoeUvRegion[] {
  const scale = textureSize / 64
  return [
    { side: 'right' as const, u: 0, v: 40, width: 4, height: 4, depth: 4 },
    { side: 'left' as const, u: 0, v: 56, width: 4, height: 4, depth: 4 },
  ].map(region => ({
    ...region,
    u: region.u * scale,
    v: region.v * scale,
    width: region.width * scale,
    height: region.height * scale,
    depth: region.depth * scale,
  }))
}

export type StudioUvRect = { x: number; y: number; width: number; height: number }

/** Atlas rectangles containing only the UV islands owned by each outer-layer category. */
export function getStudioOverlayUvRegions(
  category: '帽子' | '裤子' | '鞋子',
  textureSize: 64 | 128,
): readonly StudioUvRect[] {
  const scale = textureSize / 64
  const regions: Record<'帽子' | '裤子' | '鞋子', readonly StudioUvRect[]> = {
    帽子: [{ x: 32, y: 0, width: 24, height: 16 }],
    裤子: [{ x: 0, y: 32, width: 16, height: 16 }, { x: 0, y: 48, width: 16, height: 16 }],
    鞋子: [{ x: 0, y: 40, width: 16, height: 8 }, { x: 0, y: 56, width: 16, height: 8 }],
  }
  return regions[category].map(region => ({
    x: region.x * scale,
    y: region.y * scale,
    width: region.width * scale,
    height: region.height * scale,
  }))
}

export function getStudioOverlayUvProfile(category: StudioOverlayCategory): StudioUvProfile {
  const profile = STUDIO_OVERLAY_UV_PROFILES[category]
  if (!profile) throw new Error('该服装分类尚未定义真实 UV 布局。')
  return profile
}

export function canEquipStudioOverlayTogether(current: readonly StudioOverlayCategory[], incoming: StudioOverlayCategory): boolean {
  const conflict = getStudioOverlayUvProfile(incoming).mutuallyExclusiveWith
  return !conflict || current.every(category => category !== conflict)
}
