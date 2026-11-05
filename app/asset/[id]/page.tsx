import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const asset = await prisma.asset.findUnique({
    where: { id },
    select: {
      id: true, ownerId: true, category: true, kind: true, visibility: true,
      attribution: true, width: true, height: true, createdAt: true,
      owner: { select: { username: true, name: true } },
      publications: { where: { status: 'PUBLISHED', publishedAt: { not: null } }, select: { id: true } },
      skinOutfits: { where: { publications: { some: { status: 'PUBLISHED', publishedAt: { not: null } } } }, select: { id: true } },
      outfitItems: { where: { outfit: { publications: { some: { status: 'PUBLISHED', publishedAt: { not: null } } } } }, select: { id: true } },
    },
  })
  if (!asset) notFound()
  const isOwner = Boolean(session?.user?.id && session.user.id === asset.ownerId)
  const isShareable = asset.visibility === 'PUBLIC' || asset.visibility === 'UNLISTED'
  const isInPublishedContent = asset.publications.length > 0 || asset.skinOutfits.length > 0 || asset.outfitItems.length > 0
  if (!isOwner && !isShareable && !isInPublishedContent) notFound()

  return <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px 64px' }}>
    <p><Link href={asset.owner?.username ? `/u/${asset.owner.username}` : '/'}>返回创作者主页</Link></p>
    <h1>{asset.attribution || 'CDPC 素材'}</h1>
    <p>{asset.category || '未分类'} · {asset.width && asset.height ? `${asset.width} × ${asset.height}` : asset.kind} · {asset.visibility === 'PUBLIC' ? '公开分享' : asset.visibility === 'UNLISTED' ? '不公开列出' : '私人素材'}</p>
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 320, borderRadius: 16, background: 'var(--mantine-color-body)', padding: 24 }}>
      <img src={`/api/assets/${asset.id}/file`} alt={asset.attribution || 'CDPC 素材预览'} style={{ maxWidth: '100%', maxHeight: 560, objectFit: 'contain', imageRendering: 'pixelated' }} />
    </div>
    <p style={{ color: 'var(--mantine-color-dimmed)' }}>素材由用户上传或创作。CDPC 不代表 Mojang Studios 或 Microsoft。</p>
  </main>
}
