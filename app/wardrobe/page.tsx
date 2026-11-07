import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { legacyRedirectUrl, type LegacySearchParams } from '@/lib/legacy-route'

export default async function LegacyWardrobePage({
  searchParams,
}: {
  searchParams?: Promise<LegacySearchParams>
}) {
  const query = searchParams ? await searchParams : {}
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    const callbackUrl = legacyRedirectUrl('/wardrobe', query)
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  })
  if (!user?.username) redirect('/account')
  redirect(legacyRedirectUrl(`/u/${user.username}/wardrobe`, query))
}
