import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { redirect } from 'next/navigation'
import { SignOutButton } from './sign-out-button'

const roleLabels: Record<string, string> = { USER: '普通账户', CREATOR: '创作者', ADMIN: '管理员' }
const statusLabels: Record<string, string> = { ACTIVE: '正常', SUSPENDED: '已暂停', DELETED: '已停用' }

export default async function AccountPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  return <main className="inventory-shell cdpc-page">
    <header className="topbar cdpc-panel"><div><p className="eyebrow">YOUR CDPC ACCOUNT</p><h1>我的账户</h1></div><Link className="pixel-button cdpc-control" href="/">返回首页</Link></header>
    <section className="hero inventory-panel cdpc-panel">
      <h2>账户资料</h2>
      <p>这里显示当前登录账户的基本信息与权限状态。</p>
      <p>账户：{session.user.name ?? session.user.email ?? session.user.id}</p>
      <p>账户类型：{roleLabels[session.user.role] ?? '普通账户'}</p>
      <p>账户状态：{statusLabels[session.user.status] ?? '未知'}</p>
      <div className="actions"><Link className="pixel-button cdpc-control" href="/creator">查看创作者中心</Link><SignOutButton /></div>
    </section>
  </main>
}
