import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { redirect } from 'next/navigation'
import { SignOutButton } from './sign-out-button'

const roleLabels: Record<string, string> = { USER: '普通账户', CREATOR: '创作者', ADMIN: '管理员' }
const statusLabels: Record<string, string> = { ACTIVE: '正常', SUSPENDED: '已暂停登录', DELETED: '已停用' }

export default async function AccountPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  return <main className="inventory-shell cdpc-page">
    <header className="topbar cdpc-panel"><div><p className="eyebrow">YOUR CDPC ACCOUNT</p><h1>我的账户</h1></div><Link className="pixel-button cdpc-control" href="/">返回首页</Link></header>
    <section className="hero inventory-panel cdpc-panel">
      <h2>账户资料</h2>
      <p>查看你的账户资料、账户类型与当前状态。</p>
      <p><strong>登录账户：</strong>{session.user.name ?? session.user.email ?? session.user.id}</p>
      <p><strong>账户类型：</strong>{roleLabels[session.user.role] ?? '普通账户'}</p>
      <p><strong>账户状态：</strong>{statusLabels[session.user.status] ?? '待确认'}</p>
      <div className="actions"><Link className="pixel-button cdpc-control" href="/creator">查看创作者中心</Link><SignOutButton /></div>
    </section>
  </main>
}
