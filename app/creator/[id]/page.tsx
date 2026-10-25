import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function PublicCreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await prisma.creatorProfile.findFirst({
    where: { OR: [{ id }, { userId: id }], reviewStatus: 'APPROVED' },
    select: { id: true, userId: true, displayName: true, bio: true },
  })
  if (!profile) notFound()

  return (
    <main className="inventory-shell cdpc-page">
      <header className="topbar cdpc-panel">
        <div><p className="eyebrow">CDPC CREATOR</p><h1>{profile.displayName}</h1></div>
        <Link className="pixel-button cdpc-control" href="/creator">创作者中心</Link>
      </header>
      <section className="hero inventory-panel cdpc-panel">
        <h2>创作者简介</h2>
        <p>{profile.bio?.trim() || '这位创作者还没有填写简介。'}</p>
        <p>此页面目前展示已审核通过的公开资料；作品列表将在作品公开数据接入后展示。</p>
      </section>
    </main>
  )
}
