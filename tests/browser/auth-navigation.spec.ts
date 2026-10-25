import { expect, test } from '@playwright/test'

test('main navigation exposes the core CDPC routes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'CDPC 首页' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: 'AI 生成' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '单品编辑器' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '衣橱选装' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '创作者中心' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '登录' })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toContainText('CDPC')
})


test('primary creation routes render their intended mode entry points', async ({ page }) => {
  const routes = [
    { path: '/ai', heading: 'AI 生成' },
    { path: '/editor', heading: '单品编辑器' },
    { path: '/wardrobe', heading: '衣橱选装' },
  ]

  for (const route of routes) {
    await page.goto(route.path)
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible()
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
  await expect(page.getByRole('link', { name: 'AI 生成' })).toBeVisible()
  await expect(page.getByRole('link', { name: '编辑器' })).toBeVisible()
  await expect(page.getByRole('link', { name: '衣服选装' })).toBeVisible()
  await expect(page.getByRole('link', { name: '创作者中心' })).toBeVisible()
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

test('Vite skin editor app starts and renders its interactive surface', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await expect(page.locator('#root')).toBeVisible()
  await expect(page.getByText('Minecraft 皮肤与服装工作台')).toBeVisible()
  await expect(page.getByText('角色预览')).toBeVisible()
  await expect(page.getByRole('tab', { name: /披肩/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /外套/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /披风/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '发送到 Blockbench 编辑' })).toBeVisible()
})
