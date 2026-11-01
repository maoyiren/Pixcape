import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { loadAssetActor } from '@/lib/asset-api'
import { deleteOutfitForActor, getOutfitForActor, OutfitInputSchema, updateOutfitForActor } from '@/lib/outfit-api'

export const runtime = 'nodejs'

type Context = { params: Promise<{ outfitId: string }> }

export async function GET(_request: Request, context: Context) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return NextResponse.json({ error: '账号不可用。' }, { status: 403 })
  const { outfitId } = await context.params
  const item = await getOutfitForActor(actor.id, outfitId)
  if (!item) return NextResponse.json({ error: '搭配不存在或无权访问。' }, { status: 404 })
  return NextResponse.json({ item }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PUT(request: Request, context: Context) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return NextResponse.json({ error: '账号不可用。' }, { status: 403 })
  const { outfitId } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: '请求 JSON 格式无效。' }, { status: 400 }) }
  const parsed = OutfitInputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: '搭配数据无效。', details: parsed.error.flatten() }, { status: 400 })
  try {
    const item = await updateOutfitForActor(actor.id, outfitId, parsed.data)
    if (!item) return NextResponse.json({ error: '搭配不存在或无权修改。' }, { status: 404 })
    return NextResponse.json({ item }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新搭配失败。'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: Context) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return NextResponse.json({ error: '账号不可用。' }, { status: 403 })
  const { outfitId } = await context.params
  const deleted = await deleteOutfitForActor(actor.id, outfitId)
  if (!deleted) return NextResponse.json({ error: '搭配不存在或无权删除。' }, { status: 404 })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
