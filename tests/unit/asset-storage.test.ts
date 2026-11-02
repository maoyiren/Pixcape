import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile, unlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { deleteStoredAsset } from '../../lib/asset-storage.ts'

async function withAssetFile(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cdpc-asset-storage-'))
  const filePath = path.join(directory, 'asset.png')
  const original = Buffer.from('png-data')
  await writeFile(filePath, original)
  try { await run({ directory, filePath, original }) }
  finally { await rm(directory, { recursive: true, force: true }) }
}

test('deletes the file before the database row', async () => withAssetFile(async ({ filePath }) => {
  const order = []
  const result = await deleteStoredAsset(filePath, async () => { order.push('database'); return 1 }, {
    readFile,
    unlink: async (file) => { order.push('file'); await unlink(file) },
    writeFile,
  })
  assert.equal(result, true)
  assert.deepEqual(order, ['file', 'database'])
  await assert.rejects(readFile(filePath), { code: 'ENOENT' })
}))

test('restores the file if the database deletion fails', async () => withAssetFile(async ({ filePath, original }) => {
  await assert.rejects(deleteStoredAsset(filePath, async () => { throw new Error('database unavailable') }), /database unavailable/)
  assert.deepEqual(await readFile(filePath), original)
}))

test('restores the file if the database reports no deleted row', async () => withAssetFile(async ({ filePath, original }) => {
  assert.equal(await deleteStoredAsset(filePath, async () => 0), false)
  assert.deepEqual(await readFile(filePath), original)
}))

test('surfaces both database and file restoration failures', async () => withAssetFile(async ({ filePath }) => {
  const databaseError = new Error('database unavailable')
  const restoreError = new Error('disk is read-only')
  await assert.rejects(deleteStoredAsset(filePath, async () => { throw databaseError }, {
    readFile,
    unlink,
    writeFile: async () => { throw restoreError },
  }), (error) => {
    assert.ok(error instanceof AggregateError)
    assert.equal(error.errors[0], databaseError)
    assert.equal(error.errors[1], restoreError)
    return true
  })
}))
