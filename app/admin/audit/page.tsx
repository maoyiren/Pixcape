import Link from 'next/link'
import { requireRole } from '@/lib/require-role'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminAuditPage() {
  await requireRole('ADMIN')
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, actorId: true, action: true, targetType: true, targetId: true, createdAt: true },
  })
  return (
    <main className="inventory-shell cdpc-page">
      <header className="topbar cdpc-panel"><div><p className="eyebrow">ADMIN / AUDIT</p><h1>审计日志</h1></div><Link className="pixel-button cdpc-control" href="/admin">管理后台</Link></header>
      <section className="hero inventory-panel cdpc-panel">
        <p>最近 {logs.length} 条管理审计记录，最多显示 100 条。</p>
        {logs.length ? <div className="application-form">{logs.map((log) => <article className="application-card cdpc-panel" key={log.id}><h2>{log.action}</h2><p>对象：{log.targetType} · {log.targetId}</p><p>操作者：{log.actorId}</p><p>{log.createdAt.toISOString()}</p></article>)}</div> : <p>暂无审计记录。</p>}
      </section>
    </main>
  )
}
