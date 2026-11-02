import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, scryptSync } from 'node:crypto'
import { PrismaClient } from '../../generated/prisma-postgresql/index.js'
import { PrismaPg } from '@prisma/adapter-pg'

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

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

    const ownerAssets = await fetch(new URL('/api/assets', base), { headers: { cookie: ownerSession } })
    assert.equal(ownerAssets.status, 200, 'authenticated owner can list own assets')

    const create = await fetch(new URL('/api/outfits', base), {
      method: 'POST',
      headers: { cookie: ownerSession, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Private E2E outfit', items: [] }),
    })
    assert.equal(create.status, 201)
    const { item } = await create.json()
    assert.ok(item.id)

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
      body: JSON.stringify({ name: 'Owner updated outfit', items: [] }),
    })
    assert.equal(update.status, 200)
    assert.equal((await update.json()).item.name, 'Owner updated outfit')

    const remove = await fetch(new URL(`/api/outfits/${item.id}`, base), { method: 'DELETE', headers: { cookie: ownerSession } })
    assert.equal(remove.status, 200)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await prisma.$disconnect()
  }
})
