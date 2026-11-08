import test from 'node:test'
import assert from 'node:assert/strict'
import { drawStudioOverlayUvRegions } from '../../src/client/studio-overlay-compositor.ts'

test('category compositor clears stale base pixels before alpha drawing', () => {
  const calls: Array<{ method: string; args: number[] }> = []
  const context = {
    clearRect: (...args: number[]) => calls.push({ method: 'clearRect', args }),
    drawImage: (_image: CanvasImageSource, ...args: number[]) => calls.push({ method: 'drawImage', args }),
  }
  const overlay = {} as CanvasImageSource

  drawStudioOverlayUvRegions(context, overlay, '帽子', 64)
  assert.deepEqual(calls, [
    { method: 'clearRect', args: [32, 0, 24, 16] },
    { method: 'drawImage', args: [32, 0, 24, 16, 32, 0, 24, 16] },
  ])

  calls.length = 0
  drawStudioOverlayUvRegions(context, overlay, '裤子', 128)
  assert.deepEqual(calls, [
    { method: 'clearRect', args: [0, 64, 32, 32] },
    { method: 'drawImage', args: [0, 64, 32, 32, 0, 64, 32, 32] },
    { method: 'clearRect', args: [0, 96, 32, 32] },
    { method: 'drawImage', args: [0, 96, 32, 32, 0, 96, 32, 32] },
  ])
})
