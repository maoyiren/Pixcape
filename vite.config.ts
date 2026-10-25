import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  server: { proxy: { '/api/ai': { target: 'http://127.0.0.1:8787', changeOrigin: true } } },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pixcape-icon.svg', 'pixcape-og.svg'],
      manifest: {
        id: base,
        name: 'Pixcape 我的世界皮肤工坊',
        short_name: 'Pixcape',
        description: 'Minecraft 风格皮肤、披肩、外套与披风预制编辑工坊。',
        lang: 'zh-CN',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#18230f',
        theme_color: '#3f762e',
        icons: [
          { src: `${base}pixcape-icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/blockbench(?:\/|$)/, /^\/api(?:\/|$)/],
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        // Blockbench is a separately loaded editor; its 9 MB bundle must not be precached.
        globIgnores: ['blockbench/**'],
      },
    }),
  ],
})
