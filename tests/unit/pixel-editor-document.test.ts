import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePixelEditorDocument } from '../../src/domain/pixel-editor-document.ts'

const layer = (id: string, size = 64) => ({ id, name: id, visible: true, opacity: 100, pixels: Array(size * size).fill('') })

test('normalizes valid 64x64 and 128x128 editor documents', () => {
  for (const size of [64, 128] as const) {
    const result = normalizePixelEditorDocument({ version: 1, width: size, height: size, activeId: 'base', layers: [layer('base', size)] })
    assert.equal(result?.width, size)
    assert.equal(result?.layers[0].pixels.length, size * size)
  }
})

test('migrates the previous 64x64 local draft shape', () => {
  const result = normalizePixelEditorDocument({ activeId: 'base', layers: [layer('base')] })
  assert.equal(result?.width, 64)
  assert.equal(result?.activeId, 'base')
})

test('rejects malformed dimensions, empty layers, and malformed pixel buffers', () => {
  assert.equal(normalizePixelEditorDocument({ version: 1, width: 96, height: 96, activeId: 'x', layers: [layer('x')] }), null)
  assert.equal(normalizePixelEditorDocument({ version: 1, width: 64, height: 64, activeId: 'x', layers: [] }), null)
  assert.equal(normalizePixelEditorDocument({ version: 1, width: 64, height: 64, activeId: 'x', layers: [{ ...layer('x'), pixels: ['#fff'] }] }), null)
})

test('normalizes layer attributes and repairs an invalid active layer id', () => {
  const result = normalizePixelEditorDocument({ version: 1, width: 64, height: 64, activeId: 'missing', layers: [{ ...layer('base'), name: '  ', visible: false, opacity: 180 }] })
  assert.equal(result?.activeId, 'base')
  assert.equal(result?.layers[0].name, '未命名图层')
  assert.equal(result?.layers[0].visible, false)
  assert.equal(result?.layers[0].opacity, 100)
})

test('rejects duplicate layer ids and invalid pixel colors', () => {
  assert.equal(normalizePixelEditorDocument({ version: 1, width: 64, height: 64, activeId: 'x', layers: [layer('x'), layer('x')] }), null)
  const pixels = Array(64 * 64).fill('')
  pixels[0] = 'red'
  assert.equal(normalizePixelEditorDocument({ version: 1, width: 64, height: 64, activeId: 'x', layers: [{ ...layer('x'), pixels }] }), null)
})


test('enforces the same 24-layer limit as the cloud document API', () => {
  const layers24 = Array.from({ length: 24 }, (_, index) => layer(`layer-${index}`))
  const layers25 = Array.from({ length: 25 }, (_, index) => layer(`layer-${index}`))
  assert.equal(normalizePixelEditorDocument({ version: 1, width: 64, height: 64, activeId: 'layer-0', layers: layers24 })?.layers.length, 24)
  assert.equal(normalizePixelEditorDocument({ version: 1, width: 64, height: 64, activeId: 'layer-0', layers: layers25 }), null)
})
