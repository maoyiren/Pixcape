import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canEquipStudioOverlayTogether,
  getStudioOverlayUvProfile,
} from '../../src/domain/studio-uv-layout.ts'

test('shawl and coat use separately identified source atlas profiles', () => {
  const shawl = getStudioOverlayUvProfile('披肩')
  const coat = getStudioOverlayUvProfile('外套')

  assert.equal(shawl.assetCategory, 'SHAWL')
  assert.equal(coat.assetCategory, 'COAT')
  assert.notEqual(shawl.category, coat.category)
  assert.equal(shawl.atlas, 'minecraft-skin')
  assert.equal(coat.atlas, 'minecraft-skin')
  assert.equal(shawl.composition, 'full-atlas-alpha')
  assert.equal(coat.composition, 'full-atlas-alpha')
  assert.equal(shawl.mutuallyExclusiveWith, '外套')
  assert.equal(coat.mutuallyExclusiveWith, '披肩')
  assert.equal(shawl.targetParts, null)
  assert.equal(coat.targetParts, null)
})

test('overlapping shawl and coat atlases cannot silently overwrite one another', () => {
  assert.equal(canEquipStudioOverlayTogether([], '披肩'), true)
  assert.equal(canEquipStudioOverlayTogether(['披肩'], '披肩'), true)
  assert.equal(canEquipStudioOverlayTogether(['披肩'], '外套'), false)
  assert.equal(canEquipStudioOverlayTogether(['外套'], '披肩'), false)
  assert.equal(canEquipStudioOverlayTogether(['披肩', '外套'], '披肩'), false)
})

test('hat and pants use native Minecraft outer-layer model UV surfaces', () => {
  const hat = getStudioOverlayUvProfile('帽子')
  const pants = getStudioOverlayUvProfile('裤子')
  assert.equal(hat.assetCategory, 'HAT')
  assert.equal(hat.composition, 'outer-layer-parts')
  assert.deepEqual(hat.targetParts, ['head'])
  assert.equal(pants.assetCategory, 'PANTS')
  assert.equal(pants.composition, 'outer-layer-parts')
  assert.deepEqual(pants.targetParts, ['leftLeg', 'rightLeg'])
  assert.equal(canEquipStudioOverlayTogether(['披肩'], '帽子'), true)
  assert.equal(canEquipStudioOverlayTogether(['帽子'], '裤子'), true)
  assert.equal(canEquipStudioOverlayTogether(['外套'], '裤子'), true)
})

test('cape and shoes are not assigned fabricated skin overlay UV profiles', () => {
  for (const category of ['披风', '鞋子']) assert.throws(() => getStudioOverlayUvProfile(category as never))
})
