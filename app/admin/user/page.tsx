import Link from 'next/link'
import { requireRole } from '@/lib/require-role'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ q?: string; role?: string; status?: string }>

export default async function AdminUserPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireRole('ADMIN')
  const params = await searchParams
  const q = (params?.q ?? '').trim().slice(0, 100)
  const role = ['USER', 'CREATOR', 'ADMIN'].includes(params?.role ?? '') ? params?.role : ''
  const status = ['ACTIVE', 'SUSPENDED', 'DELETED'].includes(params?.status ?? '') ? params?.status : ''
  const users = await prisma.user.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { id: { contains: q } }] } : {}),
      ...(role ? { role: role as 'USER' | 'CREATOR' | 'ADMIN' } : {}),
      ...(status ? { status: status as 'ACTIVE' | 'SUSPENDED' | 'DELETED' } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  })

  return (
    <main className="inventory-shell cdpc-page">
      <header className="topbar cdpc-panel">
        <div><p className="eyebrow">ADMIN / USERS</p><h1>用户管理</h1></div>
        <Link className="pixel-button cdpc-control" href="/admin">管理后台</Link>
      </header>
      <section className="hero inventory-panel cdpc-panel">
        <h2>账户目录</h2>
        <p>按用户名、邮箱或账户 ID 搜索，并按角色和状态筛选。每次最多显示 100 个匹配账户。</p>
        <form method="get" action="/admin/user" className="application-form" aria-label="用户筛选">
          <label htmlFor="admin-user-q">搜索账户</label>
          <input id="admin-user-q" name="q" type="search" maxLength={100} defaultValue={q} placeholder="用户名、邮箱或账户 ID" />
          <label htmlFor="admin-user-role">角色</label>
          <select id="admin-user-role" name="role" defaultValue={role}>
            <option value="">全部角色</option>
            <option value="USER">用户</option>
            <option value="CREATOR">创作者</option>
            <option value="ADMIN">管理员</option>
          </select>
          <label htmlFor="admin-user-status">账户状态</label>
          <select id="admin-user-status" name="status" defaultValue={status}>
            <option value="">全部状态</option>
            <option value="ACTIVE">正常</option>
            <option value="SUSPENDED">已停用</option>
            <option value="DELETED">已删除</option>
          </select>
          <div className="actions">
            <button className="pixel-button primary cdpc-control cdpc-control-primary" type="submit">应用筛选</button>
            <Link className="pixel-button cdpc-control" href="/admin/user">清除筛选</Link>
          </div>
        </form>
        <p>匹配结果：{users.length} 个账户{q || role || status ? '（当前为筛选结果）' : ''}</p>
        {users.length ? users.map((user) => (
          <article className="application-card cdpc-panel" key={user.id}>
            <h2>{user.name || user.email || user.id}</h2>
            <p>{user.email || '未设置邮箱'}</p>
            <p>角色：{user.role} · 状态：{user.status}</p>
            <p>账户 ID：<code>{user.id}</code></p>
            <p>注册时间：{user.createdAt.toISOString()}</p>
          </article>
        )) : <p>没有找到匹配账户。请尝试修改搜索条件。</p>}
      </section>
    </main>
  )
}
