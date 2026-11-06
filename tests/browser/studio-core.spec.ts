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
  await expect(selected).toContainText('眼眸花披肩')
  await expect(selected).toContainText('苦力怕外套')
  await expect(selected).toContainText('眼眸花披风')

  // Unimplemented categories must be explicit empty states, never fake products.
  await page.getByRole('button', { name: '裤子', exact: true }).click()
  await expect(page.getByText('裤子素材尚未接入')).toBeVisible()

  // 3D controls are interactive and do not navigate away from the workspace.
  await page.getByRole('button', { name: 'Alex 细臂' }).click()
  await expect(page.getByRole('button', { name: 'Alex 细臂' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '行走' }).click()
  await expect(page.getByRole('button', { name: '行走' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '飞行' }).click()
  await expect(page.getByRole('button', { name: '飞行' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '自动旋转' }).click()
  await expect(page.getByRole('button', { name: '停止自动旋转' })).toBeVisible()
  await page.getByRole('button', { name: '切换为鞘翅' }).click()
  await expect(page.getByRole('button', { name: '切换为披风' })).toBeVisible()
  await page.getByRole('button', { name: '正面' }).click()
  await expect(page.getByRole('button', { name: '正面' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '背面' }).click()
  await expect(page.getByRole('button', { name: '背面' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '侧面' }).click()
  await expect(page.getByRole('button', { name: '侧面' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '重置视角' }).click()
  await expect(page.getByRole('button', { name: '正面' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Minecraft 场景背景').selectOption('forest')

  // Local outfit persistence survives a full page reload.
  await page.getByLabel('穿搭名称').fill('Studio 浏览器验收搭配')
  await page.getByRole('button', { name: '保存本地草稿' }).click()
  await expect(page.getByRole('status')).toContainText('Studio 浏览器验收搭配')
  await page.reload()
  await expect(page.locator('.dressup-selected-list')).toContainText('眼眸花披肩')
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
})
