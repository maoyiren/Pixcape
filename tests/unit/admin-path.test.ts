import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAdminPath } from '../../lib/admin-path-core.ts'

test('uses a private default route when no deployment path is configured', () => {
  assert.equal(resolveAdminPath(undefined), '/control-room')
  assert.equal(resolveAdminPath(''), '/control-room')
})

test('normalizes valid custom path segments', () => {
  assert.equal(resolveAdminPath('/private-console_2026/'), '/private-console_2026')
  assert.equal(resolveAdminPath('my-control-room'), '/my-control-room')
})

test('rejects short, malformed, and reserved route segments', () => {
  for (const value of ['/admin', 'admin', '/api', '/login', '/account', '/workbench', '/bad path', '/a', '/too?long']) {
    assert.equal(resolveAdminPath(value), '/control-room')
  }
})

test('path resolver never accepts nested paths or traversal strings', () => {
  assert.equal(resolveAdminPath('/console/nested'), '/control-room')
  assert.equal(resolveAdminPath('/../admin'), '/control-room')
  assert.equal(resolveAdminPath('/console%2fadmin'), '/control-room')
})
