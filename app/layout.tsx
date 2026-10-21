import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
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
  themeColor: '#171d17',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body><SiteNav />{children}<footer className="cdpc-site-footer"><span>CDPC · 像素角色创作工具</span><span>本项目独立运营，不隶属于 Mojang 或 Microsoft，也非 Minecraft 官方产品。</span></footer></body></html>
}
