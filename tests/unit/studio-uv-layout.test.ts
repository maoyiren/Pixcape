import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canEquipStudioOverlayTogether,
  getStudioOverlayUvProfile,
  getStudioShoeUvRegions,
  getStudioOverlayUvRegions,
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
    { side: 'right', faces: {
      top: { x: 4, y: 40, width: 4, height: 4 }, bottom: { x: 8, y: 32, width: 4, height: 4 },
      left: { x: 0, y: 40, width: 4, height: 4 }, right: { x: 8, y: 40, width: 4, height: 4 },
      front: { x: 4, y: 40, width: 4, height: 4 }, back: { x: 12, y: 40, width: 4, height: 4 },
    } },
    { side: 'left', faces: {
      top: { x: 4, y: 56, width: 4, height: 4 }, bottom: { x: 8, y: 48, width: 4, height: 4 },
      left: { x: 0, y: 56, width: 4, height: 4 }, right: { x: 8, y: 56, width: 4, height: 4 },
      front: { x: 4, y: 56, width: 4, height: 4 }, back: { x: 12, y: 56, width: 4, height: 4 },
    } },
  ])
  assert.deepEqual(getStudioShoeUvRegions(128)[0].faces.front, { x: 8, y: 80, width: 8, height: 8 })
  assert.deepEqual(getStudioShoeUvRegions(128)[1].faces.bottom, { x: 16, y: 96, width: 8, height: 8 })
  assert.equal(canEquipStudioOverlayTogether(['裤子'], '鞋子'), true)
  assert.equal(canEquipStudioOverlayTogether(['鞋子'], '裤子'), true)
})

test('hat, pants and shoes composite only their own atlas UV islands', () => {
  assert.deepEqual(getStudioOverlayUvRegions('帽子', 64), [
    { x: 32, y: 0, width: 24, height: 16 },
  ])
  assert.deepEqual(getStudioOverlayUvRegions('裤子', 64), [
    { x: 0, y: 32, width: 16, height: 16 },
    { x: 0, y: 48, width: 16, height: 16 },
  ])
  assert.deepEqual(getStudioOverlayUvRegions('鞋子', 64), [
    { x: 4, y: 40, width: 4, height: 4 }, { x: 8, y: 32, width: 4, height: 4 },
    { x: 0, y: 40, width: 4, height: 4 }, { x: 8, y: 40, width: 4, height: 4 },
    { x: 12, y: 40, width: 4, height: 4 }, { x: 4, y: 56, width: 4, height: 4 },
    { x: 8, y: 48, width: 4, height: 4 }, { x: 0, y: 56, width: 4, height: 4 },
    { x: 8, y: 56, width: 4, height: 4 }, { x: 12, y: 56, width: 4, height: 4 },
  ])
  assert.deepEqual(getStudioOverlayUvRegions('鞋子', 128)[0], { x: 8, y: 80, width: 8, height: 8 })
})

test('cape remains separate back equipment and has no skin UV profile', () => {
  assert.throws(() => getStudioOverlayUvProfile('披风' as never))
})
