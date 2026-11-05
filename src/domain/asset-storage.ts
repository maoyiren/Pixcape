const ASSET_ID_PATTERN = /^[a-f0-9-]+$/i

export function buildAssetStorageKey(id: string, useS3: boolean): string {
  if (!ASSET_ID_PATTERN.test(id)) throw new Error('Invalid asset id')
  return `${useS3 ? 's3/' : ''}assets/${id}.png`
}

export function isS3AssetStorageKey(key: string): boolean {
  return /^s3\/assets\/[a-f0-9-]+\.png$/i.test(key)
}
