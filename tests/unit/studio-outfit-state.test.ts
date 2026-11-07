import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStudioWorkspaceState, normalizeStudioPose } from '../../src/domain/studio-outfit-state.ts'

test('studio preserves every supported animation pose', () => {
  for (const pose of ['idle', 'wave', 'walk', 'fly']) assert.equal(normalizeStudioPose(pose), pose)
})

test('studio restores legacy and invalid pose values to idle', () => {
  for (const pose of [undefined, null, '', 'jump', 1, {}]) assert.equal(normalizeStudioPose(pose), 'idle')
})

test('saving a skinless outfit keeps the currently active workspace asset', () => {
  const current = { projectId: 'project-1', activeTool: 'PIXEL_EDITOR' as const, activeAssetId: 'asset-1', activeOutfitId: null }
  assert.deepEqual(buildStudioWorkspaceState(current, 'outfit-2', null), {
    projectId: 'project-1', activeTool: 'WARDROBE', activeAssetId: 'asset-1', activeOutfitId: 'outfit-2',
  })
})

test('saving an outfit with a new skin selects that skin in the workspace', () => {
  const current = { projectId: null, activeTool: 'WARDROBE' as const, activeAssetId: 'old-asset', activeOutfitId: null }
  assert.equal(buildStudioWorkspaceState(current, 'outfit-2', 'skin-2').activeAssetId, 'skin-2')
})
