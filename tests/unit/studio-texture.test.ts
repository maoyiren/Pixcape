import test from 'node:test'
import assert from 'node:assert/strict'
import { validateStudioSkinTexture } from '../../src/domain/studio-texture.ts'

test('studio accepts valid 64×64 base skins and clothing overlays', () => {
  assert.equal(validateStudioSkinTexture({ width: 64, height: 64 }, 'base-skin'), null)
  assert.equal(validateStudioSkinTexture({ width: 64, height: 64 }, 'clothing-overlay'), null)
})

test('studio rejects legacy or non-square base skin dimensions', () => {
  assert.match(validateStudioSkinTexture({ width: 64, height: 32 }, 'base-skin') ?? '', /64×64/)
  assert.match(validateStudioSkinTexture({ width: 128, height: 128 }, 'base-skin') ?? '', /64×64/)
})

test('studio refuses to stretch clothing textures into the skin UV map', () => {
  assert.match(validateStudioSkinTexture({ width: 128, height: 128 }, 'clothing-overlay') ?? '', /不能自动拉伸/)
})

test('studio rejects invalid image dimensions', () => {
  assert.match(validateStudioSkinTexture({ width: 0, height: 64 }, 'base-skin') ?? '', /尺寸无效/)
  assert.match(validateStudioSkinTexture({ width: 64.5, height: 64 }, 'clothing-overlay') ?? '', /尺寸无效/)
})
