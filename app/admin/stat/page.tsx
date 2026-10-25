import Link from 'next/link'
import { requireRole } from '@/lib/require-role'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminStatsPage() {
  await requireRole('ADMIN')
  const [users, activeUsers, creators, auditEvents] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.creatorProfile.count(),
    prisma.auditLog.count(),
  ])
  return (
    <main className="inventory-shell cdpc-page">
      <header className="topbar cdpc-panel"><div><p className="eyebrow">ADMIN / STATS</p><h1>平台统计</h1></div><Link className="pixel-button cdpc-control" href="/admin">管理后台</Link></header>
      <section className="cdpc-tool-grid" aria-label="平台统计">
        {[['用户总数', users], ['正常账户', activeUsers], ['创作者资料', creators], ['审计事件', auditEvents]].map(([label, value]) => <article className="application-card cdpc-panel" key={String(label)}><h2>{label}</h2><p>{value}</p></article>)}
      </section>
      <p>统计基于当前数据库实时计数；不包含尚未接入的数据分析事件。</p>
    </main>
  )
}
