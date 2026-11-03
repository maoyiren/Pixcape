import { expect, test } from '@playwright/test'

test('main navigation exposes the core CDPC routes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'CDPC 首页' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: 'AI 创作' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '单品编辑器' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '衣橱' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '3D 换装' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '创作者中心' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '登录' })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toContainText('CDPC')
})

test('primary creation routes render their intended mode entry points', async ({ page }) => {
  const routes = [
    { path: '/ai', heading: 'AI 生成', mode: 'ai' },
    { path: '/editor', heading: '单品编辑器', mode: 'editor' },
    { path: '/wardrobe', heading: '我的衣橱', mode: 'wardrobe' },
    { path: '/dress-up', heading: '衣服选装', mode: 'dress-up' },
  ]

  for (const route of routes) {
    await page.goto(route.path)
    await expect(page.locator('[data-studio-mode]')).toHaveAttribute('data-studio-mode', route.mode)
    if (route.mode === 'ai') {
      await expect(page.getByRole('heading', { name: '设计你的角色' })).toBeVisible({ timeout: 15_000 })
    } else if (route.mode === 'wardrobe') {
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()
      await expect(page.getByRole('button', { name: /全部素材/ })).toBeVisible()
    } else if (route.mode === 'dress-up') {
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()
      await expect(page.getByRole('region', { name: '服装素材' })).toBeVisible()
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


test('AI-generated skin can be saved into the shared wardrobe and workspace', async ({ page }) => {
  const pngDataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')!
    context.fillStyle = '#123456'
    context.fillRect(0, 0, 64, 64)
    return canvas.toDataURL('image/png')
  })
  let savedAsset: Record<string, unknown> | null = null
  let savedWorkspace: Record<string, unknown> | null = null
  await page.route('**/api/ai/models', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ models: [{ id: 'test:model', provider: 'test', model: 'test-model', label: 'Test', textToImage: true, imageToImage: true }], providers: [] }),
  }))
  await page.route('**/api/ai/generate', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ imageDataUrl: pngDataUrl, provider: 'test', model: 'test-model', elapsedMs: 100, notice: 'test', outputKind: 'minecraft-skin' }),
  }))
  await page.route('**/api/assets', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    const form = route.request().postDataBuffer()
    savedAsset = { received: Boolean(form), category: 'SKIN', visibility: 'PRIVATE' }
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ item: { id: 'asset-ai-demo' } }) })
  })
  await page.route('**/api/assets/asset-ai-demo/file', route => route.fulfill({
    status: 200, contentType: 'image/png', body: Buffer.from(pngDataUrl.split(',')[1], 'base64'),
  }))
  await page.route('**/api/workspace', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: savedWorkspace ?? {
        projectId: 'project-demo', activeTool: 'WARDROBE', activeAssetId: null, activeOutfitId: 'outfit-demo',
      } }) })
      return
    }
    savedWorkspace = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: savedWorkspace }) })
  })
  await page.goto('/ai')
  await expect(page.getByRole('heading', { name: '设计你的角色' })).toBeVisible()
  await page.getByRole('button', { name: '生成皮肤 PNG' }).click()
  await expect(page.getByRole('button', { name: '保存到我的衣橱' })).toBeVisible()
  await page.getByRole('button', { name: '保存到我的衣橱' }).click()
  await expect(page.getByRole('button', { name: '已保存到衣橱' })).toBeVisible()
  expect(savedAsset).toEqual({ received: true, category: 'SKIN', visibility: 'PRIVATE' })
  expect(savedWorkspace).toEqual({
    projectId: 'project-demo', activeTool: 'AI_GENERATOR', activeAssetId: 'asset-ai-demo', activeOutfitId: null,
  })
  await expect(page.getByRole('link', { name: '打开衣橱' })).toHaveAttribute('href', '/wardrobe')

  await page.goto('/editor')
  const canvas = page.getByLabel('64 乘 64 像素画布')
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 1, 1).data[2])).toBe(86)
})

