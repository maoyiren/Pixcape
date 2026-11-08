import { redirect } from 'next/navigation'
import { legacyRedirectUrl, type LegacySearchParams } from '@/lib/legacy-route'

export default async function LegacyWorkbenchAiRoute({
  searchParams,
}: {
  searchParams?: Promise<LegacySearchParams>
}) {
  redirect(legacyRedirectUrl('/ai', searchParams ? await searchParams : {}))
}
