import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

const items = [
  { href: '/', label: '首页' },
  { href: '/creator', label: '创作者中心' },
  { href: '/account', label: '个人中心' },
]

export async function SiteNav() {
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user?.role === 'ADMIN' && session.user.status === 'ACTIVE'
  return (
    <nav className="site-nav" aria-label="主导航">
      <Link className="site-brand" href="/" aria-label="Pixcape 首页">
        <span className="site-brand-mark" aria-hidden="true">P</span>
        <span>Pixcape</span>
      </Link>
      <div className="site-nav-links">
        {items.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        {isAdmin ? <Link href="/admin">管理后台</Link> : null}
      </div>
      <div className="site-nav-account">
        {session?.user ? <span className="site-nav-user">{session.user.name || session.user.email || '已登录'}</span> : <Link href="/login">登录</Link>}
        {!session?.user ? <Link className="site-nav-join" href="/register">注册</Link> : null}
      </div>
    </nav>
  )
}
