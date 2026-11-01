import 'server-only'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AssetCategorySchema, SkinModelSchema } from '@/src/domain/asset'

export { OutfitInputSchema, type OutfitInput } from '@/src/domain/outfit-input'
import { OutfitInputSchema, type OutfitInput } from '@/src/domain/outfit-input'
export async function validateOutfitAssets(actorId: string, input: OutfitInput) {
  const ids = [...new Set([
    ...(input.skinAssetId ? [input.skinAssetId] : []),
    ...input.items.map((item) => item.assetId),
  ])]
  if (!ids.length) return
  const assets = await prisma.asset.findMany({
    where: { id: { in: ids }, OR: [{ ownerId: actorId }, { visibility: 'PUBLIC' }] },
    select: { id: true, kind: true, category: true },
  })
  if (assets.length !== ids.length) throw new Error('搭配中包含不存在或无权使用的素材。')
  const byId = new Map(assets.map((asset) => [asset.id, asset]))
  if (input.skinAssetId) {
    const skin = byId.get(input.skinAssetId)
    if (!skin || skin.category !== 'SKIN' || skin.kind !== 'SKIN_TEXTURE') {
      throw new Error('基础皮肤必须引用有效的皮肤纹理素材。')
    }
  }
  for (const item of input.items) {
    const asset = byId.get(item.assetId)
    if (!asset || asset.category !== item.category || item.category === 'SKIN') {
      throw new Error('穿戴素材分类与实际素材不匹配。')
    }
    if (asset.kind !== 'CLOTHING_TEXTURE' && asset.kind !== 'ACCESSORY_TEXTURE') {
      throw new Error('该素材类型不能作为穿戴配件。')
    }
  }
}

const outfitInclude = {
  skinAsset: { select: { id: true, category: true, kind: true, width: true, height: true } },
  items: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: { asset: { select: { id: true, category: true, kind: true, width: true, height: true } } },
  },
}

export async function listOutfitsForActor(actorId: string) {
  return prisma.outfit.findMany({
    where: { ownerId: actorId },
    orderBy: { updatedAt: 'desc' },
    include: outfitInclude,
  })
}

export async function getOutfitForActor(actorId: string, outfitId: string) {
  return prisma.outfit.findFirst({
    where: { id: outfitId, ownerId: actorId },
    include: outfitInclude,
  })
}

export async function createOutfitForActor(actorId: string, input: OutfitInput) {
  await validateOutfitAssets(actorId, input)
  return prisma.outfit.create({
    data: {
      ownerId: actorId,
      name: input.name,
      skinAssetId: input.skinAssetId ?? null,
      skinModel: input.skinModel,
      background: input.background ?? null,
      pose: input.pose ?? null,
      items: { create: input.items.map((item) => ({
        assetId: item.assetId, category: item.category,
        sortOrder: item.sortOrder, equipped: item.equipped,
      })) },
    },
    include: outfitInclude,
  })
}

export async function updateOutfitForActor(actorId: string, outfitId: string, input: OutfitInput) {
  const current = await prisma.outfit.findFirst({ where: { id: outfitId, ownerId: actorId }, select: { id: true } })
  if (!current) return null
  await validateOutfitAssets(actorId, input)
  return prisma.$transaction(async (tx) => {
    await tx.outfit.update({
      where: { id: current.id },
      data: {
        name: input.name,
        skinAssetId: input.skinAssetId ?? null,
        skinModel: input.skinModel,
        background: input.background ?? null,
        pose: input.pose ?? null,
      },
    })
    await tx.outfitItem.deleteMany({ where: { outfitId: current.id } })
    if (input.items.length) {
      await tx.outfitItem.createMany({
        data: input.items.map((item) => ({
          outfitId: current.id, assetId: item.assetId, category: item.category,
          sortOrder: item.sortOrder, equipped: item.equipped,
        })),
      })
    }
    return tx.outfit.findUniqueOrThrow({ where: { id: current.id }, include: outfitInclude })
  })
}

export async function deleteOutfitForActor(actorId: string, outfitId: string) {
  const result = await prisma.outfit.deleteMany({ where: { id: outfitId, ownerId: actorId } })
  return result.count === 1
}
