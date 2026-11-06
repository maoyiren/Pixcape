import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeUsername, UsernameSchema } from '../../src/domain/username.ts'

test('username is normalized to lowercase and trimmed', () => {
  assert.equal(UsernameSchema.parse('  Pixel_Creator-7  '), 'pixel_creator-7')
})

test('username enforces length and allowed characters', () => {
  assert.equal(normalizeUsername('ab'), null)
  assert.equal(normalizeUsername('a'.repeat(25)), null)
  assert.equal(normalizeUsername('two words'), null)
  assert.equal(normalizeUsername('-leading'), null)
  assert.equal(normalizeUsername('trailing-'), null)
})

test('reserved route names cannot be claimed', () => {
  for (const value of ['admin', 'api', 'studio', 'wardrobe', 'settings', 'login']) {
    assert.equal(normalizeUsername(value), null)
  }
})

test('valid public profile slugs are accepted', () => {
  for (const value of ['alex', 'pixel_fox', 'skin-maker7', 'user-12345678']) {
    assert.notEqual(normalizeUsername(value), null)
  }
})
