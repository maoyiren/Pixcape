import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, scryptSync } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma-postgresql/index.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { deflateSync } from 'node:zlib'

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'


function pngChunk(type, data) {
  const typeBytes = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  let crc = 0xffffffff
  for (const byte of Buffer.concat([typeBytes, data])) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([length, typeBytes, data, checksum])
}

function createTinyPng() {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.from([0, 0, 0, 0, 0]))),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}


test('security headers are sent on public pages', async () => {
  const response = await fetch(base, { redirect: 'manual' })
  assert.ok(response.status < 500, `home should not return server error (got ${response.status})`)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('x-frame-options'), 'DENY')
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin')
})

for (const path of ['/account', '/creator', '/admin', '/admin/user', '/admin/audit', '/admin/stat']) {
  test(`anonymous access to ${path} is denied`, async () => {
    const response = await fetch(new URL(path, base), { redirect: 'manual' })
    assert.ok([302, 307, 308].includes(response.status), `${path} should redirect unauthenticated users (got ${response.status})`)
    assert.match(response.headers.get('location') || '', /login/)
  })
}

test('NextAuth CSRF endpoint issues a token and cookie', async () => {
  const response = await fetch(new URL('/api/auth/csrf', base), { redirect: 'manual' })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(typeof body.csrfToken, 'string')
  assert.ok(body.csrfToken.length > 10)
  assert.match(response.headers.get('set-cookie') || '', /csrf-token/i)
})

test('login entry point is rate-limited and emits Retry-After', async () => {
  let finalResponse
  for (let i = 0; i < 12; i++) {
    finalResponse = await fetch(new URL('/api/auth/signin/github', base), {
      method: 'GET',
      redirect: 'manual',
      headers: { 'x-real-ip': '198.51.100.77' },
    })
  }
  assert.equal(finalResponse.status, 429)
  assert.ok(Number(finalResponse.headers.get('retry-after')) > 0)
  assert.equal(finalResponse.headers.get('cache-control'), 'no-store')

  const otherAddress = await fetch(new URL('/api/auth/signin/github', base), {
    method: 'GET',
    redirect: 'manual',
    headers: { 'x-real-ip': '198.51.100.78' },
  })
  assert.notEqual(otherAddress.status, 429, 'rate limit must be isolated by client address')
})


test('internal AI configuration endpoint is private and non-cacheable without a service token', async () => {
  const response = await fetch(new URL('/api/internal/ai-config', base), {
    headers: { Authorization: 'Bearer invalid-test-token' },
    redirect: 'manual',
  })
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.text()
  assert.doesNotMatch(body, /GEMINI_API_KEY|OPENAI_API_KEY|ARK_API_KEY|AI_SECRET_/)
})

for (const [method, path, body, headers] of [
  ['GET', '/api/assets'],
  ['POST', '/api/assets', new FormData()],
  ['GET', '/api/assets/test-asset/file'],
  ['DELETE', '/api/assets/test-asset'],
  ['GET', '/api/outfits'],
  ['POST', '/api/outfits', JSON.stringify({ name: 'unauthenticated' }), { 'content-type': 'application/json' }],
  ['GET', '/api/outfits/test-outfit'],
  ['PUT', '/api/outfits/test-outfit', JSON.stringify({ name: 'unauthenticated' }), { 'content-type': 'application/json' }],
  ['DELETE', '/api/outfits/test-outfit'],
  ['GET', '/api/editor-documents'],
  ['POST', '/api/editor-documents', JSON.stringify({ name: 'anonymous', document: {} }), { 'content-type': 'application/json' }],
  ['GET', '/api/editor-documents/test-document'],
  ['PUT', '/api/editor-documents/test-document', JSON.stringify({ revision: 1, document: {} }), { 'content-type': 'application/json' }],
  ['DELETE', '/api/editor-documents/test-document'],
]) {
  test(`anonymous ${method} ${path} is denied before resource access`, async () => {
    const response = await fetch(new URL(path, base), {
      method,
      body,
      headers,
      redirect: 'manual',
    })
    assert.equal(response.status, 401, `${method} ${path} must require an authenticated session (got ${response.status})`)
  })
}


