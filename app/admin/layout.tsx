import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { requireRole } from '@/lib/require-role'
import { adminUrl } from '@/lib/admin-path'
import './admin.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { default: 'CDPC 管理控制台', template: '%s · CDPC 管理控制台' },
  robots: { index: false, follow: false, noarchive: true },
}

const sections = [
  { title: '工作台', items: [{ href: '/', label: '总览', icon: '▦' }] },
  { title: '账户与社区', items: [
    { href: '/user', label: '用户管理', icon: '♙' },
    { href: '/audit', label: '操作审计', icon: '≡' },
    { href: '/stat', label: '平台统计', icon: '▥' },
  ] },
  { title: '系统配置', items: [
    { href: '/auth', label: '登录与身份', icon: '⚿' },
    { href: '/ai', label: 'AI 服务与模型', icon: '✧' },
    { href: '/mail', label: '邮件服务', icon: '✉' },
    { href: '/storage', label: '文件存储', icon: '▣' },
    { href: '/integrations', label: '平台集成', icon: '⌘' },
    { href: '/security', label: '安全策略', icon: '⬡' },
    { href: '/health', label: '系统健康', icon: '♡' },
  ] },
]

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireRole('ADMIN')
  return (
    <div className="cdpc-admin">
      <aside className="cdpc-admin-sidebar" aria-label="管理菜单">
        <Link className="cdpc-admin-brand" href={adminUrl()}>
          <span className="cdpc-admin-brand-mark">C</span>
          <span><strong>CDPC</strong><small>CONTROL CENTER</small></span>
        </Link>
        <div className="cdpc-admin-nav">
          {sections.map((section) => (
            <section className="cdpc-admin-nav-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.items.map((item) => (
                <Link className="cdpc-admin-nav-link" href={adminUrl(item.href)} key={item.href}>
                  <span aria-hidden="true">{item.icon}</span>{item.label}
                </Link>
              ))}
            </section>
          ))}
        </div>
        <div className="cdpc-admin-sidebar-foot">
          <span className="cdpc-admin-online" />
          <span>管理员会话有效</span>
        </div>
      </aside>
      <div className="cdpc-admin-main">
        <header className="cdpc-admin-topbar">
          <div><span className="cdpc-admin-topbar-kicker">ADMINISTRATION</span><strong>管理控制台</strong></div>
          <div className="cdpc-admin-topbar-actions">
            <span className="cdpc-admin-identity">{admin.name ?? admin.email ?? '管理员'}</span>
            <Link href="/" className="cdpc-admin-back">返回站点 ↗</Link>
          </div>
        </header>
        <div className="cdpc-admin-content">{children}</div>
      </div>
    </div>
  )
}
