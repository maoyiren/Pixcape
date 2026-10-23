import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

const items = [
  { href: '/', label: '首页' },
  { href: '/studio', label: '创作工坊' },
  { href: '/creator', label: '创作者中心' },
]

export async function SiteNav() {
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user?.role === 'ADMIN' && session.user.status === 'ACTIVE'
  return (
    <header className="cdpc-app-header">
      <nav className="site-nav" aria-label="主导航">
        <Link className="site-brand" href="/" aria-label="CDPC 首页">
          <span className="site-brand-mark" aria-hidden="true">▦</span>
          <span className="site-brand-word">cdpc</span>
        </Link>
        <div className="site-nav-links">
          {items.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </div>
        <div className="site-nav-account">
          {session?.user ? (
            <>
              {isAdmin ? <Link className="site-nav-admin" href="/admin">管理后台</Link> : null}
              <Link className="site-nav-user" href="/account">{session.user.name || session.user.email || '我的账户'}</Link>
            </>
          ) : (
            <>
              <Link href="/login">登录</Link>
              <Link className="site-nav-join" href="/register">创建账户</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
