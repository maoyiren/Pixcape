import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { cleanupUploadedAssetAfterCreateFailure, deleteStoredAsset } from '@/lib/asset-storage'
import path from 'node:path'
import { parsePng } from '@/src/domain/png'
import { prisma } from '@/lib/prisma'
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
  attribution?: string | null
}) {
  if (!input.file || input.file.size < 1 || input.file.size > MAX_ASSET_BYTES) {
    throw new AssetInputError('图片大小必须在 1 B 至 8 MB 之间。')
  }
  if (input.file.type !== 'image/png') throw new AssetInputError('目前仅支持 PNG 图片。')
  const bytes = Buffer.from(await input.file.arrayBuffer())
  if (bytes.length !== input.file.size) throw new AssetInputError('上传文件大小校验失败。')
  let dimensions: { width: number; height: number }
  try { dimensions = parsePng(bytes) } catch (error) { throw new AssetInputError(error instanceof Error ? error.message : 'PNG 图片无效。') }
  if (input.category === 'SKIN' && (dimensions.width !== 64 || dimensions.height !== 64)) {
    throw new AssetInputError('Minecraft 皮肤必须为 64×64 PNG。')
  }

  const actor = await loadAssetActor(input.actorId)
  if (!actor) throw new AssetInputError('账号不可用。')
  if (input.visibility === 'PUBLIC' && actor.role !== 'CREATOR' && actor.role !== 'ADMIN') {
    throw new AssetInputError('只有创作者可以公开发布素材。')
  }

  const id = randomUUID()
  const storageKey = `assets/${id}.png`
  const kind: AssetKind = input.category === 'SKIN'
    ? 'SKIN_TEXTURE'
    : ['SHAWL', 'COAT', 'CAPE', 'PANTS'].includes(input.category)
      ? 'CLOTHING_TEXTURE'
      : 'ACCESSORY_TEXTURE'
  const filePath = storagePath(storageKey)
  await mkdir(STORAGE_ROOT, { recursive: true })
  await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 })
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
        attribution: input.attribution?.trim().slice(0, 500) || null,
      },
      select: {
        id: true, ownerId: true, kind: true, category: true, mimeType: true,
        byteSize: true, width: true, height: true, source: true, visibility: true,
        attribution: true, createdAt: true, updatedAt: true,
      },
    })
  } catch (error) {
    return cleanupUploadedAssetAfterCreateFailure(filePath, error)
  }
}

export async function readAssetFile(assetId: string, actorId: string) {
  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      OR: [{ ownerId: actorId }, { visibility: 'PUBLIC' }],
    },
    select: { storageKey: true, mimeType: true, byteSize: true, visibility: true },
  })
  if (!asset) return null
  const bytes = await readFile(storagePath(asset.storageKey))
  if (bytes.length !== asset.byteSize) throw new Error('Stored asset integrity check failed')
  return { bytes, mimeType: asset.mimeType, visibility: asset.visibility }
}

export async function deleteAssetForActor(assetId: string, actorId: string) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, ownerId: actorId },
    select: { id: true, storageKey: true },
  })
  if (!asset) return false

  return deleteStoredAsset(
    storagePath(asset.storageKey),
    async () => {
      const deleted = await prisma.asset.deleteMany({ where: { id: assetId, ownerId: actorId } })
      return deleted.count
    },
  )
}
