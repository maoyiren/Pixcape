import test from 'node:test'
import assert from 'node:assert/strict'
import { bresenhamLine, uvToTexel } from '../../src/domain/skin-paint.ts'

test('Bresenham interpolation includes endpoints and fills fast diagonal pointer movement', () => {
  assert.deepEqual(bresenhamLine(0, 0, 4, 2), [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 2 },
  ])
  assert.deepEqual(bresenhamLine(4, 2, 0, 0), [
    { x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 0 },
  ])
})

test('UV mapping converts bottom-left UV origin into top-left texture coordinates', () => {
  assert.deepEqual(uvToTexel(0, 1), { x: 0, y: 0 })
  assert.deepEqual(uvToTexel(0.5, 0.5), { x: 32, y: 32 })
  assert.deepEqual(uvToTexel(1, 0), { x: 63, y: 63 })
  assert.deepEqual(uvToTexel(-1, 2), { x: 0, y: 0 })
  assert.throws(() => uvToTexel(0, 0, 0), RangeError)
})
