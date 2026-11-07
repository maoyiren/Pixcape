import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { loadAssetActor, readAssetDownload } from '@/lib/asset-api'

export const runtime = 'nodejs'

type Context = { params: Promise<{ assetId: string }> }

export async function GET(_request: Request, context: Context) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录后下载素材。' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return NextResponse.json({ error: '账号不可用。' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  const { assetId } = await context.params
  try {
    const asset = await readAssetDownload(assetId, actor.id)
    if (!asset) return NextResponse.json({ error: '该素材没有可用的下载授权。' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    return new Response(new Uint8Array(asset.bytes), {
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': String(asset.bytes.length),
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'attachment; filename="cdpc-asset.png"',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: '素材文件暂时不可用。' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
