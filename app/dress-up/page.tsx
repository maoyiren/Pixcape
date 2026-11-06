import { redirect } from 'next/navigation'
import { legacyRedirectUrl, type LegacySearchParams } from '@/lib/legacy-route'

export const metadata = {
  title: '角色穿搭 | CDPC',
  description: 'CDPC Studio 统一角色换装工作台。',
}

// Backward-compatible route. The single live outfit editor now lives at /studio.
export default async function DressUpCompatibilityRoute({
  searchParams,
}: {
  searchParams?: Promise<LegacySearchParams>
}) {
  redirect(legacyRedirectUrl('/studio', searchParams ? await searchParams : {}))
}
