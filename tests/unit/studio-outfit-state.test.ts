import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStudioPose } from '../../src/domain/studio-outfit-state.ts'

test('studio preserves every supported animation pose', () => {
  for (const pose of ['idle', 'wave', 'walk', 'fly']) assert.equal(normalizeStudioPose(pose), pose)
})

test('studio restores legacy and invalid pose values to idle', () => {
  for (const pose of [undefined, null, '', 'jump', 1, {}]) assert.equal(normalizeStudioPose(pose), 'idle')
})
