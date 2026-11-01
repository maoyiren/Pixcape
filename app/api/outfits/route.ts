import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { loadAssetActor } from '@/lib/asset-api'
import { createOutfitForActor, listOutfitsForActor, OutfitInputError, OutfitInputSchema } from '@/lib/outfit-api'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return NextResponse.json({ error: '账号不可用。' }, { status: 403 })
  const items = await listOutfitsForActor(actor.id)
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return NextResponse.json({ error: '账号不可用。' }, { status: 403 })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: '请求 JSON 格式无效。' }, { status: 400 }) }
  const parsed = OutfitInputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: '搭配数据无效。', details: parsed.error.flatten() }, { status: 400 })
  try {
    const item = await createOutfitForActor(actor.id, parsed.data)
    return NextResponse.json({ item }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof OutfitInputError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: '保存搭配失败，请稍后重试。' }, { status: 500 })
  }
}
