import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { findUserSpace } from '@/lib/user-space'

export default async function UserSpaceLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const found = await findUserSpace(username)
  if (!found) notFound()
  const canonical = found.user.username!
  const base = `/u/${canonical}`
  return (
    <main className="cdpc-user-space" style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 64px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        {found.user.image ? <img src={found.user.image} alt="" width={52} height={52} style={{ borderRadius: '50%' }} /> : <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--mantine-color-default)' }}>▦</span>}
        <div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--mantine-color-dimmed)' }}>CDPC · USER SPACE</p>
          <strong style={{ fontSize: 20 }}>{found.user.creator?.displayName || found.user.name || canonical}</strong>
          <div style={{ color: 'var(--mantine-color-dimmed)', fontSize: 13 }}>@{canonical}</div>
        </div>
      </header>
      <nav aria-label="个人空间导航" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--mantine-color-default-border)', paddingBottom: 14, marginBottom: 24 }}>
        <Link href={base}>主页</Link>
        <Link href={`${base}/wardrobe`}>衣橱</Link>
        <Link href={`${base}/creations`}>创作</Link>
        <Link href={`${base}/assets`}>素材</Link>
        <Link href={`${base}/favorites`}>收藏</Link>
        <Link href={`${base}/settings`}>设置</Link>
      </nav>
      {children}
    </main>
  )
}
