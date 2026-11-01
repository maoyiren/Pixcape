import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { deleteAssetForActor, loadAssetActor } from '@/lib/asset-api'

export const runtime = 'nodejs'

type Context = { params: Promise<{ assetId: string }> }

export async function DELETE(_request: Request, context: Context) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return NextResponse.json({ error: '账号不可用。' }, { status: 403 })
  const { assetId } = await context.params
  if (!assetId || assetId.length > 128) return NextResponse.json({ error: '素材 ID 无效。' }, { status: 400 })
  const deleted = await deleteAssetForActor(assetId, actor.id)
  if (!deleted) return NextResponse.json({ error: '素材不存在或无权删除。' }, { status: 404 })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
