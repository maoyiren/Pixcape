import test from 'node:test'
import assert from 'node:assert/strict'
import { OutfitInputSchema } from '../../src/domain/outfit-input.ts'
import { parsePng } from '../../src/domain/png.ts'

test('outfit input supplies stable defaults and rejects duplicate or skin wearable items', () => {
  const valid = OutfitInputSchema.parse({
    name: '冬日搭配',
    items: [{ assetId: 'shawl-1', category: 'SHAWL' }],
  })
  assert.equal(valid.skinModel, 'CLASSIC')
  assert.equal(valid.items[0].equipped, true)
  assert.equal(valid.items[0].sortOrder, 0)
  assert.equal(OutfitInputSchema.safeParse({
    items: [
      { assetId: 'same', category: 'SHAWL' },
      { assetId: 'same', category: 'SHAWL' },
    ],
  }).success, false)
  assert.equal(OutfitInputSchema.safeParse({
    items: [{ assetId: 'skin-1', category: 'SKIN' }],
  }).success, false)
})

test('PNG parser checks signature, IHDR and bounded dimensions', () => {
  const png = new Uint8Array(33)
  png.set([137, 80, 78, 71, 13, 10, 26, 10], 0)
  png.set([0, 0, 0, 13], 8)
  png.set([73, 72, 68, 82], 12)
  new DataView(png.buffer).setUint32(16, 64, false)
  new DataView(png.buffer).setUint32(20, 64, false)
  assert.deepEqual(parsePng(png), { width: 64, height: 64 })
  assert.throws(() => parsePng(new Uint8Array(40)), /PNG/)
  new DataView(png.buffer).setUint32(16, 2048, false)
  assert.throws(() => parsePng(png), /尺寸/)
})
