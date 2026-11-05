import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { UsernameSchema } from '@/src/domain/username'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  })
  if (!user) return NextResponse.json({ error: '账户不存在。' }, { status: 404 })
  return NextResponse.json({ username: user.username }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: '请求 JSON 格式无效。' }, { status: 400 })
  }
  const raw = body && typeof body === 'object' ? (body as { username?: unknown }).username : undefined
  const parsed = UsernameSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '用户名格式无效。' }, { status: 400 })
  }
  const username = parsed.data
  const userId = session.user.id

  try {
    const updated = await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { username: true } })
      if (!user) return { kind: 'missing' as const }
      if (user.username === username) return { kind: 'ok' as const, username }

      const currentOwner = await tx.user.findFirst({
        where: { username },
        select: { id: true },
      })
      const historicalOwner = await tx.userSlugHistory.findUnique({
        where: { username },
        select: { userId: true },
      })
      if (currentOwner || historicalOwner) return { kind: 'taken' as const }

      if (user.username) {
        const previous = await tx.userSlugHistory.findUnique({
          where: { username: user.username },
          select: { userId: true },
        })
        if (previous && previous.userId !== userId) return { kind: 'conflict' as const }
        if (!previous) {
          await tx.userSlugHistory.create({
            data: { userId, username: user.username },
          })
        }
      }

      await tx.user.update({ where: { id: userId }, data: { username } })
      return { kind: 'ok' as const, username }
    })

    if (updated.kind === 'missing') return NextResponse.json({ error: '账户不存在。' }, { status: 404 })
    if (updated.kind === 'taken') return NextResponse.json({ error: '该用户名已被使用或曾经使用，不能重复分配。' }, { status: 409 })
    if (updated.kind === 'conflict') return NextResponse.json({ error: '用户名历史记录冲突，请联系管理员。' }, { status: 409 })
    return NextResponse.json({ username: updated.username }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: '用户名更新失败，请稍后重试。' }, { status: 500 })
  }
}
