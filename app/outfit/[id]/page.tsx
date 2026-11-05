import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export default async function OutfitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const outfit = await prisma.outfit.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true, name: true } },
      skinAsset: { select: { id: true, visibility: true, attribution: true } },
      items: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { asset: { select: { id: true, category: true, visibility: true, attribution: true } } },
      },
      publications: { where: { status: 'PUBLISHED', publishedAt: { not: null } }, select: { id: true, title: true } },
    },
  })
  if (!outfit) notFound()
  const isOwner = Boolean(session?.user?.id && session.user.id === outfit.ownerId)
  if (!isOwner && outfit.publications.length === 0) notFound()
  const canShowAsset = (visibility: string) => isOwner || visibility === 'PUBLIC' || visibility === 'UNLISTED'
  const skin = outfit.skinAsset && canShowAsset(outfit.skinAsset.visibility) ? outfit.skinAsset : null
  const items = outfit.items.filter(item => canShowAsset(item.asset.visibility))

  return <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px 64px' }}>
    <p><Link href={outfit.owner.username ? `/u/${outfit.owner.username}` : '/'}>返回创作者主页</Link></p>
    <h1>{outfit.name}</h1>
    <p>作者：{outfit.owner.name || outfit.owner.username || 'CDPC 用户'} · {outfit.skinModel === 'SLIM' ? 'Alex / Slim' : 'Steve / Classic'}</p>
    {outfit.publications[0] ? <p>{outfit.publications[0].title}</p> : null}
    {skin ? <section><h2>基础皮肤</h2><Link href={`/asset/${skin.id}`}>{skin.attribution || '查看皮肤素材'}</Link></section> : null}
    <section><h2>穿搭素材</h2>{items.length ? <ul>{items.map(item => <li key={item.id}>
      <Link href={`/asset/${item.asset.id}`}>{item.asset.attribution || item.asset.category || '穿搭素材'}</Link> · {item.category}
    </li>)}</ul> : <p>这套穿搭没有可公开显示的素材。</p>}</section>
    <p style={{ color: 'var(--mantine-color-dimmed)' }}>披肩、外套与披风是独立分类。Minecraft 官方披风不包含在皮肤 PNG 导出中。</p>
  </main>
}
