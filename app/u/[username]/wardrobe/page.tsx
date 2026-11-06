import WardrobeLibrary from '@/app/wardrobe/wardrobe-library'
import { requireUserSpaceOwner } from '@/lib/user-space'

export default async function PersonalWardrobePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  await requireUserSpaceOwner(username, '/wardrobe')
  return <WardrobeLibrary />
}
