import type { AssetProvenance, AssetDownloadPolicy } from './asset'

export type OutfitBackupGarmentCategory = '披肩' | '外套' | '披风' | '帽子' | '裤子' | '鞋子'
export type OutfitBackupAsset = {
  id: string
  assetId: string
  name: string
  category: OutfitBackupGarmentCategory
  texture: string
  fileUrl: string
  note: string
  attribution: string | null
  source: string
  visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC'
  provenance: AssetProvenance
  downloadPolicy: AssetDownloadPolicy
  canDownload: false
}

const categories = new Set<OutfitBackupGarmentCategory>(['披肩', '外套', '披风', '帽子', '裤子', '鞋子'])
const provenances = new Set<AssetProvenance>(['USER_CREATED', 'OFFICIAL', 'LICENSED', 'THIRD_PARTY', 'UNKNOWN'])
const policies = new Set<AssetDownloadPolicy>(['DENY', 'OWNER_ONLY', 'LICENSED_PUBLIC'])
const visibilities = new Set(['PRIVATE', 'UNLISTED', 'PUBLIC'])

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function safeId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null
}

/** Only restore same-origin, server-authorized asset references from a backup.
 * Never trust an imported URL, category, or client-claimed download permission.
 */
export function normalizeOutfitBackupAssets(value: unknown): OutfitBackupAsset[] {
  if (!Array.isArray(value)) return []
  const result: OutfitBackupAsset[] = []
  const seen = new Set<string>()
  // Bound work on untrusted JSON while allowing duplicate entries to collapse
  // without reducing the number of distinct assets restored (max 64).
  for (const raw of value.slice(0, 256)) {
    if (result.length >= 64) break
    const item = record(raw)
    if (!item) continue
    const id = safeId(item.id)
    const assetId = safeId(item.assetId)
    const category = item.category
    if (!id || assetId !== id || !categories.has(category as OutfitBackupGarmentCategory) || seen.has(id)) continue
    const provenance = provenances.has(item.provenance as AssetProvenance) ? item.provenance as AssetProvenance : 'UNKNOWN'
    const downloadPolicy = policies.has(item.downloadPolicy as AssetDownloadPolicy) ? item.downloadPolicy as AssetDownloadPolicy : 'DENY'
    // Official assets must never be carried into a portable outfit backup.
    if (provenance === 'OFFICIAL') continue
    const visibility = visibilities.has(String(item.visibility)) ? item.visibility as OutfitBackupAsset['visibility'] : 'PRIVATE'
    const fileUrl = `/api/assets/${encodeURIComponent(id)}/file`
    result.push({
      id,
      assetId: id,
      name: typeof item.name === 'string' ? item.name.slice(0, 120) : '导入的服装素材',
      category: category as OutfitBackupGarmentCategory,
      texture: fileUrl,
      fileUrl,
      note: '备份中的账号素材引用',
      attribution: typeof item.attribution === 'string' ? item.attribution.slice(0, 500) : null,
      source: typeof item.source === 'string' ? item.source.slice(0, 40) : 'IMPORT',
      visibility,
      provenance,
      downloadPolicy,
      canDownload: false,
    })
    seen.add(id)
  }
  return result
}

/** Skin references in backups must be relative CDPC asset routes, never arbitrary URLs. */
export function normalizeOutfitBackupSkinUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^\/api\/assets\/([A-Za-z0-9_-]{1,128})\/file(?:\?[^#]*)?$/.exec(value)
  return match ? `/api/assets/${encodeURIComponent(match[1])}/file` : undefined
}
