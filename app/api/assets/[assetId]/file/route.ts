import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { loadAssetActor, readAssetFile } from '@/lib/asset-api'

export const runtime = 'nodejs'

type Context = { params: Promise<{ assetId: string }> }

export async function GET(_request: Request, context: Context) {
  const session = await getServerSession(authOptions)
  const actor = session?.user?.id ? await loadAssetActor(session.user.id) : null
  const { assetId } = await context.params
  try {
    const asset = await readAssetFile(assetId, actor?.id ?? null)
    if (!asset) return NextResponse.json({ error: '素材不存在或无权访问。' }, { status: 404 })
    return new Response(new Uint8Array(asset.bytes), {
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': String(asset.bytes.length),
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
        'Cache-Control': asset.visibility === 'PUBLIC' ? 'public, max-age=300' : 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: '素材文件暂时不可用。' }, { status: 500 })
  }
}