test('AI skin remains saved when workspace synchronization fails', async ({ page }) => {
  const pngDataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')!
    context.fillStyle = '#654321'
    context.fillRect(0, 0, 64, 64)
    return canvas.toDataURL('image/png')
  })
  await page.route('**/api/ai/models', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ models: [{ id: 'test:model', provider: 'test', model: 'test-model', label: 'Test', textToImage: true, imageToImage: true }], providers: [] }),
  }))
  await page.route('**/api/ai/generate', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ imageDataUrl: pngDataUrl, provider: 'test', model: 'test-model', elapsedMs: 100, notice: 'test', outputKind: 'minecraft-skin' }),
  }))
  await page.route('**/api/assets', route => route.fulfill({
    status: 201, contentType: 'application/json', body: JSON.stringify({ item: { id: 'asset-ai-partial' } }),
  }))
  await page.route('**/api/workspace', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: {
        projectId: null, activeTool: 'WARDROBE', activeAssetId: null, activeOutfitId: null,
      } }) })
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'workspace unavailable' }) })
  })

  await page.goto('/ai')
  await page.getByRole('button', { name: '生成皮肤 PNG' }).click()
  await page.getByRole('button', { name: '保存到我的衣橱' }).click()
  await expect(page.getByRole('button', { name: '已保存到衣橱' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('皮肤已保存到衣橱，但工作区同步失败')
  await expect(page.getByRole('link', { name: '打开衣橱' })).toHaveAttribute('href', '/wardrobe')
})

test('workbench nested routes map to their intended workflows', async ({ page }) => {
  const routes = [
    { path: '/workbench/ai', heading: 'AI 生成' },
    { path: '/workbench/edit', heading: '单品编辑器' },
    { path: '/workbench/dress', heading: '衣服选装', canonical: '/dress-up' },
  ]

  for (const route of routes) {
    await page.goto(route.path)
    if ('canonical' in route && route.canonical) {
      await expect(page).toHaveURL(new RegExp(route.canonical.replace('/', '\\/')))
      await expect(page.getByRole('heading', { name: '衣服选装' })).toBeVisible()
    }
    await expect(page.locator('[data-studio-mode]')).toHaveAttribute('data-studio-mode', route.path.endsWith('/ai') ? 'ai' : route.path.endsWith('/dress') ? 'dress-up' : 'editor')
  }
})


test('3D studio saves selected garments as cloud assets and an account outfit', async ({ page }) => {
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
  let outfitInput: Record<string, unknown> | null = null
  let savedOutfit: Record<string, any> | null = null
  let assetUploadCount = 0

  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({
    status: 200,
    contentType: 'image/png',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: pngBytes,
  }))
  await page.route('**/api/assets*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'POST' && url.pathname === '/api/assets') {
      assetUploadCount += 1
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        item: { id: 'asset-shawl-cloud', fileUrl: '/api/assets/asset-shawl-cloud/file' },
      }) })
      return
    }
    if (request.method() === 'GET' && url.pathname === '/api/assets') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{
        id: 'asset-shawl-cloud', category: 'SHAWL', attribution: '眼眸花披肩',
        fileUrl: '/api/assets/asset-shawl-cloud/file', isFavorite: false,
      }], nextCursor: null }) })
      return
    }
    await route.continue()
  })
  await page.route('**/api/outfits', async route => {
    if (route.request().method() === 'POST') {
      outfitInput = route.request().postDataJSON() as Record<string, unknown>
      savedOutfit = {
        id: 'outfit-cloud-demo',
        name: outfitInput.name,
        skinAssetId: outfitInput.skinAssetId,
        skinModel: outfitInput.skinModel,
        background: outfitInput.background,
        updatedAt: new Date().toISOString(),
        items: (outfitInput.items as Array<Record<string, unknown>>).map(item => ({
          assetId: item.assetId, category: item.category, sortOrder: item.sortOrder, equipped: item.equipped,
        })),
      }
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ item: { id: 'outfit-cloud-demo' } }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: savedOutfit ? [savedOutfit] : [] }) })
  })
  await page.route('**/api/workspace', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: {
        projectId: null, activeTool: 'WARDROBE', activeAssetId: null, activeOutfitId: null,
      } }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: route.request().postDataJSON() }) })
  })

  await page.goto('/dress-up')
  await expect(page.getByRole('heading', { name: '衣服选装' })).toBeVisible()
  await page.getByRole('button', { name: '披肩', exact: true }).click()
  await page.getByRole('button', { name: /眼眸花披肩/ }).click()
  await page.getByLabel('穿搭名称').fill('云端披肩测试')
  await page.getByRole('button', { name: '保存到账号云端' }).click()
  await expect(page.getByText(/已保存到账号云端/)).toBeVisible()
  expect(assetUploadCount).toBe(1)
  expect(outfitInput).toMatchObject({
    name: '云端披肩测试',
    skinModel: 'CLASSIC',
    items: [{ assetId: 'asset-shawl-cloud', category: 'SHAWL', sortOrder: 0, equipped: true }],
  })
  await expect(page.locator('#dressup-saved-outfit')).toContainText('云端披肩测试')
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
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '衣橱' })).toHaveAttribute('href', '/wardrobe')
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '3D 换装' })).toHaveAttribute('href', '/dress-up')
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: 'AI 创作' })).toHaveAttribute('href', '/ai')
})


