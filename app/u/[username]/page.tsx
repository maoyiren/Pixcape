import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { findUserSpace } from '@/lib/user-space'

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const found = await findUserSpace(username)
  if (!found) notFound()
  const canonical = found.user.username!
  if (found.isHistorical || username !== canonical) redirect(`/u/${canonical}`)

  const [assets, publications] = await Promise.all([
    prisma.asset.findMany({
      where: {
        ownerId: found.user.id,
        OR: [
          { visibility: 'PUBLIC' },
          { publications: { some: { status: 'PUBLISHED', publishedAt: { not: null } } } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      select: { id: true, category: true, attribution: true, updatedAt: true },
    }),
    prisma.publication.findMany({
      where: { ownerId: found.user.id, status: 'PUBLISHED', publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 12,
      select: { id: true, title: true, description: true, assetId: true, outfitId: true, publishedAt: true },
    }),
  ])

  return (
    <section>
      <p style={{ color: 'var(--mantine-color-dimmed)' }}>{found.user.creator?.bio || '这个创作者还没有填写个人介绍。'}</p>
      <h2>公开创作</h2>
      {publications.length ? <ul>{publications.map(item => <li key={item.id}>
        <strong>{item.title}</strong> — {item.description || '暂无介绍'}
        {item.outfitId ? <> · <Link href={`/outfit/${item.outfitId}`}>查看穿搭</Link></> : null}
        {item.assetId ? <> · <Link href={`/asset/${item.assetId}`}>查看素材</Link></> : null}
      </li>)}</ul> : <p>暂时没有公开发布的创作。</p>}
      <h2>公开素材</h2>
      {assets.length ? <ul>{assets.map(asset => <li key={asset.id}>
        <Link href={`/asset/${asset.id}`}>{asset.attribution || asset.category || '未命名素材'}</Link>
      </li>)}</ul> : <p>暂时没有公开素材。</p>}
    </section>
  )
}
