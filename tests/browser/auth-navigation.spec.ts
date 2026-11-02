import { expect, test } from '@playwright/test'

test('main navigation exposes the core CDPC routes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'CDPC 首页' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: 'AI 创作' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '单品编辑器' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '衣服选装' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '创作者中心' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '登录' })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toContainText('CDPC')
})

test('primary creation routes render their intended mode entry points', async ({ page }) => {
  const routes = [
    { path: '/ai', heading: 'AI 生成', mode: 'ai' },
    { path: '/editor', heading: '单品编辑器', mode: 'editor' },
    { path: '/wardrobe', heading: '衣橱选装', mode: 'wardrobe' },
  ]

  for (const route of routes) {
    await page.goto(route.path)
    await expect(page.locator('[data-studio-mode]')).toHaveAttribute('data-studio-mode', route.mode)
    if (route.mode === 'ai') {
      await expect(page.getByRole('heading', { name: '设计你的角色' })).toBeVisible({ timeout: 15_000 })
    } else if (route.mode === 'wardrobe') {
      await expect(page.getByRole('tab', { name: /外套/ })).toHaveAttribute('aria-selected', 'true')
    } else {
      await expect(page.getByRole('heading', { name: '64 × 64 像素编辑器' })).toBeVisible()
      await expect(page.getByLabel('64 乘 64 像素画布')).toBeVisible()
      await page.getByRole('button', { name: '服装预览与搭配' }).click()
      await expect(page.getByText('角色预览')).toBeVisible()
    }
  }
})

test('native AI studio exposes text and image generation controls', async ({ page }) => {
  await page.goto('/ai')
  await expect(page.locator('[data-studio-mode="ai"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: '设计你的角色' })).toBeVisible()
  await expect(page.getByLabel('角色描述')).toBeVisible()
  await expect(page.getByRole('tab', { name: /文字生成/ })).toBeVisible()
  await page.getByRole('tab', { name: /参考图转换/ }).click()
  await expect(page.getByRole('button', { name: /选择 PNG \/ JPG \/ WebP/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /生成皮肤 PNG/ })).toBeVisible()
  await page.getByRole('button', { name: '返回皮肤工作台' }).click()
  await expect(page).toHaveURL(/\/workbench$/)
})

test('workbench nested routes map to their intended workflows', async ({ page }) => {
  const routes = [
    { path: '/workbench/ai', heading: 'AI 生成' },
    { path: '/workbench/edit', heading: '单品编辑器' },
    { path: '/workbench/dress', heading: '衣橱选装' },
  ]

  for (const route of routes) {
    await page.goto(route.path)
    await expect(page.locator('[data-studio-mode]')).toHaveAttribute('data-studio-mode', route.path.endsWith('/ai') ? 'ai' : route.path.endsWith('/dress') ? 'wardrobe' : 'editor')
  }
})

test('login page exposes email credentials and account registration', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '登录 / 创建账户' })).toBeVisible()
  await expect(page.getByLabel('用户名或邮箱地址')).toBeVisible()
  await expect(page.locator('#login-password')).toBeVisible()
  await expect(page.getByRole('link', { name: '创建账户', exact: true }).first()).toBeVisible()
})

test('workbench is distinct from the creator profile center', async ({ page }) => {
  await page.goto('/workbench')
  await expect(page.getByRole('heading', { name: '创作工作台' })).toBeVisible()
  const creationEntries = page.getByRole('region', { name: '创作入口' })
  await expect(creationEntries.getByRole('link', { name: '开始生成 ↗' })).toBeVisible()
  await expect(creationEntries.getByRole('link', { name: '打开编辑器 ↗' })).toBeVisible()
  await expect(creationEntries.getByRole('link', { name: '开始搭配 ↗' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '创作者中心' })).toBeVisible()
})

