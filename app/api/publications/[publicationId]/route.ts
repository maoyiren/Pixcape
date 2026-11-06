import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type Context = { params: Promise<{ publicationId: string }> }

export async function DELETE(_request: Request, context: Context) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })
  const { publicationId } = await context.params
  const result = await prisma.publication.updateMany({
    where: { id: publicationId, ownerId: session.user.id },
    data: { status: 'DRAFT', publishedAt: null },
  })
  if (!result.count) return NextResponse.json({ error: '发布记录不存在或无权修改。' }, { status: 404 })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
