import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { loadAssetActor } from '@/lib/asset-api'
import { readRequestBodyWithLimit, RequestBodyTooLargeError } from '@/lib/request-body'

export const runtime = 'nodejs'
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
const MAX_REQUEST_BYTES = MAX_DOCUMENT_BYTES + 16 * 1024

type ProjectInput = { title: string; description: string; visibility: 'PRIVATE' | 'PUBLIC'; document: Record<string, unknown>; assetIds: string[] }

function parseProjectInput(value: unknown): ProjectInput | null {
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
  if (uniqueAssetIds.length !== assetIds.length) return null
  if (new TextEncoder().encode(JSON.stringify(document)).byteLength > MAX_DOCUMENT_BYTES) return null
  return { title, description, visibility, document: document as Record<string, unknown>, assetIds: uniqueAssetIds }
}

async function actorOrResponse() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { response: NextResponse.json({ error: '请先登录后管理创作项目。' }, { status: 401 }) }
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return { response: NextResponse.json({ error: '账号不可用。' }, { status: 403 }) }
  return { actor }
}

async function readInput(request: Request) {
  try {
    const raw = await readRequestBodyWithLimit(request.body, MAX_REQUEST_BYTES)
    return { input: parseProjectInput(JSON.parse(raw.toString('utf8'))) }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return { response: NextResponse.json({ error: '项目文档请求不能超过 8 MB。' }, { status: 413 }) }
    return { response: NextResponse.json({ error: '项目 JSON 格式无效。' }, { status: 400 }) }
  }
}

async function assetsBelongToActor(assetIds: string[], ownerId: string, projectId?: string) {
  if (!assetIds.length) return true
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds }, ownerId, OR: [{ projectId: null }, ...(projectId ? [{ projectId }] : [])] },
    select: { id: true },
  })
  return assets.length === assetIds.length
}

export async function GET() {
  const resolved = await actorOrResponse()
  if ('response' in resolved) return resolved.response
  const items = await prisma.project.findMany({
    where: { ownerId: resolved.actor.id },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 50,
    select: { id: true, title: true, description: true, visibility: true, revision: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const resolved = await actorOrResponse()
  if ('response' in resolved) return resolved.response
  const parsed = await readInput(request)
  if ('response' in parsed) return parsed.response
  if (!parsed.input) return NextResponse.json({ error: '项目标题、可见性、文档或素材引用无效。' }, { status: 400 })
  const input = parsed.input
  if (!(await assetsBelongToActor(input.assetIds, resolved.actor.id))) {
    return NextResponse.json({ error: '项目只能引用当前账号拥有且尚未归属其他项目的素材。' }, { status: 400 })
  }
  const item = await prisma.$transaction(async tx => {
    const project = await tx.project.create({
      data: {
        ownerId: resolved.actor.id,
        title: input.title,
        description: input.description,
        visibility: input.visibility,
        document: JSON.stringify(input.document),
      },
      select: { id: true, title: true, description: true, visibility: true, revision: true, createdAt: true, updatedAt: true },
    })
    if (input.assetIds.length) {
      await tx.asset.updateMany({ where: { id: { in: input.assetIds }, ownerId: resolved.actor.id, projectId: null }, data: { projectId: project.id } })
    }
    return project
  })
  return NextResponse.json({ item }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
}
