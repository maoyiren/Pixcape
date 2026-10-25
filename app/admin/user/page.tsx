import Link from 'next/link'
import { requireRole } from '@/lib/require-role'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminUserPage() {
  await requireRole('ADMIN')
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  })
  return (
    <main className="inventory-shell cdpc-page">
      <header className="topbar cdpc-panel"><div><p className="eyebrow">ADMIN / USERS</p><h1>用户管理</h1></div><Link className="pixel-button cdpc-control" href="/admin">管理后台</Link></header>
      <section className="hero inventory-panel cdpc-panel">
        <p>最近注册的 {users.length} 个账户，最多显示 100 个。更改权限和状态请使用管理后台现有操作。</p>
        {users.map((user) => <article className="application-card cdpc-panel" key={user.id}><h2>{user.name || user.email || user.id}</h2><p>{user.email || '未设置邮箱'}</p><p>角色：{user.role} · 状态：{user.status}</p><p>注册时间：{user.createdAt.toISOString()}</p></article>)}
      </section>
    </main>
  )
}
