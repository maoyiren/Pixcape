import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canEquipStudioOverlayTogether,
  getStudioOverlayUvProfile,
  getStudioShoeUvRegions,
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

test('shoes use independent left/right lower-leg UV islands at 64px and 128px', () => {
  const shoes = getStudioOverlayUvProfile('鞋子')
  assert.equal(shoes.assetCategory, 'SHOES')
  assert.equal(shoes.composition, 'separate-box-geometry')
  assert.equal(shoes.targetParts, null)
  assert.equal(shoes.mutuallyExclusiveWith, null)
  assert.deepEqual(getStudioShoeUvRegions(64), [
    { side: 'right', u: 0, v: 40, width: 4, height: 4, depth: 4 },
    { side: 'left', u: 0, v: 56, width: 4, height: 4, depth: 4 },
  ])
  assert.deepEqual(getStudioShoeUvRegions(128), [
    { side: 'right', u: 0, v: 80, width: 4, height: 4, depth: 4 },
    { side: 'left', u: 0, v: 112, width: 4, height: 4, depth: 4 },
  ])
  assert.equal(canEquipStudioOverlayTogether(['裤子'], '鞋子'), true)
  assert.equal(canEquipStudioOverlayTogether(['鞋子'], '裤子'), true)
})

test('cape remains separate back equipment and has no skin UV profile', () => {
  assert.throws(() => getStudioOverlayUvProfile('披风' as never))
})
