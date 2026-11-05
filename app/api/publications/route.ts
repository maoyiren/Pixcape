import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const PublishSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).default(''),
  assetId: z.string().min(1).optional(),
  outfitId: z.string().min(1).optional(),
}).refine(value => Boolean(value.assetId) !== Boolean(value.outfitId), {
  message: '一次只能发布一个素材或一套穿搭。',
})

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: '请求 JSON 格式无效。' }, { status: 400 })
  }
  const parsed = PublishSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || '发布信息无效。' }, { status: 400 })
  const input = parsed.data
  const ownerId = session.user.id

  try {
    const publication = await prisma.$transaction(async tx => {
      if (input.assetId) {
        const asset = await tx.asset.findFirst({
          where: { id: input.assetId, ownerId },
          select: { id: true },
        })
        if (!asset) return null
        await tx.asset.update({ where: { id: asset.id }, data: { visibility: 'PUBLIC' } })
        return tx.publication.create({
          data: {
            ownerId, assetId: asset.id, title: input.title,
            description: input.description, status: 'PUBLISHED', publishedAt: new Date(),
          },
        })
      }

      const outfit = await tx.outfit.findFirst({
        where: { id: input.outfitId, ownerId },
        select: {
          id: true, skinAssetId: true,
          items: { select: { assetId: true } },
        },
      })
      if (!outfit) return null
      const assetIds = [...new Set([
        ...(outfit.skinAssetId ? [outfit.skinAssetId] : []),
        ...outfit.items.map(item => item.assetId),
      ])]
      if (assetIds.length) {
        const assets = await tx.asset.findMany({
          where: { id: { in: assetIds }, OR: [{ ownerId }, { visibility: 'PUBLIC' }] },
          select: { id: true, ownerId: true },
        })
        if (assets.length !== assetIds.length) throw new Error('OUTFIT_ASSET_NOT_SHAREABLE')
        await tx.asset.updateMany({
          where: { id: { in: assetIds }, ownerId },
          data: { visibility: 'PUBLIC' },
        })
      }
      return tx.publication.create({
        data: {
          ownerId, outfitId: outfit.id, title: input.title,
          description: input.description, status: 'PUBLISHED', publishedAt: new Date(),
        },
      })
    })

    if (!publication) return NextResponse.json({ error: '素材或穿搭不存在，或不属于当前账户。' }, { status: 404 })
    return NextResponse.json({ item: publication, shareUrl: publication.outfitId ? `/outfit/${publication.outfitId}` : `/asset/${publication.assetId}` }, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'OUTFIT_ASSET_NOT_SHAREABLE') {
      return NextResponse.json({ error: '穿搭包含不可公开分享的私人素材，请先将相关素材上传到自己的账户或替换为公开素材。' }, { status: 400 })
    }
    return NextResponse.json({ error: '发布失败，请稍后重试。' }, { status: 500 })
  }
}
