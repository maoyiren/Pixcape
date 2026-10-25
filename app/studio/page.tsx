import { redirect } from 'next/navigation'

export const metadata = { title: '创作工作台 | CDPC' }

export default async function StudioCompatibilityRoute({ searchParams }: { searchParams?: Promise<{ mode?: string }> }) {
  const params = await searchParams
  if (params?.mode === 'ai') redirect('/ai')
  if (params?.mode === 'wardrobe') redirect('/wardrobe')
  redirect('/editor')
}
