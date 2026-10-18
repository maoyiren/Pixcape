import Link from 'next/link'

const items = [
  { href: '/', label: '首页' },
  { href: '/studio/', label: '像素工作台' },
  { href: '/creator', label: '创作者中心' },
  { href: '/account', label: '个人中心' },
]

export function SiteNav() {
  return (
    <nav className="site-nav" aria-label="主导航">
      <Link className="site-brand" href="/" aria-label="Pixcape 首页">
        <span className="site-brand-mark" aria-hidden="true">P</span>
        <span>Pixcape</span>
      </Link>
      <div className="site-nav-links">
        {items.map((item) => (
          <Link href={item.href} key={item.href}>{item.label}</Link>
        ))}
      </div>
      <div className="site-nav-account">
        <Link href="/login">登录</Link>
        <Link className="site-nav-admin" href="/admin">管理后台</Link>
      </div>
    </nav>
  )
}
