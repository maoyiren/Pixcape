import { redirect } from 'next/navigation'

export const metadata = {
  title: '角色穿搭 | CDPC',
  description: 'CDPC Studio 统一角色换装工作台。',
}

// Backward-compatible route. The single live outfit editor now lives at /studio.
export default function DressUpCompatibilityRoute() {
  redirect('/studio')
}
