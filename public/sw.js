/* CDPC Next.js service worker. Never cache authenticated pages or API responses. */
const CACHE_PREFIX = 'cdpc-next-pwa-'
const CACHE_VERSION = 'v1'
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION
const PRECACHE_URLS = ['/offline', '/cdpc-icon.svg', '/pwa-192.svg', '/pwa-512.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never cache account, admin, auth, upload, or API traffic.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/account') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/register') ||
    url.pathname.startsWith('/auth/')
  ) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedOfflinePage = await caches.match('/offline')
        return cachedOfflinePage || new Response(
          '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CDPC 离线</title><body><h1>当前处于离线状态</h1><p>网络恢复后请重新加载 CDPC。</p></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
        )
      }),
    )
    return
  }

  const isNextStatic = url.pathname.startsWith('/_next/static/')
  const isPublicAsset = ['style', 'script', 'image', 'font'].includes(request.destination)
  if (!isNextStatic && !isPublicAsset) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request)

    // Next build assets are content-hashed and safe to cache first.
    if (isNextStatic && cached) return cached

    try {
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone())
      }
      return response
    } catch {
      if (cached) return cached
      throw new Error('CDPC asset unavailable offline')
    }
  })())
})
