import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'CDPC｜像素角色创作平台',
    short_name: 'CDPC',
    description: '编辑 Minecraft 皮肤，搭配披肩、外套与披风，预览并保存你的像素角色。',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#111827',
    theme_color: '#171D2A',
    lang: 'zh-CN',
    categories: ['games', 'design', 'utilities'],
    icons: [
      { src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  }
}
