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

  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({
    status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: pngBytes,
  }))
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
  await page.getByRole('button', { name: /眼眸花披肩/ }).click()
  await page.getByRole('button', { name: '外套', exact: true }).click()
  await page.getByRole('button', { name: /苦力怕外套/ }).click()
  await page.getByRole('button', { name: '披风', exact: true }).click()
  await page.getByRole('button', { name: /眼眸花披风/ }).click()
  const selected = page.locator('.dressup-selected-list')
  await expect(selected).not.toContainText('眼眸花披肩')
  await expect(selected).toContainText('苦力怕外套')
  await expect(selected).toContainText('眼眸花披风')
  await page.getByRole('button', { name: '独立预览' }).first().click()
  await expect(page.getByRole('region', { name: '单件素材独立渲染预览' })).toBeVisible()
  await expect(page.locator('.dressup-single-item-preview canvas')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '关闭' }).click()
  await page.getByRole('button', { name: '外套', exact: true }).click()
  await page.getByRole('button', { name: '脱下当前分类' }).click()
  await expect(selected).not.toContainText('苦力怕外套')
  await page.getByRole('button', { name: /苦力怕外套/ }).click()
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
  const skin128DataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')!
    context.fillStyle = '#789abc'
    context.fillRect(0, 0, 128, 128)
    return canvas.toDataURL('image/png')
  })
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'browser-128-skin.png',
    mimeType: 'image/png',
    buffer: Buffer.from(skin128DataUrl.split(',')[1], 'base64'),
  })
  await expect(page.getByText('当前皮肤：browser-128-skin.png')).toBeVisible()
  const download128Promise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出皮肤 PNG' }).click()
  const download128 = await download128Promise
  expect(download128.suggestedFilename()).toBe('cdpc-skin-128x128.png')
  const path128 = await download128.path()
  const bytes128 = await readFile(path128!)
  expect(bytes128.readUInt32BE(16)).toBe(128)
  expect(bytes128.readUInt32BE(20)).toBe(128)

  await page.getByText('更多操作与备份').click()
  await page.getByRole('button', { name: '恢复默认角色' }).click()
  await expect(page.locator('.dressup-selected-list')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Steve 粗臂' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('切换角色视角')).toHaveValue('front')
})
