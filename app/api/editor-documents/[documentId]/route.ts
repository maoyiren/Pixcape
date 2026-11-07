import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { loadAssetActor } from '@/lib/asset-api'
import { readRequestBodyWithLimit, RequestBodyTooLargeError } from '@/lib/request-body'

export const runtime = 'nodejs'
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024
const MAX_REQUEST_BYTES = MAX_DOCUMENT_BYTES + 4096

type RouteContext = { params: Promise<{ documentId: string }> }

function validateDocument(value: unknown): value is {
  version: 1
  width: 64 | 128
  height: 64 | 128
  activeId?: string | null
  layers: Array<{ id: string; name: string; visible: boolean; opacity: number; pixels: string[] }>
} {
  if (!value || typeof value !== 'object') return false
  const document = value as Record<string, unknown>
  if (document.version !== 1 || (document.width !== 64 && document.width !== 128) || document.height !== document.width) return false
  if (!Array.isArray(document.layers) || document.layers.length < 1 || document.layers.length > 24) return false
  if (document.activeId !== undefined && document.activeId !== null && typeof document.activeId !== 'string') return false
  return document.layers.every((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const layer = entry as Record<string, unknown>
    return typeof layer.id === 'string' && layer.id.length > 0 && layer.id.length <= 128
      && typeof layer.name === 'string' && layer.name.length <= 80
      && typeof layer.visible === 'boolean'
      && typeof layer.opacity === 'number' && Number.isInteger(layer.opacity) && layer.opacity >= 0 && layer.opacity <= 100
      && Array.isArray(layer.pixels) && layer.pixels.length === document.width * document.height
      && layer.pixels.every((pixel) => typeof pixel === 'string' && (pixel === '' || /^#[0-9a-f]{6}$/i.test(pixel)))
  })
}

async function actorOrResponse() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { response: NextResponse.json({ error: '请先登录。' }, { status: 401 }) }
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return { response: NextResponse.json({ error: '账号不可用。' }, { status: 403 }) }
  return { actor }
}

export async function GET(_request: Request, context: RouteContext) {
  const resolved = await actorOrResponse()
  if ('response' in resolved) return resolved.response
  const { documentId } = await context.params
  const item = await prisma.editorDocument.findFirst({
    where: { id: documentId, ownerId: resolved.actor.id },
  })
  if (!item) return NextResponse.json({ error: '编辑文档不存在或无权访问。' }, { status: 404 })
  let document: unknown
  try { document = JSON.parse(item.document) } catch {
    return NextResponse.json({ error: '云端编辑文档已损坏，请联系管理员。' }, { status: 500 })
  }
  return NextResponse.json({ item: { id: item.id, name: item.name, revision: item.revision, createdAt: item.createdAt, updatedAt: item.updatedAt, document } }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function PUT(request: Request, context: RouteContext) {
  const resolved = await actorOrResponse()
  if ('response' in resolved) return resolved.response
  const { documentId } = await context.params
  let body: unknown
  try {
    const raw = await readRequestBodyWithLimit(request.body, MAX_REQUEST_BYTES)
    body = JSON.parse(raw.toString('utf8'))
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: '编辑文档请求不能超过 2 MB。' }, { status: 413 })
    return NextResponse.json({ error: '请求 JSON 格式无效。' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '编辑文档内容无效。' }, { status: 400 })
  const input = body as Record<string, unknown>
  const revision = input.revision
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) {
    return NextResponse.json({ error: '文档版本号无效。' }, { status: 400 })
  }
  if (!validateDocument(input.document)) return NextResponse.json({ error: '编辑文档结构无效。' }, { status: 400 })
  const serialized = JSON.stringify(input.document)
  if (new TextEncoder().encode(serialized).byteLength > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: '编辑文档超过 2 MB 限制。' }, { status: 413 })
  }
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : '未命名作品'
  const result = await prisma.editorDocument.updateMany({
    where: { id: documentId, ownerId: resolved.actor.id, revision },
    data: { name: name || '未命名作品', document: serialized, revision: { increment: 1 } },
  })
  if (result.count !== 1) {
    const exists = await prisma.editorDocument.findFirst({
      where: { id: documentId, ownerId: resolved.actor.id },
      select: { revision: true },
    })
    if (!exists) return NextResponse.json({ error: '编辑文档不存在或无权访问。' }, { status: 404 })
    return NextResponse.json({ error: '文档已在其他位置更新，请先重新载入，避免覆盖新版本。', revision: exists.revision }, { status: 409 })
  }
  const item = await prisma.editorDocument.findFirst({
    where: { id: documentId, ownerId: resolved.actor.id },
    select: { id: true, name: true, revision: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json({ item }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const resolved = await actorOrResponse()
  if ('response' in resolved) return resolved.response
  const { documentId } = await context.params
  const result = await prisma.editorDocument.deleteMany({ where: { id: documentId, ownerId: resolved.actor.id } })
  if (result.count !== 1) return NextResponse.json({ error: '编辑文档不存在或无权访问。' }, { status: 404 })
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
