import test from 'node:test'
import assert from 'node:assert/strict'
import { validateStudioSkinTexture, selectStudioOverlayTexture, validateStudioOverlayMatchesBase } from '../../src/domain/studio-texture.ts'

test('studio accepts 64×64 and 128×128 base skins and clothing overlays', () => {
  assert.equal(validateStudioSkinTexture({ width: 64, height: 64 }, 'base-skin'), null)
  assert.equal(validateStudioSkinTexture({ width: 64, height: 64 }, 'clothing-overlay'), null)
  assert.equal(validateStudioSkinTexture({ width: 128, height: 128 }, 'base-skin'), null)
  assert.equal(validateStudioSkinTexture({ width: 128, height: 128 }, 'clothing-overlay'), null)
})

test('studio rejects legacy or non-square base skin dimensions', () => {
  assert.match(validateStudioSkinTexture({ width: 64, height: 32 }, 'base-skin') ?? '', /64×64/)
  assert.match(validateStudioSkinTexture({ width: 128, height: 64 }, 'base-skin') ?? '', /64×64 或 128×128/)
})

test('studio refuses to stretch clothing textures into the skin UV map', () => {
  assert.match(validateStudioSkinTexture({ width: 128, height: 64 }, 'clothing-overlay') ?? '', /不能自动拉伸/)
})

test('studio rejects invalid image dimensions', () => {
  assert.match(validateStudioSkinTexture({ width: 0, height: 64 }, 'base-skin') ?? '', /尺寸无效/)
  assert.match(validateStudioSkinTexture({ width: 64.5, height: 64 }, 'clothing-overlay') ?? '', /尺寸无效/)
})


test('selects the source atlas for each model and native skin resolution', () => {
  const variants = {
    texture: 'coat_default_64.png',
    texture128: 'coat_default_128.png',
    modelTexture: 'coat_slim_64.png',
    modelTexture128: 'coat_slim_128.png',
  }
  assert.equal(selectStudioOverlayTexture(variants, 'steve', 64), 'coat_default_64.png')
  assert.equal(selectStudioOverlayTexture(variants, 'steve', 128), 'coat_default_128.png')
  assert.equal(selectStudioOverlayTexture(variants, 'alex', 64), 'coat_slim_64.png')
  assert.equal(selectStudioOverlayTexture(variants, 'alex', 128), 'coat_slim_128.png')
})

test('does not silently upscale or downscale when a model-specific texture variant is missing', () => {
  assert.throws(() => selectStudioOverlayTexture({
    texture: 'coat_default_64.png',
    modelTexture: 'coat_slim_64.png',
  }, 'steve', 128), /缺少 Steve 128×128/)
  assert.throws(() => selectStudioOverlayTexture({
    texture: 'coat_default_64.png',
    texture128: 'coat_default_128.png',
  }, 'alex', 128), /缺少 Alex 128×128/)
})

test('requires overlay atlas dimensions to match the base skin exactly', () => {
  assert.equal(validateStudioOverlayMatchesBase(
    { width: 64, height: 64 }, { width: 64, height: 64 },
  ), null)
  assert.equal(validateStudioOverlayMatchesBase(
    { width: 128, height: 128 }, { width: 128, height: 128 },
  ), null)
  assert.match(validateStudioOverlayMatchesBase(
    { width: 128, height: 128 }, { width: 64, height: 64 },
  ) || '', /必须与当前皮肤一致/)
  assert.match(validateStudioOverlayMatchesBase(
    { width: 64, height: 64 }, { width: 128, height: 128 },
  ) || '', /必须与当前皮肤一致/)
})
