import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('canonical Studio supports live outfit selection, controls, local restore and vanilla PNG export', async ({ page }) => {
  const pngDataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')!
    context.fillStyle = '#345678'
    context.fillRect(0, 0, 64, 64)
    return canvas.toDataURL('image/png')
  })
  const pngBytes = Buffer.from(pngDataUrl.split(',')[1], 'base64')
  const png128DataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')!
    context.fillStyle = '#789abc'
    context.fillRect(0, 0, 128, 128)
    return canvas.toDataURL('image/png')
  })
  const png128Bytes = Buffer.from(png128DataUrl.split(',')[1], 'base64')
  const capeDataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 32
    const context = canvas.getContext('2d')!
    context.fillStyle = '#abcdef'
    context.fillRect(0, 0, 64, 32)
    return canvas.toDataURL('image/png')
  })
  const capeBytes = Buffer.from(capeDataUrl.split(',')[1], 'base64')

  await page.route('https://raw.githubusercontent.com/**', route => {
    const pathname = new URL(route.request().url()).pathname
    const body = /\/cape_[^/]+\.png$/.test(pathname)
      ? capeBytes
      : /_(?:default|slim)_128\.png$/.test(pathname)
        ? png128Bytes
        : pngBytes
    return route.fulfill({
      status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body,
    })
  })
  await page.route('https://www.minecraft.net/**', route => route.fulfill({
    status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: pngBytes,
  }))
  await page.route('**/api/outfits**', route => route.fulfill({
    status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Authentication required' }),
  }))
  await page.route('**/api/assets**', route => route.fulfill({
    status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Authentication required' }),
  }))
  await page.route('**/api/workspace', route => route.fulfill({
    status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Authentication required' }),
  }))

  await page.goto('/studio')
  await expect(page.getByRole('heading', { name: '角色穿搭' })).toBeVisible()
  await expect(page.getByRole('region', { name: '服装素材' })).toBeVisible()
  await expect(page.locator('.dressup-real-preview canvas')).toBeVisible({ timeout: 15_000 })

  // Three separate garment types must remain independently selectable.
  await page.getByRole('button', { name: '披肩', exact: true }).click()
  const shawlCard = page.locator('.dressup-item').filter({ hasText: '眼眸花披肩' })
  await shawlCard.scrollIntoViewIfNeeded()
  await shawlCard.click()
  await page.getByRole('button', { name: '收藏 眼眸花披肩' }).click()
  await expect(page.getByRole('button', { name: '取消收藏 眼眸花披肩' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /只看收藏/ }).click()
  await expect(page.locator('.dressup-item').filter({ hasText: '眼眸花披肩' })).toBeVisible()
  await expect(page.getByRole('button', { name: /苦力怕外套/ })).toHaveCount(0)
  await page.getByRole('button', { name: '显示全部素材' }).click()
  const selected = page.locator('.dressup-selected-list')
  // Catalog selection must immediately show an isolated 3D asset preview and
  // update the character try-on; no second action in the outfit list is needed.
  const assetPreview = page.getByRole('region', { name: '单件素材独立渲染预览' })
  await expect(assetPreview).toBeVisible()
  await expect(page.locator('.dressup-single-item-preview canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('region', { name: '服装素材' }).locator('.dressup-single-item-card')).toContainText('眼眸花披肩')
  await expect(selected).toContainText('眼眸花披肩')
  await page.getByRole('button', { name: '关闭' }).click()

  // The outfit-list shortcut remains available as a secondary way to reopen it.
  await page.locator('.dressup-selected-row').filter({ hasText: '眼眸花披肩' }).getByRole('button', { name: '独立预览' }).click()
  await expect(assetPreview).toBeVisible()
  await expect(page.locator('.dressup-single-item-preview canvas')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '关闭' }).click()

  await page.getByRole('button', { name: '外套', exact: true }).click()
  await page.locator('.dressup-item').filter({ hasText: '苦力怕外套' }).click()
  await page.getByRole('button', { name: '披风', exact: true }).click()
  await page.locator('.dressup-item').filter({ hasText: '眼眸花披风' }).click()
  await expect(selected).not.toContainText('眼眸花披肩')
  await expect(selected).toContainText('苦力怕外套')
  await expect(selected).toContainText('眼眸花披风')
  await page.getByRole('button', { name: '外套', exact: true }).click()
  await page.getByRole('button', { name: '脱下当前分类' }).click()
  await expect(selected).not.toContainText('苦力怕外套')
  await page.locator('.dressup-item').filter({ hasText: '苦力怕外套' }).click()
  await expect(selected).toContainText('苦力怕外套')

  // Unimplemented categories must be explicit empty states, never fake products.
  await page.getByRole('button', { name: '裤子', exact: true }).click()
  await expect(page.getByText('裤子素材尚未接入')).toBeVisible()

  // 3D controls are interactive and do not navigate away from the workspace.
  await page.getByRole('button', { name: 'Alex 细臂' }).click()
  await expect(page.getByRole('button', { name: 'Alex 细臂' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('切换角色动作').selectOption('walk')
  await expect(page.getByLabel('切换角色动作')).toHaveValue('walk')
  await page.getByLabel('切换角色动作').selectOption('fly')
  await expect(page.getByLabel('切换角色动作')).toHaveValue('fly')
  for (const pose of ['run', 'crouch', 'hit', 'swim']) {
    await page.getByLabel('切换角色动作').selectOption(pose)
    await expect(page.getByLabel('切换角色动作')).toHaveValue(pose)
  }
  // Repeating the action switch must not leave a stale pose animation attached.
  await page.getByRole('button', { name: '自动旋转' }).click()
  await expect(page.getByRole('button', { name: '停止旋转' })).toBeVisible()
  await page.getByRole('button', { name: '显示鞘翅' }).click()
  await expect(page.getByRole('button', { name: '显示披风' })).toBeVisible()
  await page.getByLabel('切换角色视角').selectOption('back')
  await expect(page.getByLabel('切换角色视角')).toHaveValue('back')
  await page.getByLabel('切换角色视角').selectOption('side')
  await expect(page.getByLabel('切换角色视角')).toHaveValue('side')
  await page.getByRole('button', { name: '重置视角' }).click()
  await expect(page.getByLabel('切换角色视角')).toHaveValue('front')
  await page.getByLabel('Minecraft 场景背景').selectOption('forest')

  // Local outfit persistence survives a full page reload.
  await page.getByLabel('穿搭名称').fill('Studio 浏览器验收搭配')
  await page.getByRole('button', { name: '保存本地草稿' }).click()
  await expect(page.getByRole('status')).toContainText('Studio 浏览器验收搭配')
  const outfitSelect = page.locator('#dressup-saved-outfit')
  await expect(outfitSelect.locator('option')).toHaveCount(2)
  await page.getByLabel('穿搭名称').fill('Studio 浏览器验收搭配（已重命名）')
  await page.getByRole('button', { name: '保存本地草稿' }).click()
  await expect(outfitSelect.locator('option')).toHaveCount(2)
  await page.getByRole('button', { name: '随机搭配' }).click()
  await page.getByLabel('穿搭名称').fill('第二套浏览器验收搭配')
  await page.getByRole('button', { name: '保存本地草稿' }).click()
  await expect(outfitSelect.locator('option')).toHaveCount(3)
  await outfitSelect.selectOption({ label: 'Studio 浏览器验收搭配（已重命名）' })
  await page.getByRole('button', { name: '载入选择' }).click()
  await expect(page.getByLabel('穿搭名称')).toHaveValue('Studio 浏览器验收搭配（已重命名）')
  const backupDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出穿搭备份 JSON' }).click()
  const backupDownload = await backupDownloadPromise
  const backupPath = await backupDownload.path()
  const backupText = await readFile(backupPath!, 'utf8')
  const backupJson = JSON.parse(backupText)
  expect(backupJson.format).toBe('cdpc-outfit')
  expect(backupJson.version).toBe(1)
  expect(backupJson.outfit.name).toBe('Studio 浏览器验收搭配（已重命名）')
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: 'studio-backup.json', mimeType: 'application/json', buffer: Buffer.from(backupText) })
  await expect(page.getByRole('status')).toContainText('已导入“Studio 浏览器验收搭配（已重命名）”')
  await expect(outfitSelect.locator('option')).toHaveCount(4)
  await page.reload()
  await expect(page.locator('.dressup-selected-list')).not.toContainText('眼眸花披肩')
  await expect(page.locator('.dressup-selected-list')).toContainText('苦力怕外套')
  await expect(page.locator('.dressup-selected-list')).toContainText('眼眸花披风')
  await expect(page.getByLabel('穿搭名称')).toHaveValue('Studio 浏览器验收搭配')
  await expect(page.getByLabel('Minecraft 场景背景')).toHaveValue('forest')

  // The standard skin download is a 64x64 PNG; cape remains a separate equipment item.
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出皮肤 PNG' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('cdpc-skin-64x64.png')
  const path = await download.path()
  expect(path).toBeTruthy()
  const bytes = await readFile(path!)
  expect(bytes.subarray(1, 4).toString()).toBe('PNG')
  expect(bytes.readUInt32BE(16)).toBe(64)
  expect(bytes.readUInt32BE(20)).toBe(64)
  await expect(page.getByRole('status')).toContainText('披风是独立背部装备')

  // 128×128 skins are imported and exported without downscaling.
  // Keep this resolution-specific overlay check isolated from cape loading:
  // capes use a separate 64×32 back-equipment texture contract.
  await page.locator('.dressup-selected-row').filter({ hasText: '眼眸花披风' }).getByRole('button', { name: '移除' }).click()
  const skin128DataUrl = png128DataUrl
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'browser-128-skin.png',
    mimeType: 'image/png',
    buffer: Buffer.from(skin128DataUrl.split(',')[1], 'base64'),
  })
  await expect(page.getByText('当前皮肤：browser-128-skin.png')).toBeVisible()
  // The import handler must publish a busy state before the filename updates;
  // wait for the new 3D preview to finish, not merely for a transient enabled frame.
  const previewStatus128 = page.locator('.dressup-preview .dressup-status')
  await expect(previewStatus128).toHaveText('预览已更新', { timeout: 15_000 })
  const exportButton128 = page.getByRole('button', { name: '导出皮肤 PNG' })
  await expect(exportButton128).toBeEnabled({ timeout: 15_000 })
  const download128Promise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出皮肤 PNG' }).click()
  const download128 = await download128Promise
  expect(download128.suggestedFilename()).toBe('cdpc-skin-128x128.png')
  const path128 = await download128.path()
  const bytes128 = await readFile(path128!)
  expect(bytes128.readUInt32BE(16)).toBe(128)
  expect(bytes128.readUInt32BE(20)).toBe(128)

  // A 128px base skin must select and render the matching native-resolution garment atlas.
  await page.getByRole('button', { name: '披肩', exact: true }).click()
  await page.locator('.dressup-item').filter({ hasText: '眼眸花披肩' }).click()
  await page.locator('.dressup-selected-row').filter({ hasText: '眼眸花披肩' }).getByRole('button', { name: '独立预览' }).click()
  await expect(page.locator('.dressup-single-item-preview canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('region', { name: '单件素材独立渲染预览' })).not.toContainText('单件预览失败')
  await page.getByRole('button', { name: '关闭' }).click()
  // Repeat against the classic Steve model to cover both 128px atlas variants.
  await page.getByRole('button', { name: 'Steve 粗臂' }).click()
  await page.locator('.dressup-selected-row').filter({ hasText: '眼眸花披肩' }).getByRole('button', { name: '独立预览' }).click()
  await expect(page.locator('.dressup-single-item-preview canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('region', { name: '单件素材独立渲染预览' })).not.toContainText('单件预览失败')
  await page.getByRole('button', { name: '关闭' }).click()

  await page.getByText('更多操作与备份').click()
  await page.getByRole('button', { name: '恢复默认角色' }).click()
  await expect(page.locator('.dressup-selected-list')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Steve 粗臂' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('切换角色视角')).toHaveValue('front')
})

test('Studio exports only owner-authorized capes as standalone PNG files', async ({ page }) => {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 32
    const context = canvas.getContext('2d')!
    context.fillStyle = '#345678'
    context.fillRect(0, 0, 64, 32)
    return canvas.toDataURL('image/png')
  })
  const bytes = Buffer.from(png.split(',')[1], 'base64')
  const assets = [
    {
      id: 'official-cape', name: '官方样例披风', category: 'CAPE', fileUrl: '/api/assets/official-cape/file',
      attribution: '官方素材', provenance: 'OFFICIAL', downloadPolicy: 'DENY', canDownload: false,
      visibility: 'PUBLIC',
    },
    {
      id: 'owner-cape', name: '我的原创披风', category: 'CAPE', fileUrl: '/api/assets/owner-cape/file',
      attribution: '创作者本人', provenance: 'USER_CREATED', downloadPolicy: 'OWNER_ONLY', canDownload: true,
      visibility: 'PRIVATE',
    },
  ]
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({
    status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: bytes,
  }))
  await page.route('https://www.minecraft.net/**', route => route.fulfill({
    status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: bytes,
  }))
  await page.route('**/api/assets**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/file')) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: bytes })
      return
    }
    if (url.pathname.endsWith('/download')) {
      await route.fulfill({ status: 200, contentType: 'image/png', headers: { 'Content-Disposition': 'attachment; filename="owner-cape.png"' }, body: bytes })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: assets, nextCursor: null }) })
  })
  await page.route('**/api/outfits**', route => route.fulfill({
    status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Authentication required' }),
  }))
  await page.route('**/api/workspace', route => route.fulfill({
    status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Authentication required' }),
  }))
  await page.goto('/studio')
  await expect(page.getByRole('heading', { name: '角色穿搭' })).toBeVisible()
  await page.getByRole('button', { name: '披风', exact: true }).click()
  await page.locator('.dressup-item').filter({ hasText: '官方样例披风' }).click()
  await expect(page.locator('.dressup-selected-row')).toContainText('官方样例披风')
  await expect(page.getByRole('button', { name: '导出披风 PNG' })).toHaveCount(0)
  await page.locator('.dressup-selected-row').getByRole('button', { name: '移除' }).click()
  await page.locator('.dressup-item').filter({ hasText: '我的原创披风' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出披风 PNG' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('我的-原创-披风.png')
})

