import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { cleanupUploadedAssetAfterCreateFailure, deleteStoredAsset } from '@/lib/asset-storage'
import path from 'node:path'
import { parsePng } from '@/src/domain/png'
import { validateStudioSkinTexture } from '@/src/domain/studio-texture'
import { prisma } from '@/lib/prisma'
import { getS3AssetStorage } from '@/lib/s3-asset-storage'
import { buildAssetStorageKey, isS3AssetStorageKey } from '@/src/domain/asset-storage'
import type { AssetCategory, AssetKind, AssetSource, AssetVisibility } from '@/src/domain/asset'

const MAX_ASSET_BYTES = 8 * 1024 * 1024
const STORAGE_ROOT = path.resolve(process.env.ASSET_STORAGE_DIR || '/data/assets')

export class AssetInputError extends Error {
  constructor(message: string) { super(message); this.name = 'AssetInputError' }
}

export type AssetActor = { id: string; role: string; status: string }

export async function loadAssetActor(userId: string): Promise<AssetActor | null> {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true },
  })
  return actor?.status === 'ACTIVE' ? actor : null
}

function storagePath(storageKey: string) {
  if (!/^assets\/[a-f0-9-]+\.png$/i.test(storageKey)) throw new Error('Invalid storage key')
  return path.join(STORAGE_ROOT, path.basename(storageKey))
}

export async function saveAssetFile(input: {
  actorId: string
  file: File
  category: AssetCategory
  source: AssetSource
  visibility: AssetVisibility
  name?: string | null
  attribution?: string | null
  rightsDeclaration?: boolean
}) {
  if (!input.file || input.file.size < 1 || input.file.size > MAX_ASSET_BYTES) {
    throw new AssetInputError('图片大小必须在 1 B 至 8 MB 之间。')
  }
  if (input.file.type !== 'image/png') throw new AssetInputError('目前仅支持 PNG 图片。')
  const bytes = Buffer.from(await input.file.arrayBuffer())
  if (bytes.length !== input.file.size) throw new AssetInputError('上传文件大小校验失败。')
  let dimensions: { width: number; height: number }
  try { dimensions = parsePng(bytes) } catch (error) { throw new AssetInputError(error instanceof Error ? error.message : 'PNG 图片无效。') }
  if (input.category === 'SKIN') {
    const textureError = validateStudioSkinTexture(dimensions, 'base-skin')
    if (textureError) throw new AssetInputError(textureError)
  } else if (['SHAWL', 'COAT', 'HAT', 'PANTS', 'SHOES'].includes(input.category)) {
    // These categories use the Minecraft 64×64 / 128×128 skin atlas.
    // Cape is separate back equipment and has its own 64×32 texture contract.
    const textureError = validateStudioSkinTexture(dimensions, 'clothing-overlay')
    if (textureError) throw new AssetInputError(textureError)
  }

  const actor = await loadAssetActor(input.actorId)
  if (!actor) throw new AssetInputError('账号不可用。')
  if (input.visibility === 'PUBLIC' && actor.role !== 'CREATOR' && actor.role !== 'ADMIN') {
    throw new AssetInputError('只有创作者可以公开发布素材。')
  }

  const id = randomUUID()
  const kind: AssetKind = input.category === 'SKIN'
    ? 'SKIN_TEXTURE'
    : ['SHAWL', 'COAT', 'CAPE', 'PANTS'].includes(input.category)
      ? 'CLOTHING_TEXTURE'
      : 'ACCESSORY_TEXTURE'
  const s3Storage = await getS3AssetStorage()
  const storageKey = buildAssetStorageKey(id, Boolean(s3Storage))
  const filePath = s3Storage ? storageKey : storagePath(storageKey)
  if (s3Storage) {
    await s3Storage.put(storageKey, bytes, 'image/png')
  } else {
    await mkdir(STORAGE_ROOT, { recursive: true })
    await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 })
  }
  try {
    return await prisma.asset.create({
      data: {
        id,
        ownerId: actor.id,
        kind,
        category: input.category,
        storageKey,
        mimeType: 'image/png',
        byteSize: bytes.length,
        width: dimensions.width,
        height: dimensions.height,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        source: input.source,
        visibility: input.visibility,
        name: input.name?.trim().slice(0, 120) || null,
        attribution: input.attribution?.trim().slice(0, 500) || null,
        provenance: input.rightsDeclaration ? 'USER_CREATED' : 'UNKNOWN',
        downloadPolicy: input.rightsDeclaration ? 'OWNER_ONLY' : 'DENY',
      },
      select: {
        id: true, ownerId: true, kind: true, category: true, mimeType: true,
        byteSize: true, width: true, height: true, source: true, visibility: true,
        name: true, attribution: true, provenance: true, downloadPolicy: true, createdAt: true, updatedAt: true,
      },
    })
  } catch (error) {
    return cleanupUploadedAssetAfterCreateFailure(filePath, error, async (target) => {
      if (s3Storage) await s3Storage.delete(target)
      else await unlink(target)
    })
  }
}

