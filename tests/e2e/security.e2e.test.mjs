import test from 'node:test'
import assert from 'node:assert/strict'

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

test('security headers are sent on public pages', async () => {
  const response = await fetch(base, { redirect: 'manual' })
  assert.ok(response.status < 500, `home should not return server error (got ${response.status})`)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('x-frame-options'), 'DENY')
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin')
})

for (const path of ['/account', '/creator', '/admin']) {
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
