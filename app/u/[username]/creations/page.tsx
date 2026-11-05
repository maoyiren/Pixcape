import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireUserSpaceOwner } from '@/lib/user-space'

export default async function PersonalCreationsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const user = await requireUserSpaceOwner(username, '/creations')
  const [outfits, documents, publications] = await Promise.all([
    prisma.outfit.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: 'desc' }, take: 100, select: { id: true, name: true, updatedAt: true } }),
    prisma.editorDocument.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: 'desc' }, take: 100, select: { id: true, name: true, updatedAt: true } }),
    prisma.publication.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: 'desc' }, take: 100, select: { id: true, title: true, status: true, updatedAt: true } }),
  ])
  return <section><h1>我的创作</h1>
    <h2>穿搭</h2>{outfits.length ? <ul>{outfits.map(item => <li key={item.id}><Link href={`/outfit/${item.id}`}>{item.name}</Link></li>)}</ul> : <p>还没有保存穿搭。<Link href="/studio">进入 Studio</Link></p>}
    <h2>编辑作品</h2>{documents.length ? <ul>{documents.map(item => <li key={item.id}>{item.name} · {item.updatedAt.toLocaleDateString()}</li>)}</ul> : <p>还没有编辑作品。</p>}
    <h2>发布记录</h2>{publications.length ? <ul>{publications.map(item => <li key={item.id}>{item.title} · {item.status}</li>)}</ul> : <p>还没有发布内容。</p>}
  </section>
}
