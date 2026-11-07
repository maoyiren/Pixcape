import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function makePng(page: import('@playwright/test').Page, size = 64) {
  const dataUrl = await page.evaluate((dimension) => {
    const canvas = document.createElement('canvas')
    canvas.width = dimension
    canvas.height = dimension
    const context = canvas.getContext('2d')!
    context.fillStyle = '#345678'
    context.fillRect(0, 0, dimension, dimension)
    return canvas.toDataURL('image/png')
  }, size)
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

test('wardrobe uploads a private PNG and downloads the stored asset', async ({ page }) => {
  const png = await makePng(page)
  let uploaded = false
  const asset = {
    id: 'browser-asset-1',
    ownerId: 'browser-user',
    kind: 'IMAGE',
    category: 'COAT',
    mimeType: 'image/png',
    byteSize: png.length,
    width: 64,
    height: 64,
    source: 'UPLOAD',
    visibility: 'PRIVATE',
    attribution: '浏览器上传外套',
    createdAt: '2026-11-07T00:00:00.000Z',
    isFavorite: false,
    fileUrl: '/api/assets/browser-asset-1/file',
  }

  await page.route('**/api/assets*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/file')) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: png })
      return
    }
    if (request.method() === 'POST') {
      uploaded = true
      expect(request.postData() || '').toContain('COAT')
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ item: asset }) })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: uploaded ? [asset] : [], nextCursor: null }),
    })
  })
  await page.route('**/api/outfits', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }),
  }))

  await page.goto('/wardrobe')
  await expect(page.getByRole('heading', { name: '我的衣橱' })).toBeVisible()
  await page.getByLabel('上传素材类型').selectOption('COAT')
  await page.getByRole('button', { name: '＋ 上传素材' }).click()
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'browser-coat.png', mimeType: 'image/png', buffer: png,
  })
  await expect(page.getByText('浏览器上传外套')).toBeVisible()
  expect(uploaded).toBe(true)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载 PNG' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('cdpc-coat-browser-asset-1.png')
  const downloadedPath = await download.path()
  expect(downloadedPath).toBeTruthy()
  const downloaded = await readFile(downloadedPath!)
  expect(downloaded.subarray(1, 4).toString()).toBe('PNG')
  expect(downloaded.readUInt32BE(16)).toBe(64)
  expect(downloaded.readUInt32BE(20)).toBe(64)
})

test('Studio restores a cloud outfit from server state with an empty local device cache', async ({ page }) => {
  const png = await makePng(page)
  const assets = [
    {
      id: 'cloud-skin-1', ownerId: 'browser-user', kind: 'IMAGE', category: 'SKIN',
      mimeType: 'image/png', byteSize: png.length, width: 64, height: 64,
      source: 'UPLOAD', visibility: 'PRIVATE', attribution: '跨设备皮肤',
      createdAt: '2026-11-07T00:00:00.000Z', isFavorite: false,
      fileUrl: '/api/assets/cloud-skin-1/file',
    },
    {
      id: 'cloud-coat-1', ownerId: 'browser-user', kind: 'IMAGE', category: 'COAT',
      mimeType: 'image/png', byteSize: png.length, width: 64, height: 64,
      source: 'UPLOAD', visibility: 'PRIVATE', attribution: '跨设备外套',
      createdAt: '2026-11-07T00:00:00.000Z', isFavorite: false,
      fileUrl: '/api/assets/cloud-coat-1/file',
    },
  ]
  const outfit = {
    id: 'cloud-outfit-1',
    ownerId: 'browser-user',
    name: '跨设备云端搭配',
    skinAssetId: 'cloud-skin-1',
    skinModel: 'SLIM',
    background: '#182437',
    pose: 'walk',
    updatedAt: '2026-11-07T00:00:00.000Z',
    items: [{ assetId: 'cloud-coat-1', category: 'COAT', sortOrder: 0, equipped: true }],
  }

  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({
    status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: png,
  }))
  await page.route('https://www.minecraft.net/**', route => route.fulfill({
    status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: png,
  }))
  await page.route('**/api/outfits', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [outfit] }),
  }))
  await page.route('**/api/assets*', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/file')) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: png })
      return
    }
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ items: assets, nextCursor: null }),
    })
  })
  await page.route('**/api/workspace', async route => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ item: {
          projectId: null, activeTool: 'WARDROBE', activeAssetId: 'cloud-skin-1',
          activeOutfitId: 'cloud-outfit-1',
        } }),
      })
      return
    }
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ item: {
        projectId: null, activeTool: 'WARDROBE', activeAssetId: 'cloud-skin-1',
        activeOutfitId: 'cloud-outfit-1',
      } }),
    })
  })

  await page.addInitScript(() => localStorage.clear())
  await page.goto('/studio')
  await expect(page.getByRole('heading', { name: '角色穿搭' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('已从衣橱恢复云端穿搭“跨设备云端搭配”', { timeout: 15_000 })
  await expect(page.locator('.dressup-selected-list')).toContainText('跨设备外套')
  await expect(page.getByLabel('穿搭名称')).toHaveValue('跨设备云端搭配')
  await expect(page.getByLabel('切换角色动作')).toHaveValue('walk')
  await expect(page.getByRole('button', { name: 'Alex 细臂' })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => localStorage.getItem('cdpc:dress-up:outfits-v1'))).toBeNull()
})
