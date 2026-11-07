import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { AssetInputError, loadAssetActor, saveAssetFile } from '@/lib/asset-api'
import { AssetCategorySchema, AssetVisibilitySchema } from '@/src/domain/asset'
import { readRequestBodyWithLimit, RequestBodyTooLargeError } from '@/lib/request-body'

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
  const requestedIds = url.searchParams.get('ids')
  const ids = requestedIds ? [...new Set(requestedIds.split(',').map((id) => id.trim()).filter(Boolean))] : null
  if (ids && (ids.length > 65 || ids.some((id) => id.length > 128))) {
    return NextResponse.json({ error: '素材 ID 查询范围无效。' }, { status: 400 })
  }
  const requestedLimit = Number(url.searchParams.get('limit') || 30)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 60) : 30
  const parsedCategory = category ? AssetCategorySchema.safeParse(category) : null
  if (parsedCategory && !parsedCategory.success) return NextResponse.json({ error: '素材分类无效。' }, { status: 400 })

  const assets = await prisma.asset.findMany({
    where: {
      ...(parsedCategory?.success ? { category: parsedCategory.data } : {}),
      ...(ids ? { id: { in: ids } } : {}),
      OR: [{ ownerId: actor.id }, { visibility: 'PUBLIC' }],
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: ids ? Math.max(ids.length, 1) : limit + 1,
    ...(!ids && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, ownerId: true, kind: true, category: true, mimeType: true,
      byteSize: true, width: true, height: true, source: true, visibility: true,
      name: true, attribution: true, licenseId: true, provenance: true, downloadPolicy: true, createdAt: true, updatedAt: true,
      favorites: { where: { userId: actor.id }, select: { id: true } },
    },
  })
  const hasMore = !ids && assets.length > limit
  const data = hasMore ? assets.slice(0, limit) : assets
  return NextResponse.json({
    items: data.map(({ favorites, ...asset }) => ({
      ...asset,
      isFavorite: favorites.length > 0,
      canDownload: (asset.provenance === 'USER_CREATED' && asset.downloadPolicy === 'OWNER_ONLY' && asset.ownerId === actor.id)
        || (asset.provenance === 'LICENSED' && asset.downloadPolicy === 'LICENSED_PUBLIC' && asset.visibility === 'PUBLIC' && Boolean(asset.licenseId)),
      fileUrl: `/api/assets/${asset.id}/file`,
    })),
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
    const body = await readRequestBodyWithLimit(request.body, MAX_MULTIPART_BYTES)
    const boundedRequest = new Request(request.url, { method: 'POST', headers: request.headers, body: new Uint8Array(body) })
    const form = await boundedRequest.formData()
    const file = form.get('file')
    const category = AssetCategorySchema.safeParse(form.get('category'))
    const visibility = AssetVisibilitySchema.safeParse(form.get('visibility') || 'PRIVATE')
    const name = form.get('name')
    const attribution = form.get('attribution')
    const rightsDeclaration = form.get('rightsDeclaration')
    if (!(file instanceof File)) return NextResponse.json({ error: '请选择 PNG 文件。' }, { status: 400 })
    if (!category.success || !visibility.success) {
      return NextResponse.json({ error: '素材分类、来源或可见性无效。' }, { status: 400 })
    }
    if (name !== null && typeof name !== 'string') {
      return NextResponse.json({ error: '素材名称格式无效。' }, { status: 400 })
    }
    if (typeof name === 'string' && name.length > 120) {
      return NextResponse.json({ error: '素材名称不能超过 120 个字符。' }, { status: 400 })
    }
    if (attribution !== null && typeof attribution !== 'string') {
      return NextResponse.json({ error: '署名格式无效。' }, { status: 400 })
    }
    if (rightsDeclaration !== null && rightsDeclaration !== 'I_OWN_THE_RIGHTS') {
      return NextResponse.json({ error: '素材权利声明无效。' }, { status: 400 })
    }
    const asset = await saveAssetFile({
      actorId: actor.id, file, category: category.data, source: 'UPLOAD',
      visibility: visibility.data, name: typeof name === 'string' ? name : null, attribution: typeof attribution === 'string' ? attribution : null,
      rightsDeclaration: rightsDeclaration === 'I_OWN_THE_RIGHTS',
    })
    return NextResponse.json({ item: { ...asset, fileUrl: `/api/assets/${asset.id}/file` } }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: '上传请求不能超过 9 MB。' }, { status: 413, headers: { 'Cache-Control': 'no-store' } })
    if (error instanceof AssetInputError) return NextResponse.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({ error: '素材上传失败，请稍后重试。' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
