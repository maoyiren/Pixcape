import { redirect } from 'next/navigation'
import { legacyRedirectUrl, type LegacySearchParams } from '@/lib/legacy-route'

export const metadata = { title: 'Studio 角色换装 | CDPC' }

export default async function LegacyWorkbenchDressRoute({
  searchParams,
}: {
  searchParams?: Promise<LegacySearchParams>
}) {
  redirect(legacyRedirectUrl('/studio', searchParams ? await searchParams : {}))
}
