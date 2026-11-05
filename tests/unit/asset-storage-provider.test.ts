import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAssetStorageKey, isS3AssetStorageKey } from '../../src/domain/asset-storage.ts'

test('marks new local and S3 assets with distinct storage keys', () => {
  assert.equal(buildAssetStorageKey('abc-123', false), 'assets/abc-123.png')
  assert.equal(buildAssetStorageKey('abc-123', true), 's3/assets/abc-123.png')
  assert.equal(isS3AssetStorageKey('s3/assets/abc-123.png'), true)
  assert.equal(isS3AssetStorageKey('assets/abc-123.png'), false)
})

test('rejects unsafe asset ids before constructing storage keys', () => {
  for (const id of ['../secret', 'assets/abc.png', 'abc\\\\def', '']) {
    assert.throws(() => buildAssetStorageKey(id, true), /Invalid asset id/)
  }
})

test('does not classify path traversal keys as S3 assets', () => {
  assert.equal(isS3AssetStorageKey('s3/assets/../secret.png'), false)
  assert.equal(isS3AssetStorageKey('s3/assets/nested/abc.png'), false)
})
