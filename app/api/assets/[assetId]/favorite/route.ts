import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { loadAssetActor } from '@/lib/asset-api'

export const runtime = 'nodejs'

type Context = { params: Promise<{ assetId: string }> }

async function resolveActor() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { response: NextResponse.json({ error: '请先登录。' }, { status: 401 }) }
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return { response: NextResponse.json({ error: '账号不可用。' }, { status: 403 }) }
  return { actor }
}

export async function PUT(_request: Request, context: Context) {
  const resolved = await resolveActor()
  if ('response' in resolved) return resolved.response
  const { assetId } = await context.params
  if (!assetId || assetId.length > 128) return NextResponse.json({ error: '素材 ID 无效。' }, { status: 400 })

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, OR: [{ ownerId: resolved.actor.id }, { visibility: 'PUBLIC' }] },
    select: { id: true },
  })
  if (!asset) return NextResponse.json({ error: '素材不存在或无权收藏。' }, { status: 404 })

  await prisma.assetFavorite.upsert({
    where: { userId_assetId: { userId: resolved.actor.id, assetId } },
    create: { userId: resolved.actor.id, assetId },
    update: {},
  })
  return NextResponse.json({ ok: true, favorited: true }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function DELETE(_request: Request, context: Context) {
  const resolved = await resolveActor()
  if ('response' in resolved) return resolved.response
  const { assetId } = await context.params
  if (!assetId || assetId.length > 128) return NextResponse.json({ error: '素材 ID 无效。' }, { status: 400 })

  await prisma.assetFavorite.deleteMany({
    where: { userId: resolved.actor.id, assetId },
  })
  return NextResponse.json({ ok: true, favorited: false }, { headers: { 'Cache-Control': 'private, no-store' } })
}
