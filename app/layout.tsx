import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { SiteNav } from './components/site-nav'
import './next.css'

export const metadata: Metadata = {
  title: 'CDPC｜我的世界皮肤与像素创作工坊',
  description: 'CDPC 皮肤、披肩、外套、披风与像素创作工作台。',
  applicationName: 'CDPC',
}

export const viewport: Viewport = {
  themeColor: '#101318',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body><SiteNav />{children}<footer className="cdpc-site-footer"><span>CDPC · 皮肤与像素创作工具</span><span>非官方 Minecraft 项目 · 不隶属于 Mojang 或 Microsoft</span></footer></body></html>
}
