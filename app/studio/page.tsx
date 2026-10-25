import { redirect } from 'next/navigation'

export default async function StudioHandoffPage({ searchParams }: { searchParams?: Promise<{ mode?: string }> }) {
  const params = await searchParams
  if (params?.mode === 'ai') redirect('/AI')
  if (params?.mode === 'wardrobe') redirect('/wardrobe')
  redirect('/bench')
}
