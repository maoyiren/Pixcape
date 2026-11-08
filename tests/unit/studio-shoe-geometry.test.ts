import test from 'node:test'
import assert from 'node:assert/strict'
import { createStudioShoeGeometry } from '../../src/client/studio-shoe-geometry.ts'
import { getStudioShoeUvRegions } from '../../src/domain/studio-uv-layout.ts'

test('left and right shoe meshes use independent, normalized 64px and 128px UV islands', () => {
  const regions64 = getStudioShoeUvRegions(64)
  const regions128 = getStudioShoeUvRegions(128)
  assert.equal(regions64.length, 2)
  assert.equal(regions128.length, 2)

  for (let index = 0; index < 2; index++) {
    const geometry64 = createStudioShoeGeometry(regions64[index], 64)
    const geometry128 = createStudioShoeGeometry(regions128[index], 128)
    const uv64 = geometry64.getAttribute('uv')
    const uv128 = geometry128.getAttribute('uv')

    assert.equal(geometry64.getAttribute('position').count, 24)
    assert.equal(geometry128.getAttribute('position').count, 24)
    assert.equal(uv64.count, 24)
    assert.equal(uv128.count, 24)

    for (let vertex = 0; vertex < uv64.count; vertex++) {
      assert.ok(Math.abs(uv64.getX(vertex) - uv128.getX(vertex)) < 1e-6)
      assert.ok(Math.abs(uv64.getY(vertex) - uv128.getY(vertex)) < 1e-6)
      assert.ok(uv64.getX(vertex) >= 0 && uv64.getX(vertex) <= 0.25)
      assert.ok(uv64.getY(vertex) >= 0.25 && uv64.getY(vertex) <= 0.5)
    }

    geometry64.dispose()
    geometry128.dispose()
  }
})
