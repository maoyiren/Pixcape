import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export default async function LegacyAccountPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login?callbackUrl=%2Faccount')
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  })
  if (!user?.username) redirect('/login')
  redirect(`/u/${user.username}/settings`)
}