test('authenticated wardrobe APIs isolate two real user sessions', async () => {
  const connectionString = process.env.DATABASE_URL
  assert.ok(connectionString, 'DATABASE_URL is required for authenticated API E2E')
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  const suffix = randomUUID()
  const password = 'CDPC-E2E-password-2026!'
  const salt = randomUUID().replaceAll('-', '')
  const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
  const emails = [`wardrobe-owner-${suffix}@pixcape-test.invalid`, `wardrobe-other-${suffix}@pixcape-test.invalid`]
  const userIds = []
  let ownerSession
  let otherSession

  const cookiePairs = (headers) => {
    const values = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie') || '']
    return values.map((value) => value.split(';', 1)[0]).filter(Boolean)
  }

  async function login(email, ip) {
    const csrfResponse = await fetch(new URL('/api/auth/csrf', base))
    assert.equal(csrfResponse.status, 200)
    const { csrfToken } = await csrfResponse.json()
    const csrfCookie = cookiePairs(csrfResponse.headers).find((cookie) => /csrf-token=/i.test(cookie))
    assert.ok(csrfCookie, 'NextAuth must issue a CSRF cookie')

    const callback = await fetch(new URL('/api/auth/callback/email-password', base), {
      method: 'POST',
      headers: {
        cookie: csrfCookie,
        'content-type': 'application/x-www-form-urlencoded',
        'x-auth-return-redirect': '1',
        'x-real-ip': ip,
      },
      body: new URLSearchParams({ csrfToken, email, password, callbackUrl: base, json: 'true' }),
      redirect: 'manual',
    })
    assert.ok([200, 302].includes(callback.status), `credentials callback should succeed (got ${callback.status})`)
    const sessionCookie = cookiePairs(callback.headers).find((cookie) => /next-auth\.session-token=/i.test(cookie))
    assert.ok(sessionCookie, 'successful credentials callback must issue a session cookie')
    return `${csrfCookie}; ${sessionCookie}`
  }

  try {
    for (const email of emails) {
      const user = await prisma.user.create({
        data: { email, name: 'Wardrobe E2E', passwordHash, status: 'ACTIVE' },
        select: { id: true },
      })
      userIds.push(user.id)
    }

    ownerSession = await login(emails[0], '198.51.100.91')
    otherSession = await login(emails[1], '198.51.100.92')

    const uploadForm = new FormData()
    uploadForm.set('file', new File([createTinyPng()], 'shawl.png', { type: 'image/png' }))
    uploadForm.set('category', 'SHAWL')
    uploadForm.set('visibility', 'PRIVATE')
    const upload = await fetch(new URL('/api/assets', base), { method: 'POST', headers: { cookie: ownerSession }, body: uploadForm })
    assert.equal(upload.status, 201, `authenticated owner can upload PNG (got ${upload.status})`)
    const { item: asset } = await upload.json()
    assert.ok(asset.id)

    const ownerAssets = await fetch(new URL('/api/assets', base), { headers: { cookie: ownerSession } })
    assert.equal(ownerAssets.status, 200, 'authenticated owner can list own assets')
    const ownerAssetItems = (await ownerAssets.json()).items
    assert.ok(ownerAssetItems.some((entry) => entry.id === asset.id))
    assert.equal(ownerAssetItems.find((entry) => entry.id === asset.id).isFavorite, false)

    const favorite = await fetch(new URL(`/api/assets/${asset.id}/favorite`, base), {
      method: 'PUT', headers: { cookie: ownerSession },
    })
    assert.equal(favorite.status, 200, 'owner can favorite an accessible asset')
    assert.equal((await favorite.json()).favorited, true)
    const favoriteAgain = await fetch(new URL(`/api/assets/${asset.id}/favorite`, base), {
      method: 'PUT', headers: { cookie: ownerSession },
    })
    assert.equal(favoriteAgain.status, 200, 'favoriting twice is idempotent')

    const otherFavoritePrivate = await fetch(new URL(`/api/assets/${asset.id}/favorite`, base), {
      method: 'PUT', headers: { cookie: otherSession },
    })
    assert.equal(otherFavoritePrivate.status, 404, 'another user cannot favorite a private asset')

    const ownerFile = await fetch(new URL(asset.fileUrl, base), { headers: { cookie: ownerSession } })
    assert.equal(ownerFile.status, 200, 'owner can read uploaded PNG')
    assert.equal(Number(ownerFile.headers.get('content-length')), createTinyPng().length)

    const otherAssets = await fetch(new URL('/api/assets', base), { headers: { cookie: otherSession } })
    assert.equal(otherAssets.status, 200)
    assert.ok(!(await otherAssets.json()).items.some((entry) => entry.id === asset.id))
    const otherFile = await fetch(new URL(asset.fileUrl, base), { headers: { cookie: otherSession } })
    assert.equal(otherFile.status, 404)
    const otherAssetDelete = await fetch(new URL(`/api/assets/${asset.id}`, base), { method: 'DELETE', headers: { cookie: otherSession } })
    assert.equal(otherAssetDelete.status, 404)

    const create = await fetch(new URL('/api/outfits', base), {
      method: 'POST',
      headers: { cookie: ownerSession, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Private E2E outfit', items: [{ assetId: asset.id, category: 'SHAWL', sortOrder: 0, equipped: true }] }),
    })
    assert.equal(create.status, 201)
    const { item } = await create.json()
    assert.ok(item.id)

    const saveWorkspace = await fetch(new URL('/api/workspace', base), {
      method: 'PUT',
      headers: { cookie: ownerSession, 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: null, activeTool: 'WARDROBE',
        activeAssetId: asset.id, activeOutfitId: item.id,
      }),
    })
    assert.equal(saveWorkspace.status, 200, 'owner can persist cross-tool workspace pointers')
    const savedWorkspace = await saveWorkspace.json()
    assert.equal(savedWorkspace.item.activeAssetId, asset.id)
    assert.equal(savedWorkspace.item.activeOutfitId, item.id)

    const editorDocumentPayload = {
      version: 1,
      width: 64,
      height: 64,
      activeId: 'layer-one',
      layers: [{
        id: 'layer-one',
        name: '基础图层',
        visible: true,
        opacity: 100,
        pixels: Array(4096).fill(''),
      }],
    }
    const createEditorDocument = await fetch(new URL('/api/editor-documents', base), {
      method: 'POST',
      headers: { cookie: ownerSession, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Private pixel project', document: editorDocumentPayload }),
    })
    assert.equal(createEditorDocument.status, 201, 'authenticated owner can save a cloud editor document')
    const { item: editorDocument } = await createEditorDocument.json()
    assert.equal(editorDocument.revision, 1)

    const invalidEditorDocument = await fetch(new URL('/api/editor-documents', base), {
      method: 'POST',
      headers: { cookie: ownerSession, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Invalid pixel project', document: { version: 1, width: 32, height: 32, layers: [] } }),
    })
    assert.equal(invalidEditorDocument.status, 400, 'invalid editor document dimensions are rejected')

    const oversizedEditorDocument = await fetch(new URL('/api/editor-documents', base), {
      method: 'POST',
      headers: { cookie: ownerSession, 'content-type': 'application/json' },
      body: 'x'.repeat(2 * 1024 * 1024 + 8192),
    })
    assert.equal(oversizedEditorDocument.status, 413, 'oversized streamed editor requests are rejected before JSON parsing')

    const ownerEditorDocuments = await fetch(new URL('/api/editor-documents', base), { headers: { cookie: ownerSession } })
    assert.equal(ownerEditorDocuments.status, 200)
    assert.ok((await ownerEditorDocuments.json()).items.some((entry) => entry.id === editorDocument.id))

    const otherEditorDocuments = await fetch(new URL('/api/editor-documents', base), { headers: { cookie: otherSession } })
    assert.equal(otherEditorDocuments.status, 200)
    assert.ok(!(await otherEditorDocuments.json()).items.some((entry) => entry.id === editorDocument.id))

    const ownerEditorDocument = await fetch(new URL(`/api/editor-documents/${editorDocument.id}`, base), { headers: { cookie: ownerSession } })
    assert.equal(ownerEditorDocument.status, 200)
    assert.deepEqual((await ownerEditorDocument.json()).item.document, editorDocumentPayload)

    const otherEditorDocument = await fetch(new URL(`/api/editor-documents/${editorDocument.id}`, base), { headers: { cookie: otherSession } })
    assert.equal(otherEditorDocument.status, 404, 'another user cannot read a private editor document')

    const updatedEditorDocument = await fetch(new URL(`/api/editor-documents/${editorDocument.id}`, base), {
      method: 'PUT',
      headers: { cookie: ownerSession, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated pixel project', revision: 1, document: editorDocumentPayload }),
    })
    assert.equal(updatedEditorDocument.status, 200)
    assert.equal((await updatedEditorDocument.json()).item.revision, 2)

    const staleEditorDocument = await fetch(new URL(`/api/editor-documents/${editorDocument.id}`, base), {
      method: 'PUT',
      headers: { cookie: ownerSession, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Stale overwrite', revision: 1, document: editorDocumentPayload }),
    })
    assert.equal(staleEditorDocument.status, 409, 'stale revisions cannot overwrite a newer editor document')

    const otherEditorUpdate = await fetch(new URL(`/api/editor-documents/${editorDocument.id}`, base), {
      method: 'PUT',
      headers: { cookie: otherSession, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Cross-user overwrite', revision: 2, document: editorDocumentPayload }),
    })
    assert.equal(otherEditorUpdate.status, 404)
    const otherEditorDelete = await fetch(new URL(`/api/editor-documents/${editorDocument.id}`, base), {
      method: 'DELETE', headers: { cookie: otherSession },
    })
    assert.equal(otherEditorDelete.status, 404)

    const ownerEditorDelete = await fetch(new URL(`/api/editor-documents/${editorDocument.id}`, base), {
      method: 'DELETE', headers: { cookie: ownerSession },
    })
    assert.equal(ownerEditorDelete.status, 204)

    const otherWorkspace = await fetch(new URL('/api/workspace', base), { headers: { cookie: otherSession } })
    assert.equal(otherWorkspace.status, 200)
    const otherWorkspaceData = await otherWorkspace.json()
    assert.equal(otherWorkspaceData.item.activeAssetId, null, 'workspace pointers are isolated per user')
    assert.equal(otherWorkspaceData.item.activeOutfitId, null)

    const crossUserWorkspace = await fetch(new URL('/api/workspace', base), {
      method: 'PUT',
      headers: { cookie: otherSession, 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: null, activeTool: 'WARDROBE',
        activeAssetId: null, activeOutfitId: item.id,
      }),
    })
    assert.equal(crossUserWorkspace.status, 404, 'another user cannot persist a private outfit pointer')

    const ownerList = await fetch(new URL('/api/outfits', base), { headers: { cookie: ownerSession } })
    assert.equal(ownerList.status, 200)
    assert.ok((await ownerList.json()).items.some((outfit) => outfit.id === item.id))

    const otherList = await fetch(new URL('/api/outfits', base), { headers: { cookie: otherSession } })
    assert.equal(otherList.status, 200)
    assert.ok(!(await otherList.json()).items.some((outfit) => outfit.id === item.id))

    const otherRead = await fetch(new URL(`/api/outfits/${item.id}`, base), { headers: { cookie: otherSession } })
    assert.equal(otherRead.status, 404)
    const otherUpdate = await fetch(new URL(`/api/outfits/${item.id}`, base), {
      method: 'PUT',
      headers: { cookie: otherSession, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Cross-user overwrite', items: [] }),
    })
    assert.equal(otherUpdate.status, 404)
    const otherDelete = await fetch(new URL(`/api/outfits/${item.id}`, base), { method: 'DELETE', headers: { cookie: otherSession } })
    assert.equal(otherDelete.status, 404)

    const update = await fetch(new URL(`/api/outfits/${item.id}`, base), {
      method: 'PUT',
      headers: { cookie: ownerSession, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Owner updated outfit', items: [{ assetId: asset.id, category: 'SHAWL', sortOrder: 0, equipped: true }] }),
    })
    assert.equal(update.status, 200)
    assert.equal((await update.json()).item.name, 'Owner updated outfit')

    const remove = await fetch(new URL(`/api/outfits/${item.id}`, base), { method: 'DELETE', headers: { cookie: ownerSession } })
    assert.equal(remove.status, 200)
    const unFavorite = await fetch(new URL(`/api/assets/${asset.id}/favorite`, base), {
      method: 'DELETE', headers: { cookie: ownerSession },
    })
    assert.equal(unFavorite.status, 200)
    assert.equal((await unFavorite.json()).favorited, false)
    const ownerAssetsAfterUnfavorite = await fetch(new URL('/api/assets', base), { headers: { cookie: ownerSession } })
    const ownerAssetAfterUnfavorite = (await ownerAssetsAfterUnfavorite.json()).items.find((entry) => entry.id === asset.id)
    assert.equal(ownerAssetAfterUnfavorite.isFavorite, false)

    const deleteAsset = await fetch(new URL(`/api/assets/${asset.id}`, base), { method: 'DELETE', headers: { cookie: ownerSession } })
    assert.equal(deleteAsset.status, 200)
    const missingFile = await fetch(new URL(asset.fileUrl, base), { headers: { cookie: ownerSession } })
    assert.equal(missingFile.status, 404)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await prisma.$disconnect()
  }
})
