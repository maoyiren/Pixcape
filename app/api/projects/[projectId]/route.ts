import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { loadAssetActor } from '@/lib/asset-api'
import { readRequestBodyWithLimit, RequestBodyTooLargeError } from '@/lib/request-body'

export const runtime = 'nodejs'
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
const MAX_REQUEST_BYTES = MAX_DOCUMENT_BYTES + 16 * 1024
type RouteContext = { params: Promise<{ projectId: string }> }

function parseInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 80) : ''
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 500) : ''
  const visibility = input.visibility === 'PUBLIC' ? 'PUBLIC' : input.visibility === 'PRIVATE' || input.visibility === undefined ? 'PRIVATE' : null
  const document = input.document
  const assetIds = input.assetIds === undefined ? [] : input.assetIds
  if (!title || !visibility || !document || typeof document !== 'object' || Array.isArray(document)) return null
  if (!Array.isArray(assetIds) || assetIds.length > 100 || assetIds.some(id => typeof id !== 'string' || id.length < 1 || id.length > 128)) return null
  const uniqueAssetIds = [...new Set(assetIds as string[])]
  if (uniqueAssetIds.length !== assetIds.length || new TextEncoder().encode(JSON.stringify(document)).byteLength > MAX_DOCUMENT_BYTES) return null
  return { title, description, visibility, document: document as Record<string, unknown>, assetIds: uniqueAssetIds }
}

async function actorOrResponse() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { response: NextResponse.json({ error: '请先登录。' }, { status: 401 }) }
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return { response: NextResponse.json({ error: '账号不可用。' }, { status: 403 }) }
  return { actor }
}

async function readInput(request: Request) {
  try {
    const raw = await readRequestBodyWithLimit(request.body, MAX_REQUEST_BYTES)
    return { input: parseInput(JSON.parse(raw.toString('utf8'))) }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return { response: NextResponse.json({ error: '项目文档请求不能超过 8 MB。' }, { status: 413 }) }
    return { response: NextResponse.json({ error: '项目 JSON 格式无效。' }, { status: 400 }) }
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const resolved = await actorOrResponse()
  if ('response' in resolved) return resolved.response
  const { projectId } = await context.params
  const item = await prisma.project.findFirst({
    where: { id: projectId, ownerId: resolved.actor.id },
    include: { assets: { select: { id: true, category: true, name: true, mimeType: true, byteSize: true } } },
  })
  if (!item) return NextResponse.json({ error: '项目不存在或无权访问。' }, { status: 404 })
  let document: unknown
  try { document = JSON.parse(item.document) } catch {
    return NextResponse.json({ error: '云端项目文档已损坏，请联系管理员。' }, { status: 500 })
  }
  return NextResponse.json({
    item: {
      id: item.id, title: item.title, description: item.description, visibility: item.visibility,
      revision: item.revision, document, assets: item.assets,
      createdAt: item.createdAt, updatedAt: item.updatedAt,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PUT(request: Request, context: RouteContext) {
  const resolved = await actorOrResponse()
  if ('response' in resolved) return resolved.response
  const { projectId } = await context.params
  const parsed = await readInput(request)
  if ('response' in parsed) return parsed.response
  if (!parsed.input) return NextResponse.json({ error: '项目标题、可见性、文档或素材引用无效。' }, { status: 400 })
  const rawBody = await request.clone().json().catch(() => null) as Record<string, unknown> | null
  const revision = rawBody?.revision
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) {
    return NextResponse.json({ error: '项目版本号无效。' }, { status: 400 })
  }
  const input = parsed.input
  const result = await prisma.$transaction(async tx => {
    const current = await tx.project.findFirst({ where: { id: projectId, ownerId: resolved.actor.id }, select: { id: true, revision: true } })
    if (!current) return { kind: 'missing' as const }
    const assets = input.assetIds.length ? await tx.asset.findMany({
      where: { id: { in: input.assetIds }, ownerId: resolved.actor.id, OR: [{ projectId: null }, { projectId }] },
      select: { id: true },
    }) : []
    if (assets.length !== input.assetIds.length) return { kind: 'assets' as const }
    const updated = await tx.project.updateMany({
      where: { id: projectId, ownerId: resolved.actor.id, revision },
      data: {
        title: input.title, description: input.description, visibility: input.visibility,
        document: JSON.stringify(input.document), revision: { increment: 1 },
      },
    })
    if (updated.count !== 1) return { kind: 'conflict' as const }
    await tx.asset.updateMany({ where: { projectId, ownerId: resolved.actor.id, id: { notIn: input.assetIds } }, data: { projectId: null } })
    if (input.assetIds.length) await tx.asset.updateMany({
      where: { id: { in: input.assetIds }, ownerId: resolved.actor.id, OR: [{ projectId: null }, { projectId }] },
      data: { projectId },
    })
    const item = await tx.project.findFirst({
      where: { id: projectId, ownerId: resolved.actor.id },
      select: { id: true, title: true, description: true, visibility: true, revision: true, createdAt: true, updatedAt: true },
    })
    return { kind: 'updated' as const, item }
  })
  if (result.kind === 'missing') return NextResponse.json({ error: '项目不存在或无权访问。' }, { status: 404 })
  if (result.kind === 'assets') return NextResponse.json({ error: '项目只能引用当前账号拥有且未归属其他项目的素材。' }, { status: 400 })
  if (result.kind === 'conflict') {
    const current = await prisma.project.findFirst({ where: { id: projectId, ownerId: resolved.actor.id }, select: { revision: true } })
    if (!current) return NextResponse.json({ error: '项目不存在或无权访问。' }, { status: 404 })
    return NextResponse.json({ error: '项目已在其他位置更新，请先重新载入，避免覆盖新版本。', revision: current.revision }, { status: 409 })
  }
  return NextResponse.json({ item: result.item }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const resolved = await actorOrResponse()
  if ('response' in resolved) return resolved.response
  const { projectId } = await context.params
  const result = await prisma.project.deleteMany({ where: { id: projectId, ownerId: resolved.actor.id } })
  if (result.count !== 1) return NextResponse.json({ error: '项目不存在或无权访问。' }, { status: 404 })
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
