import { expect, test } from '@playwright/test'

test('Next.js serves an installable CDPC manifest and root service worker', async ({ page, request }) => {
  await page.goto('/')
  const manifestLink = page.locator('link[rel="manifest"]')
  await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest')

  const manifestResponse = await request.get('/manifest.webmanifest')
  expect(manifestResponse.ok()).toBeTruthy()
  const manifest = await manifestResponse.json()
  expect(manifest.name).toContain('CDPC')
  expect(manifest.short_name).toBe('CDPC')
  expect(manifest.start_url).toBe('/')
  expect(manifest.scope).toBe('/')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192', src: '/pwa-192.svg' }),
    expect.objectContaining({ sizes: '512x512', src: '/pwa-512.svg' }),
    expect.objectContaining({ purpose: 'maskable', src: '/pwa-maskable.svg' }),
  ]))

  for (const iconPath of ['/pwa-192.svg', '/pwa-512.svg', '/pwa-maskable.svg']) {
    expect((await request.get(iconPath)).ok()).toBeTruthy()
  }

  const serviceWorkerResponse = await request.get('/sw.js')
  expect(serviceWorkerResponse.ok()).toBeTruthy()
  const serviceWorker = await serviceWorkerResponse.text()
  expect(serviceWorker).toContain("self.addEventListener('install'")
  expect(serviceWorker).toContain("self.addEventListener('fetch'")
  expect(serviceWorker).toContain("url.pathname.startsWith('/api/')")
  expect(serviceWorker).toContain("caches.match('/offline')")

  expect((await request.get('/offline')).ok()).toBeTruthy()
})
