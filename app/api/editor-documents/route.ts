import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { loadAssetActor } from '@/lib/asset-api'
import { readRequestBodyWithLimit, RequestBodyTooLargeError } from '@/lib/request-body'

export const runtime = 'nodejs'
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
const MAX_REQUEST_BYTES = MAX_DOCUMENT_BYTES + 4096

function validateDocument(value: unknown): value is {
  version: 1
  width: 64 | 128
  height: 64 | 128
  activeId?: string | null
  layers: Array<{ id: string; name: string; visible: boolean; opacity: number; pixels: string[] }>
} {
  if (!value || typeof value !== 'object') return false
  const document = value as Record<string, unknown>
  const width = document.width
  const height = document.height
  if (document.version !== 1 || typeof width !== 'number' || (width !== 64 && width !== 128) || typeof height !== 'number' || height !== width) return false
  if (!Array.isArray(document.layers) || document.layers.length < 1 || document.layers.length > 24) return false
  if (document.activeId !== undefined && document.activeId !== null && typeof document.activeId !== 'string') return false
  return document.layers.every((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const layer = entry as Record<string, unknown>
    return typeof layer.id === 'string' && layer.id.length > 0 && layer.id.length <= 128
      && typeof layer.name === 'string' && layer.name.length <= 80
      && typeof layer.visible === 'boolean'
      && typeof layer.opacity === 'number' && Number.isInteger(layer.opacity) && layer.opacity >= 0 && layer.opacity <= 100
      && Array.isArray(layer.pixels) && layer.pixels.length === width * height
      && layer.pixels.every((pixel) => typeof pixel === 'string' && (pixel === '' || /^#[0-9a-f]{6}$/i.test(pixel)))
  })
}

async function actorOrResponse() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { response: NextResponse.json({ error: '请先登录后保存编辑文档。' }, { status: 401 }) }
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return { response: NextResponse.json({ error: '账号不可用。' }, { status: 403 }) }
  return { actor }
}

export async function GET() {
  const resolved = await actorOrResponse()
  if ('response' in resolved) return resolved.response
  const items = await prisma.editorDocument.findMany({
    where: { ownerId: resolved.actor.id },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 50,
    select: { id: true, name: true, revision: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const resolved = await actorOrResponse()
  if ('response' in resolved) return resolved.response
  let body: unknown
  try {
    const raw = await readRequestBodyWithLimit(request.body, MAX_REQUEST_BYTES)
    body = JSON.parse(raw.toString('utf8'))
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: '编辑文档请求不能超过 8 MB。' }, { status: 413 })
    return NextResponse.json({ error: '请求 JSON 格式无效。' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '编辑文档内容无效。' }, { status: 400 })
  const input = body as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : '未命名作品'
  if (!validateDocument(input.document)) return NextResponse.json({ error: '编辑文档结构无效。' }, { status: 400 })
  const serialized = JSON.stringify(input.document)
  if (new TextEncoder().encode(serialized).byteLength > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: '编辑文档超过 8 MB 限制。' }, { status: 413 })
  }
  const item = await prisma.editorDocument.create({
    data: { ownerId: resolved.actor.id, name: name || '未命名作品', document: serialized },
    select: { id: true, name: true, revision: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json({ item }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
}
