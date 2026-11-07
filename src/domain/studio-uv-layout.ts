export type StudioOverlayCategory = '披肩' | '外套'
export type StudioUvProfile = {
  category: StudioOverlayCategory
  assetCategory: 'SHAWL' | 'COAT'
  atlas: 'minecraft-skin'
  composition: 'full-atlas-alpha'
  mutuallyExclusiveWith: StudioOverlayCategory
}

/**
 * CapeSkinImage's published example composes category-specific PNG atlases
 * directly onto skinCanvas. The PNG already contains its own pixel UV layout;
 * clipping both categories to a shared hand-written rectangle mask destroys it.
 */
export const STUDIO_OVERLAY_UV_PROFILES: Record<StudioOverlayCategory, StudioUvProfile> = {
  披肩: {
    category: '披肩',
    assetCategory: 'SHAWL',
    atlas: 'minecraft-skin',
    composition: 'full-atlas-alpha',
    mutuallyExclusiveWith: '外套',
  },
  外套: {
    category: '外套',
    assetCategory: 'COAT',
    atlas: 'minecraft-skin',
    composition: 'full-atlas-alpha',
    mutuallyExclusiveWith: '披肩',
  },
}

export function getStudioOverlayUvProfile(category: StudioOverlayCategory): StudioUvProfile {
  const profile = STUDIO_OVERLAY_UV_PROFILES[category]
  if (!profile) throw new Error('该服装分类尚未定义真实 UV 布局。')
  return profile
}

export function canEquipStudioOverlayTogether(
  current: readonly StudioOverlayCategory[],
  incoming: StudioOverlayCategory,
): boolean {
  return current.every(category => category === incoming)
}
