import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { AccountMenu } from './account-menu'

export async function SiteNav() {
  const session = await getServerSession(authOptions)
  const user = session?.user

  return (
    <header className="cdpc-app-header">
      <nav className="site-nav" aria-label="主导航">
        <Link className="site-brand" href="/" aria-label="CDPC 首页">
          <span className="site-brand-mark" aria-hidden="true">▦</span>
          <span className="site-brand-word">cdpc</span>
        </Link>
        <div className="site-nav-links">
          <Link href="/" className="site-nav-home">首页</Link>
          <Link href="/studio" className="site-nav-dress">Studio</Link>
          <details className="site-nav-menu">
            <summary>创作工具</summary>
            <div className="site-nav-dropdown">
              <Link href="/ai"><strong>AI 创作</strong><small>从文字或参考图生成皮肤</small></Link>
              <Link href="/editor"><strong>单品编辑器</strong><small>编辑与调整 64 × 64 皮肤</small></Link>
            </div>
          </details>
          <Link href="/creator">创作者中心</Link>
        </div>
        <div className="site-nav-account">
          {user ? (
            <AccountMenu
              name={user.name ?? '我的账户'}
              email={user.email ?? ''}
              role={user.role ?? 'USER'}
              status={user.status ?? 'ACTIVE'}
            />
          ) : (
            <>
              <Link href="/login">登录</Link>
              <Link className="site-nav-join" href="/register">注册</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
