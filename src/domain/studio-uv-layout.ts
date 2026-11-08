export type StudioOverlayCategory = '披肩' | '外套' | '帽子' | '裤子'
export type StudioUvProfile = {
  category: StudioOverlayCategory
  assetCategory: 'SHAWL' | 'COAT' | 'HAT' | 'PANTS'
  atlas: 'minecraft-skin'
  composition: 'full-atlas-alpha' | 'outer-layer-parts'
  targetParts: readonly ('head' | 'leftLeg' | 'rightLeg')[] | null
  mutuallyExclusiveWith: StudioOverlayCategory | null
}

/** Native Minecraft skin UV islands are rendered by skinview3d's model geometry. */
export const STUDIO_OVERLAY_UV_PROFILES: Record<StudioOverlayCategory, StudioUvProfile> = {
  披肩: { category: '披肩', assetCategory: 'SHAWL', atlas: 'minecraft-skin', composition: 'full-atlas-alpha', targetParts: null, mutuallyExclusiveWith: '外套' },
  外套: { category: '外套', assetCategory: 'COAT', atlas: 'minecraft-skin', composition: 'full-atlas-alpha', targetParts: null, mutuallyExclusiveWith: '披肩' },
  帽子: { category: '帽子', assetCategory: 'HAT', atlas: 'minecraft-skin', composition: 'outer-layer-parts', targetParts: ['head'], mutuallyExclusiveWith: null },
  裤子: { category: '裤子', assetCategory: 'PANTS', atlas: 'minecraft-skin', composition: 'outer-layer-parts', targetParts: ['leftLeg', 'rightLeg'], mutuallyExclusiveWith: null },
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
