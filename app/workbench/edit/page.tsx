import { redirect } from 'next/navigation'
import { legacyRedirectUrl, type LegacySearchParams } from '@/lib/legacy-route'

export default async function LegacyWorkbenchEditRoute({
  searchParams,
}: {
  searchParams?: Promise<LegacySearchParams>
}) {
  redirect(legacyRedirectUrl('/editor', searchParams ? await searchParams : {}))
}
