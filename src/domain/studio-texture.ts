export type StudioSkinTextureRole = 'base-skin' | 'clothing-overlay'

export type TextureDimensions = { width: number; height: number }

/** Classic/slim skin UV layouts scale proportionally for 64×64 and 128×128 textures. */
export function validateStudioSkinTexture(
  dimensions: TextureDimensions,
  role: StudioSkinTextureRole,
): string | null {
  if (!Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height) || dimensions.width < 1 || dimensions.height < 1) {
    return '图片尺寸无效。'
  }
  if (!((dimensions.width === 64 && dimensions.height === 64) || (dimensions.width === 128 && dimensions.height === 128))) {
    return role === 'base-skin'
      ? '基础皮肤必须为 64×64 或 128×128 PNG。'
      : '服装贴图必须为 64×64 或 128×128 PNG，不能自动拉伸其他尺寸的图片。'
  }
  return null
}


export type StudioSkinModel = 'steve' | 'alex'

export type StudioOverlayTextureVariants = {
  texture: string
  texture128?: string
  modelTexture?: string
  modelTexture128?: string
}

/** Select the source-authored atlas matching both the player model and skin resolution. */
export function selectStudioOverlayTexture(
  variants: StudioOverlayTextureVariants,
  model: StudioSkinModel,
  size: 64 | 128,
): string {
  const selected = model === 'alex'
    ? size === 128 ? variants.modelTexture128 : variants.modelTexture
    : size === 128 ? variants.texture128 : variants.texture
  if (!selected) {
    throw new Error(`缺少 ${model === 'alex' ? 'Alex' : 'Steve'} ${size}×${size} 的服装贴图，已停止缩放替代。`)
  }
  return selected
}

/** Prevent browser canvas drawImage from silently stretching an overlay to another skin size. */
export function validateStudioOverlayMatchesBase(
  base: TextureDimensions,
  overlay: TextureDimensions,
): string | null {
  const baseError = validateStudioSkinTexture(base, 'base-skin')
  if (baseError) return baseError
  const overlayError = validateStudioSkinTexture(overlay, 'clothing-overlay')
  if (overlayError) return overlayError
  if (base.width !== overlay.width || base.height !== overlay.height) {
    return '服装贴图尺寸必须与当前皮肤一致（64×64 或 128×128），不会自动缩放。'
  }
  return null
}