test('registration rejects a short password before sending a request', async ({ page }) => {
  let registerRequests = 0
  page.on('request', request => {
    if (request.url().endsWith('/api/register') && request.method() === 'POST') registerRequests += 1
  })
  await page.goto('/register')
  await page.getByLabel('邮箱地址').fill('tester@example.com')
  await page.getByLabel('设置密码').fill('short')
  await page.getByRole('button', { name: '创建账户' }).click()
  const password = page.getByLabel('设置密码')
  await expect(password).toHaveJSProperty('validity.valid', false)
  expect(registerRequests).toBe(0)
})

test('registration renders mobile layout without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: '创建你的 CDPC 账户' })).toBeVisible()
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasOverflow).toBe(false)
})

test('workbench remains usable at a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/workbench')
  await expect(page.getByRole('heading', { name: '创作工作台' })).toBeVisible()
  const entries = page.getByRole('region', { name: '创作入口' })
  await expect(entries.getByRole('link', { name: '开始生成 ↗' })).toBeVisible()
  await expect(entries.getByRole('link', { name: '打开编辑器 ↗' })).toBeVisible()
  await expect(entries.getByRole('link', { name: '开始搭配 ↗' })).toBeVisible()
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1)
})

test('account entry points to the actual personal center route', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '创作工坊' })).toHaveAttribute('href', '/workbench')
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '衣服选装' })).toHaveAttribute('href', '/wardrobe')
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: 'AI 创作' })).toHaveAttribute('href', '/ai')
})


test('legacy dress-up URL redirects to the canonical wardrobe', async ({ page }) => {
  await page.goto('/dress-up')
  await expect(page).toHaveURL(/\/wardrobe$/)
  await expect(page.locator('[data-studio-mode="wardrobe"]')).toBeVisible()
  await expect(page.getByRole('tab', { name: /披肩/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /外套/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /披风/ })).toBeVisible()
})


test('opening the pixel editor persists the current workspace handoff', async ({ page }) => {
  let savedPointer: Record<string, unknown> | null = null
  await page.route('**/api/workspace', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: {
        projectId: 'project-demo', activeTool: 'WARDROBE', activeAssetId: 'asset-demo', activeOutfitId: 'outfit-demo',
      } }) })
      return
    }
    if (route.request().method() === 'PUT') {
      savedPointer = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: savedPointer }) })
      return
    }
    await route.continue()
  })

  await page.goto('/editor')
  await expect(page.locator('[data-studio-mode="editor"]')).toBeVisible()
  await expect.poll(() => savedPointer).toEqual({
    projectId: 'project-demo',
    activeTool: 'PIXEL_EDITOR',
    activeAssetId: 'asset-demo',
    activeOutfitId: 'outfit-demo',
  })
})


test('pixel canvas supports drawing, layers, undo and redo', async ({ page }) => {
  await page.route('**/api/workspace', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: {
        projectId: null, activeTool: 'WARDROBE', activeAssetId: null, activeOutfitId: null,
      } }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: {} }) })
  })
  await page.goto('/editor')
  await expect(page.getByRole('heading', { name: '64 × 64 像素编辑器' })).toBeVisible()
  const canvas = page.getByLabel('64 乘 64 像素画布')
  await expect(canvas).toHaveAttribute('width', '64')
  await expect(canvas).toHaveAttribute('height', '64')
  await page.getByLabel('画笔颜色').fill('#ff0000')
  await canvas.click({ position: { x: 4, y: 4 } })
  await expect.poll(() => canvas.evaluate(element => {
    const pixel = (element as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 1, 1).data
    return Array.from(pixel)
  })).toEqual([255, 0, 0, 255])
  await page.getByRole('button', { name: '撤销' }).click()
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 1, 1).data[3])).toBe(0)
  await page.getByRole('button', { name: '重做' }).click()
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 1, 1).data[0])).toBe(255)
  await page.getByRole('button', { name: /新建/ }).click()
  await expect(page.getByRole('button', { name: '图层 2', exact: true })).toBeVisible()
})
