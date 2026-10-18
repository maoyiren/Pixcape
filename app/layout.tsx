import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { SiteNav } from './components/site-nav'
import './next.css'

export const metadata: Metadata = {
  title: 'Pixcape｜我的世界皮肤工坊',
  description: 'Pixcape 皮肤、披肩、外套与披风创作工作台。',
  applicationName: 'Pixcape',
}

export const viewport: Viewport = {
  themeColor: '#3f762e',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body><SiteNav />{children}<footer className="cdpc-site-footer"><span>CDPC · 皮肤与像素创作工具</span><span>非官方 Minecraft 项目 · 不隶属于 Mojang 或 Microsoft</span></footer></body></html>
}
