import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

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
          <Link href="/" className="site-nav-home">首页</Link>
          <Link href="/dress-up" className="site-nav-dress">角色穿搭</Link>
          <details className="site-nav-menu">
            <summary>创作工具</summary>
            <div className="site-nav-dropdown">
              <Link href="/ai"><strong>AI 创作</strong><small>从文字或参考图生成皮肤</small></Link>
              <Link href="/editor"><strong>单品编辑器</strong><small>编辑与调整 64 × 64 皮肤</small></Link>
              <Link href="/workbench"><strong>创作工坊</strong><small>继续你的创作项目</small></Link>
            </div>
          </details>
          <Link href="/wardrobe">我的衣橱</Link>
          <Link href="/creator">创作者中心</Link>
        </div>
        <div className="site-nav-account">
          {session?.user ? (
            <>
              {isAdmin ? <Link className="site-nav-admin" href="/admin">管理后台</Link> : null}
              <Link className="site-nav-user" href="/account" title="打开个人中心">
                <span className="site-nav-avatar" aria-hidden="true">我</span>
                <span>我的账户</span>
              </Link>
            </>
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
