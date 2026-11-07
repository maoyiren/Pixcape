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
