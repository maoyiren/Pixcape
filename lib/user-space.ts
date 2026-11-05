import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

const userSelect = {
  id: true,
  username: true,
  name: true,
  image: true,
  createdAt: true,
  creator: { select: { displayName: true, bio: true } },
} as const

export async function findUserSpace(username: string) {
  const normalized = username.trim().toLowerCase()
  const current = await prisma.user.findUnique({
    where: { username: normalized },
    select: userSelect,
  })
  if (current) return { user: current, isHistorical: false }

  const history = await prisma.userSlugHistory.findUnique({
    where: { username: normalized },
    select: { user: { select: userSelect } },
  })
  if (!history?.user?.username) return null
  return { user: history.user, isHistorical: true }
}

export async function requireUserSpaceOwner(username: string, suffix: string) {
  const found = await findUserSpace(username)
  if (!found) notFound()
  const canonical = found.user.username!
  if (found.isHistorical || username !== canonical) {
    redirect(`/u/${canonical}${suffix}`)
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/u/${canonical}${suffix}`)}`)
  }
  if (session.user.id !== found.user.id) notFound()
  return found.user
}
