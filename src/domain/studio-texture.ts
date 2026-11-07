export type StudioSkinTextureRole = 'base-skin' | 'clothing-overlay'

export type TextureDimensions = { width: number; height: number }

/** Minecraft classic/slim skin UV composition is only defined for 64×64 textures. */
export function validateStudioSkinTexture(
  dimensions: TextureDimensions,
  role: StudioSkinTextureRole,
): string | null {
  if (!Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height) || dimensions.width < 1 || dimensions.height < 1) {
    return '图片尺寸无效。'
  }
  if (dimensions.width !== 64 || dimensions.height !== 64) {
    return role === 'base-skin'
      ? '基础皮肤必须为 64×64 PNG。'
      : '服装贴图必须为 64×64 PNG，不能自动拉伸其他尺寸的图片。'
  }
  return null
}
