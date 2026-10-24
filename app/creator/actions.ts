'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function updateCreatorProfile(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, status: true },
  })
  if (!user || user.status !== 'ACTIVE') redirect('/login?error=account_unavailable')

  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 48)
  const bio = String(formData.get('bio') ?? '').trim().slice(0, 500)
  if (displayName.length < 2) redirect('/creator?error=display_name')

  // A creator profile is a personal workspace profile, not an application for creator identity.
  // Never accept role, ownerId, or verification status from the submitted form.
  await prisma.creatorProfile.upsert({
    where: { userId: user.id },
    update: { displayName, bio },
    create: { userId: user.id, displayName, bio, reviewStatus: 'NOT_SUBMITTED' },
  })
  if (user.role === 'USER') {
    await prisma.user.updateMany({
      where: { id: user.id, role: 'USER', status: 'ACTIVE' },
      data: { role: 'CREATOR' },
    })
  }
  redirect('/creator?saved=1')
}
