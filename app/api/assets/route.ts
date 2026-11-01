import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { AssetInputError, loadAssetActor, saveAssetFile } from '@/lib/asset-api'
import { AssetCategorySchema, AssetVisibilitySchema } from '@/src/domain/asset'

export const runtime = 'nodejs'

const MAX_MULTIPART_BYTES = 9 * 1024 * 1024

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return NextResponse.json({ error: '账号不可用。' }, { status: 403 })

  const url = new URL(request.url)
  const category = url.searchParams.get('category')
  const cursor = url.searchParams.get('cursor')
  const requestedLimit = Number(url.searchParams.get('limit') || 30)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 60) : 30
  const parsedCategory = category ? AssetCategorySchema.safeParse(category) : null
  if (parsedCategory && !parsedCategory.success) return NextResponse.json({ error: '素材分类无效。' }, { status: 400 })

  const assets = await prisma.asset.findMany({
    where: {
      ...(parsedCategory?.success ? { category: parsedCategory.data } : {}),
      OR: [{ ownerId: actor.id }, { visibility: 'PUBLIC' }],
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, ownerId: true, kind: true, category: true, mimeType: true,
      byteSize: true, width: true, height: true, source: true, visibility: true,
      attribution: true, createdAt: true, updatedAt: true,
    },
  })
  const hasMore = assets.length > limit
  const data = hasMore ? assets.slice(0, limit) : assets
  return NextResponse.json({
    items: data.map((asset) => ({ ...asset, fileUrl: `/api/assets/${asset.id}/file` })),
    nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > MAX_MULTIPART_BYTES) return NextResponse.json({ error: '上传请求不能超过 9 MB。' }, { status: 413 })
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return NextResponse.json({ error: '账号不可用。' }, { status: 403 })

  try {
    const form = await request.formData()
    const file = form.get('file')
    const category = AssetCategorySchema.safeParse(form.get('category'))
    const visibility = AssetVisibilitySchema.safeParse(form.get('visibility') || 'PRIVATE')
    const attribution = form.get('attribution')
    if (!(file instanceof File)) return NextResponse.json({ error: '请选择 PNG 文件。' }, { status: 400 })
    if (!category.success || !visibility.success) {
      return NextResponse.json({ error: '素材分类、来源或可见性无效。' }, { status: 400 })
    }
    if (attribution !== null && typeof attribution !== 'string') {
      return NextResponse.json({ error: '署名格式无效。' }, { status: 400 })
    }
    const asset = await saveAssetFile({
      actorId: actor.id, file, category: category.data, source: 'UPLOAD',
      visibility: visibility.data, attribution: typeof attribution === 'string' ? attribution : null,
    })
    return NextResponse.json({ item: { ...asset, fileUrl: `/api/assets/${asset.id}/file` } }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof AssetInputError) return NextResponse.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({ error: '素材上传失败，请稍后重试。' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
