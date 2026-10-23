import { expect, test } from '@playwright/test'

test('main navigation exposes the core CDPC routes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'CDPC 首页' })).toBeVisible()
  await expect(page.getByRole('link', { name: '编辑器' })).toBeVisible()
  await expect(page.getByRole('link', { name: '创作者中心' })).toBeVisible()
  await expect(page.getByRole('link', { name: '登录' })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toContainText('CDPC')
})

test('login page exposes email credentials and account registration', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '登录 CDPC' })).toBeVisible()
  await expect(page.getByLabel('邮箱账号')).toBeVisible()
  await expect(page.getByLabel('密码', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '没有账户？立即注册' })).toBeVisible()
})

test('registration validates invalid email and short password before sending a request', async ({ page }) => {
  let registerRequests = 0
  page.on('request', request => {
    if (request.url().endsWith('/api/register') && request.method() === 'POST') registerRequests += 1
  })
  await page.goto('/register')
  await page.getByLabel('邮箱地址').fill('not-an-email')
  await page.getByLabel('设置密码').fill('short')
  await page.getByRole('button', { name: '创建账户' }).click()
  await expect(page.getByText('请输入有效的邮箱地址')).toBeVisible()
  await expect(page.getByText('密码至少需要 10 位字符')).toBeVisible()
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
  await expect(page.locator('#root')).not.toBeEmpty()
})
