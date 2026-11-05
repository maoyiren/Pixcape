import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getAuthOptions } from '@/auth'
import { hasMinimumRole, type AppRole } from '@/lib/authorization'

export async function requireRole(required: AppRole) {
  const session = await getServerSession(await getAuthOptions())
  if (!session?.user?.id) redirect('/login')
  if (session.user.status !== 'ACTIVE') redirect('/login?error=account_unavailable')
  if (!hasMinimumRole(session.user.role, required)) redirect('/?error=forbidden')
  return session.user
}
