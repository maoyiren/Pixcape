import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ASSET_CATEGORIES,
  AssetDescriptorSchema,
  OutfitItemSchema,
  OutfitSnapshotSchema,
  WorkspacePointerSchema,
} from '../../src/domain/asset.ts'

test('asset categories keep shawl, coat and cape as distinct product types', () => {
  assert.deepEqual(ASSET_CATEGORIES.slice(1, 4), ['SHAWL', 'COAT', 'CAPE'])
  assert.notEqual(ASSET_CATEGORIES.indexOf('SHAWL'), ASSET_CATEGORIES.indexOf('CAPE'))
})

test('asset descriptor validates storage metadata and rejects oversized files', () => {
  const valid = {
    id: 'asset-1',
    ownerId: 'user-1',
    kind: 'CLOTHING_TEXTURE',
    category: 'SHAWL',
    storageKey: 'users/user-1/assets/asset-1.png',
    mimeType: 'image/png',
    byteSize: 1024,
    width: 64,
    height: 64,
    sha256: 'a'.repeat(64),
    source: 'PIXEL_EDITOR',
    visibility: 'PRIVATE',
    licenseId: null,
    attribution: 'Original work',
    provenance: 'USER_CREATED',
    downloadPolicy: 'OWNER_ONLY',
    createdAt: '2026-11-01T12:00:00.000Z',
  }
  assert.equal(AssetDescriptorSchema.parse(valid).category, 'SHAWL')
  assert.equal(AssetDescriptorSchema.safeParse({ ...valid, byteSize: 60 * 1024 * 1024 }).success, false)
  assert.equal(AssetDescriptorSchema.safeParse({ ...valid, sha256: 'not-a-hash' }).success, false)
})

test('outfit items cannot use the skin category as wearable clothing', () => {
  assert.equal(OutfitItemSchema.safeParse({
    assetId: 'asset-1', category: 'CAPE', order: 0, equipped: true,
  }).success, true)
  assert.equal(OutfitItemSchema.safeParse({
    assetId: 'skin-1', category: 'SKIN', order: 0, equipped: true,
  }).success, false)
})

test('outfit snapshots preserve separate wearable references and skin model', () => {
  const parsed = OutfitSnapshotSchema.parse({
    id: 'outfit-1',
    ownerId: 'user-1',
    name: 'Winter look',
    skinAssetId: 'skin-1',
    skinModel: 'SLIM',
    items: [
      { assetId: 'shawl-1', category: 'SHAWL', order: 0, equipped: true },
      { assetId: 'coat-1', category: 'COAT', order: 1, equipped: true },
      { assetId: 'cape-1', category: 'CAPE', order: 2, equipped: false },
    ],
    background: null,
    pose: 'walking',
    updatedAt: '2026-11-01T12:00:00.000Z',
  })
  assert.equal(parsed.items.length, 3)
  assert.equal(parsed.skinModel, 'SLIM')
})

test('workspace pointers only carry stable IDs between tools', () => {
  const pointer = WorkspacePointerSchema.parse({
    projectId: 'project-1',
    activeTool: 'PIXEL_EDITOR',
    activeAssetId: 'asset-1',
    activeOutfitId: null,
  })
  assert.equal(pointer.activeAssetId, 'asset-1')
  assert.equal(WorkspacePointerSchema.safeParse({
    projectId: null, activeTool: 'UNKNOWN', activeAssetId: null, activeOutfitId: null,
  }).success, false)
})
