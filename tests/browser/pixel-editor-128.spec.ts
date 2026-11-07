import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('128×128 editor import, undo/redo, cloud restore, wardrobe save and PNG export', async ({ page }) => {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')!
    context.fillStyle = '#345678'
    context.fillRect(0, 0, 128, 128)
    return canvas.toDataURL('image/png')
  })
  const png = Buffer.from(dataUrl.split(',')[1], 'base64')
  let cloudDocument: any = null
  let cloudSummary: any = null
  let wardrobeUpload = false

  await page.route('**/api/editor-documents*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/editor-documents' && request.method() === 'POST') {
      const body = request.postDataJSON()
      cloudDocument = body.document
      cloudSummary = {
        id: 'cloud-doc-128',
        name: body.name,
        revision: 1,
        createdAt: '2026-11-07T00:00:00.000Z',
        updatedAt: '2026-11-07T00:00:00.000Z',
      }
      expect(cloudDocument.width).toBe(128)
      expect(cloudDocument.height).toBe(128)
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ item: cloudSummary }) })
      return
    }
    if (url.pathname === '/api/editor-documents' && request.method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ items: cloudSummary ? [cloudSummary] : [] }),
      })
      return
    }
    if (url.pathname === '/api/editor-documents/cloud-doc-128' && request.method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ item: { ...cloudSummary, document: cloudDocument } }),
      })
      return
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) })
  })

  await page.route('**/api/assets*', async route => {
    if (route.request().method() === 'POST') {
      wardrobeUpload = true
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ item: {
          id: 'skin-128',
          ownerId: 'browser-user',
          kind: 'IMAGE',
          category: 'SKIN',
          mimeType: 'image/png',
          byteSize: png.length,
          width: 128,
          height: 128,
          source: 'UPLOAD',
          visibility: 'PRIVATE',
          attribution: 'CDPC Pixel Editor',
          createdAt: '2026-11-07T00:00:00.000Z',
          isFavorite: false,
          fileUrl: '/api/assets/skin-128/file',
        } }),
      })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], nextCursor: null }) })
  })
  await page.route('**/api/workspace', async route => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ item: {
          projectId: null, activeTool: 'PIXEL_EDITOR', activeAssetId: 'skin-128', activeOutfitId: null,
        } }),
      })
      return
    }
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ item: {
        projectId: null, activeTool: 'PIXEL_EDITOR', activeAssetId: null, activeOutfitId: null,
      } }),
    })
  })

  await page.goto('/editor')
  await expect(page.getByRole('heading', { name: '64 × 64 像素编辑器' })).toBeVisible()
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'browser-128-editor.png', mimeType: 'image/png', buffer: png,
  })
  await expect(page.getByRole('heading', { name: '128 × 128 像素编辑器' })).toBeVisible()

  // Import itself is a reversible document operation, including a size change.
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByRole('heading', { name: '64 × 64 像素编辑器' })).toBeVisible()
  await page.getByRole('button', { name: '重做' }).click()
  await expect(page.getByRole('heading', { name: '128 × 128 像素编辑器' })).toBeVisible()

  // Exercise a real 128px document edit without relying on a large WebGL-adjacent
  // canvas hit target in headless Chromium; pixel pointer painting is covered by
  // the dedicated editor interaction test.
  await page.getByRole('button', { name: /新建/ }).click()
  await expect(page.getByRole('button', { name: '图层 2', exact: true })).toBeVisible()
  await page.getByLabel('云端文档名称').fill('128 像素跨设备作品')
  await page.getByRole('button', { name: '保存云端' }).click()
  await expect(page.locator('.cdpc-pixel-stage small')).toContainText('云端文档已保存，可在其他设备登录后打开')
  expect(cloudDocument.width).toBe(128)
  expect(cloudDocument.layers).toHaveLength(2)
  expect(cloudDocument.layers[0].pixels).toHaveLength(128 * 128)
  expect(cloudDocument.layers[1].pixels).toHaveLength(128 * 128)

  // Remove the local draft to prove that the next open comes from cloud data.
  await page.evaluate(() => localStorage.removeItem('cdpc-pixel-editor-v1'))
  await page.reload()
  await expect(page.getByRole('heading', { name: '64 × 64 像素编辑器' })).toBeVisible()
  await expect(page.locator('select[aria-label="选择云端文档"] option[value="cloud-doc-128"]')).toHaveCount(1)
  await page.getByLabel('选择云端文档').selectOption('cloud-doc-128')
  await page.getByRole('button', { name: '打开云端' }).click()
  await expect(page.getByRole('heading', { name: '128 × 128 像素编辑器' })).toBeVisible()
  await expect(page.locator('.cdpc-pixel-stage small')).toContainText('已从云端恢复编辑文档')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 PNG' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('cdpc-pixel-skin-128x128.png')
  const downloadPath = await download.path()
  const downloaded = await readFile(downloadPath!)
  expect(downloaded.subarray(1, 4).toString()).toBe('PNG')
  expect(downloaded.readUInt32BE(16)).toBe(128)
  expect(downloaded.readUInt32BE(20)).toBe(128)

  await page.getByRole('button', { name: '保存到衣橱' }).click()
  await expect(page.locator('.cdpc-pixel-stage small')).toContainText('皮肤已保存到衣橱，并已同步为当前工作区素材')
  expect(wardrobeUpload).toBe(true)
})
