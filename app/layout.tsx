import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { SiteNav } from './components/site-nav'
import './next.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://cdpc.cc'),
  title: {
    default: 'CDPC｜像素角色创作平台',
    template: '%s｜CDPC',
  },
  description: '编辑 Minecraft 皮肤，搭配披肩、披风与服饰配件；预览角色效果，开启你的像素创作。',
  applicationName: 'CDPC',
  openGraph: {
    type: 'website',
    url: 'https://cdpc.cc',
    siteName: 'CDPC',
    title: 'CDPC｜像素角色创作平台',
    description: '从皮肤到配件，搭配、预览并继续创作。',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CDPC｜像素角色创作平台',
    description: '从皮肤到配件，搭配、预览并继续创作。',
  },
}

export const viewport: Viewport = {
  themeColor: '#171D2A',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteNav />
        {children}
        <footer className="cdpc-site-footer">
          <div className="cdpc-footer-inner">
            <div className="cdpc-footer-brand">
              <span className="site-brand-mark" aria-hidden="true">▦</span>
              <span><strong>cdpc</strong><small>像素角色创作工具</small></span>
            </div>
            <nav className="cdpc-footer-links" aria-label="页脚导航">
              <Link href="/dress-up">衣服选装</Link>
              <Link href="/studio">创作工坊</Link>
              <Link href="/creator">创作者中心</Link>
              <Link href="/account">我的账户</Link>
              <Link href="/login">登录 / 注册</Link>
            </nav>
            <p>CDPC 为独立社区工具项目，不隶属于 Mojang Studios 或 Microsoft，也非 Minecraft 官方产品。</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
