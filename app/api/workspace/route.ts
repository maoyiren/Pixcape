import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { loadAssetActor } from '@/lib/asset-api'
import { WorkspacePointerSchema } from '@/src/domain/asset'

export const runtime = 'nodejs'

async function resolveActor() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { response: NextResponse.json({ error: '请先登录。' }, { status: 401 }) }
  const actor = await loadAssetActor(session.user.id)
  if (!actor) return { response: NextResponse.json({ error: '账号不可用。' }, { status: 403 }) }
  return { actor }
}

export async function GET() {
  const resolved = await resolveActor()
  if ('response' in resolved) return resolved.response

  const state = await prisma.workspaceState.findUnique({
    where: { userId: resolved.actor.id },
    select: { projectId: true, activeTool: true, activeAssetId: true, activeOutfitId: true, updatedAt: true },
  })
  return NextResponse.json({
    item: state ?? {
      projectId: null,
      activeTool: 'WARDROBE',
      activeAssetId: null,
      activeOutfitId: null,
      updatedAt: null,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PUT(request: Request) {
  const resolved = await resolveActor()
  if ('response' in resolved) return resolved.response

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: '请求 JSON 格式无效。' }, { status: 400 })
  }
  const parsed = WorkspacePointerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '工作区状态无效。', details: parsed.error.flatten() }, { status: 400 })
  }
  const pointer = parsed.data

  if (pointer.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: pointer.projectId, ownerId: resolved.actor.id },
      select: { id: true },
    })
    if (!project) return NextResponse.json({ error: '项目不存在或无权访问。' }, { status: 404 })
  }
  if (pointer.activeAssetId) {
    const asset = await prisma.asset.findFirst({
      where: { id: pointer.activeAssetId, OR: [{ ownerId: resolved.actor.id }, { visibility: 'PUBLIC' }] },
      select: { id: true },
    })
    if (!asset) return NextResponse.json({ error: '素材不存在或无权访问。' }, { status: 404 })
  }
  if (pointer.activeOutfitId) {
    const outfit = await prisma.outfit.findFirst({
      where: { id: pointer.activeOutfitId, ownerId: resolved.actor.id },
      select: { id: true },
    })
    if (!outfit) return NextResponse.json({ error: '搭配不存在或无权访问。' }, { status: 404 })
  }

  const state = await prisma.workspaceState.upsert({
    where: { userId: resolved.actor.id },
    create: {
      userId: resolved.actor.id,
      projectId: pointer.projectId,
      activeTool: pointer.activeTool,
      activeAssetId: pointer.activeAssetId,
      activeOutfitId: pointer.activeOutfitId,
    },
    update: {
      projectId: pointer.projectId,
      activeTool: pointer.activeTool,
      activeAssetId: pointer.activeAssetId,
      activeOutfitId: pointer.activeOutfitId,
    },
    select: { projectId: true, activeTool: true, activeAssetId: true, activeOutfitId: true, updatedAt: true },
  })
  return NextResponse.json({ item: state }, { headers: { 'Cache-Control': 'private, no-store' } })
}