test('dedicated dress-up route opens the 3D outfit studio, not the asset library', async ({ page }) => {
  await page.goto('/dress-up')
  await expect(page).toHaveURL(/\/dress-up$/)
  await expect(page.locator('[data-studio-mode="dress-up"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: '衣服选装' })).toBeVisible()
  await expect(page.getByRole('region', { name: '服装素材' })).toBeVisible()
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

test('saving a new pixel skin clears the previous outfit workspace pointer', async ({ page }) => {
  let savedWorkspace: Record<string, unknown> | null = null
  await page.route('**/api/assets', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ item: { id: 'pixel-skin-new' } }) })
  })
  await page.route('**/api/workspace', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: {
        projectId: 'project-demo', activeTool: 'WARDROBE', activeAssetId: 'old-skin', activeOutfitId: 'old-outfit',
      } }) })
      return
    }
    savedWorkspace = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: savedWorkspace }) })
  })

  await page.goto('/editor')
  await page.getByRole('button', { name: '保存到衣橱' }).click()
  await expect.poll(() => savedWorkspace).toEqual({
    projectId: 'project-demo',
    activeTool: 'PIXEL_EDITOR',
    activeAssetId: 'pixel-skin-new',
    activeOutfitId: null,
  })
  await expect(page.getByText('皮肤已保存到衣橱，并已同步为当前工作区素材')).toBeVisible()
})

test('wardrobe asset handoff clears a previously active cloud outfit', async ({ page }) => {
  let savedPointer: Record<string, unknown> | null = null
  await page.route('**/api/assets?limit=60', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [{
      id: 'skin-next', category: 'SKIN', kind: 'SKIN_TEXTURE', width: 64, height: 64,
      attribution: '新皮肤', fileUrl: '/api/assets/skin-next/file', createdAt: '2026-11-03T00:00:00.000Z', isFavorite: false,
    }], nextCursor: null }),
  }))
  await page.route('**/api/outfits', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }),
  }))
  await page.route('**/api/workspace', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: {
        projectId: null, activeTool: 'WARDROBE', activeAssetId: null, activeOutfitId: 'old-outfit',
      } }) })
      return
    }
    savedPointer = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: savedPointer }) })
  })

  await page.goto('/wardrobe')
  await page.getByRole('button', { name: '在 3D 换装中使用' }).click()
  await expect.poll(() => savedPointer).toMatchObject({
    activeTool: 'WARDROBE', activeAssetId: 'skin-next', activeOutfitId: null,
  })
  await expect(page).toHaveURL(new RegExp('/dress-up$'))
})

test('wardrobe outfit handoff clears a previously active single asset', async ({ page }) => {
  let savedPointer: Record<string, unknown> | null = null
  await page.route('**/api/assets?limit=60', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], nextCursor: null }),
  }))
  await page.route('**/api/outfits', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{
      id: 'outfit-next', name: '春日搭配', items: [{ assetId: 'shawl-1' }],
    }] }),
  }))
  await page.route('**/api/workspace', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: {
        projectId: null, activeTool: 'WARDROBE', activeAssetId: 'old-asset', activeOutfitId: null,
      } }) })
      return
    }
    savedPointer = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: savedPointer }) })
  })

  await page.goto('/wardrobe')
  await page.getByRole('button', { name: '我的穿搭' }).click()
  await page.getByRole('button', { name: '载入这套穿搭' }).click()
  await expect.poll(() => savedPointer).toMatchObject({
    activeTool: 'WARDROBE', activeAssetId: null, activeOutfitId: 'outfit-next',
  })
  await expect(page).toHaveURL(new RegExp('/dress-up$'))
})

