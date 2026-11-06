import { expect, test } from '@playwright/test'

test('workbench remains a creation hub with canonical destinations', async ({ page }) => {
  await page.goto('/workbench')
  await expect(page.getByRole('heading', { name: '创作工作台' })).toBeVisible()
  await expect(page.locator('a[href="/ai"]')).toBeVisible()
  await expect(page.locator('a[href="/editor"]')).toBeVisible()
  await expect(page.locator('a[href="/studio"]')).toBeVisible()
})

const redirects = [
  ['/workbench/ai?prompt=hello&project=p1', /\/ai\?prompt=hello&project=p1$/],
  ['/workbench/edit?project=p2', /\/editor\?project=p2$/],
  ['/workbench/dress?project=p3', /\/studio\?project=p3$/],
  ['/dress-up?project=p4', /\/studio\?project=p4$/],
  ['/bench?project=p5', /\/editor\?project=p5$/],
] as const

for (const [source, destination] of redirects) {
  test(`legacy route ${source} redirects and preserves query parameters`, async ({ page }) => {
    await page.goto(source)
    await expect(page).toHaveURL(destination)
  })
}