export async function readAssetFile(assetId: string, actorId: string | null) {
  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      OR: [
        { visibility: { in: ['PUBLIC', 'UNLISTED'] } },
        ...(actorId ? [{ ownerId: actorId }] : []),
        { publications: { some: { status: 'PUBLISHED', publishedAt: { not: null } } } },
        { skinOutfits: { some: { publications: { some: { status: 'PUBLISHED', publishedAt: { not: null } } } } } },
        { outfitItems: { some: { outfit: { publications: { some: { status: 'PUBLISHED', publishedAt: { not: null } } } } } } },
      ],
    },
    select: { storageKey: true, mimeType: true, byteSize: true, visibility: true, provenance: true },
  })
  if (!asset || asset.provenance === 'OFFICIAL') return null
  const isS3Asset = isS3AssetStorageKey(asset.storageKey)
  const s3Storage = isS3Asset ? await getS3AssetStorage() : null
  if (isS3Asset && !s3Storage) throw new Error('S3 storage is not configured for this asset')
  const bytes = s3Storage ? await s3Storage.get(asset.storageKey) : await readFile(storagePath(asset.storageKey))
  if (bytes.length !== asset.byteSize) throw new Error('Stored asset integrity check failed')
  return { bytes, mimeType: asset.mimeType, visibility: asset.visibility }
}

/** Downloads are separate from preview delivery; unverified provenance is denied by default. */
export async function readAssetDownload(assetId: string, actorId: string | null) {
  if (!actorId) return null
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { ownerId: true, provenance: true, downloadPolicy: true, visibility: true, licenseId: true },
  })
  if (!asset) return null
  const ownerDownload = asset.provenance === 'USER_CREATED' && asset.downloadPolicy === 'OWNER_ONLY' && asset.ownerId === actorId
  const licensedDownload = asset.provenance === 'LICENSED' && asset.downloadPolicy === 'LICENSED_PUBLIC' && asset.visibility === 'PUBLIC' && Boolean(asset.licenseId)
  if (!ownerDownload && !licensedDownload) return null
  return readAssetFile(assetId, actorId)
}

export async function deleteAssetForActor(assetId: string, actorId: string) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, ownerId: actorId },
    select: { id: true, storageKey: true },
  })
  if (!asset) return false

  const isS3Asset = isS3AssetStorageKey(asset.storageKey)
  const s3Storage = isS3Asset ? await getS3AssetStorage() : null
  if (isS3Asset && !s3Storage) throw new Error('S3 storage is not configured for this asset')
  const deleteRecord = async () => {
    const deleted = await prisma.asset.deleteMany({ where: { id: assetId, ownerId: actorId } })
    return deleted.count
  }
  if (s3Storage) {
    return deleteStoredAsset(asset.storageKey, deleteRecord, {
      readFile: async (key) => s3Storage.get(key),
      unlink: async (key) => s3Storage.delete(key),
      writeFile: async (key, bytes) => s3Storage.put(key, Buffer.from(bytes), 'image/png'),
    })
  }
  return deleteStoredAsset(storagePath(asset.storageKey), deleteRecord)
}
