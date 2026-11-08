import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOutfitBackupAssets, normalizeOutfitBackupSkinUrl } from '../../src/domain/outfit-backup.ts'

const asset = (overrides: Record<string, unknown> = {}) => ({
  id: 'asset_123',
  assetId: 'asset_123',
  name: '原创披风',
  category: '披风',
  fileUrl: 'https://attacker.example/steal.png',
  texture: 'https://attacker.example/steal.png',
  visibility: 'PRIVATE',
  provenance: 'USER_CREATED',
  downloadPolicy: 'OWNER_ONLY',
  attribution: '作者',
  ...overrides,
})

test('restores only canonical same-origin asset references', () => {
  const [result] = normalizeOutfitBackupAssets([asset()])
  assert.equal(result.fileUrl, '/api/assets/asset_123/file')
  assert.equal(result.texture, '/api/assets/asset_123/file')
  assert.equal(result.canDownload, false)
  assert.equal(result.visibility, 'PRIVATE')
})

test('rejects mismatched ids, unsupported categories and malformed records', () => {
  assert.deepEqual(normalizeOutfitBackupAssets([
    asset({ assetId: 'another_asset' }),
    asset({ category: '帽子' }),
    null,
    'not-an-object',
  ]), [])
})

test('restores hat, pants and shoes using canonical same-origin asset routes', () => {
  const result = normalizeOutfitBackupAssets([
    asset({ id: 'hat_1', assetId: 'hat_1', category: '帽子' }),
    asset({ id: 'pants_1', assetId: 'pants_1', category: '裤子' }),
    asset({ id: 'shoes_1', assetId: 'shoes_1', category: '鞋子' }),
  ])
  assert.deepEqual(result.map(item => item.category), ['帽子', '裤子', '鞋子'])
  assert.deepEqual(result.map(item => item.fileUrl), [
    '/api/assets/hat_1/file', '/api/assets/pants_1/file', '/api/assets/shoes_1/file',
  ])
  assert.ok(result.every(item => item.canDownload === false))
})

test('never imports official assets or trusts client download flags', () => {
  const result = normalizeOutfitBackupAssets([
    asset({ id: 'official_1', assetId: 'official_1', provenance: 'OFFICIAL', canDownload: true }),
    asset({ canDownload: true, downloadPolicy: 'LICENSED_PUBLIC' }),
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].canDownload, false)
})

test('deduplicates asset references and restores up to 64 unique assets', () => {
  const result = normalizeOutfitBackupAssets([
    asset(),
    asset(),
    ...Array.from({ length: 80 }, (_, i) => asset({ id: `asset_${i}`, assetId: `asset_${i}` })),
  ])
  assert.equal(result.length, 64)

  const oversized = Array.from({ length: 1000 }, (_, i) => asset({ id: `bulk_${i}`, assetId: `bulk_${i}` }))
  assert.equal(normalizeOutfitBackupAssets(oversized).length, 64)
})

test('accepts only relative CDPC skin asset routes', () => {
  assert.equal(normalizeOutfitBackupSkinUrl('/api/assets/skin_123/file'), '/api/assets/skin_123/file')
  assert.equal(normalizeOutfitBackupSkinUrl('/api/assets/skin_123/file?download=1'), '/api/assets/skin_123/file')
  assert.equal(normalizeOutfitBackupSkinUrl('https://evil.example/api/assets/skin_123/file'), undefined)
  assert.equal(normalizeOutfitBackupSkinUrl('//evil.example/api/assets/skin_123/file'), undefined)
  assert.equal(normalizeOutfitBackupSkinUrl('data:image/png;base64,AAAA'), undefined)
})
