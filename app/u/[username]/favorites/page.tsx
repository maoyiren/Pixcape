import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireUserSpaceOwner } from '@/lib/user-space'

export default async function PersonalFavoritesPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const user = await requireUserSpaceOwner(username, '/favorites')
  const favorites = await prisma.assetFavorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { asset: { select: { id: true, category: true, attribution: true, visibility: true } } },
  })
  return <section><h1>我的收藏</h1>{favorites.length ? <ul>{favorites.map(item => <li key={item.id}>
    <Link href={`/asset/${item.asset.id}`}>{item.asset.attribution || item.asset.category || '未命名素材'}</Link>
    <small> · {item.asset.visibility === 'PUBLIC' ? '公开素材' : '私人素材'}</small>
  </li>)}</ul> : <p>你还没有收藏素材。</p>}</section>
}
