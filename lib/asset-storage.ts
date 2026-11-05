import { readFile, unlink, writeFile } from 'node:fs/promises'

type Storage = {
  readFile: (path: string) => Promise<Buffer>
  unlink: (path: string) => Promise<void>
  writeFile: (path: string, data: Uint8Array, options?: { flag?: string; mode?: number }) => Promise<void>
}

export async function deleteStoredAsset(
  filePath: string,
  deleteRecord: () => Promise<number>,
  storage: Storage = { readFile, unlink, writeFile },
): Promise<boolean> {
  let backup: Buffer | null = null
  try {
    backup = await storage.readFile(filePath)
    await storage.unlink(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  let deletedCount: number
  try {
    deletedCount = await deleteRecord()
  } catch (databaseError) {
    if (backup) {
      try {
        await storage.writeFile(filePath, backup, { flag: 'wx', mode: 0o600 })
      } catch (restoreError) {
        throw new AggregateError([databaseError, restoreError], 'Asset deletion and file restoration both failed.')
      }
    }
    throw databaseError
  }

  if (deletedCount !== 1) {
    if (backup) await storage.writeFile(filePath, backup, { flag: 'wx', mode: 0o600 })
    return false
  }
  return true
}

/** Preserve both failures when a failed DB insert cannot clean up its uploaded file. */
export async function cleanupUploadedAssetAfterCreateFailure(
  filePath: string,
  databaseError: unknown,
  removeFile: (path: string) => Promise<void> = unlink,
): Promise<never> {
  try {
    await removeFile(filePath)
  } catch (cleanupError) {
    throw new AggregateError(
      [databaseError, cleanupError],
      'Asset record creation failed and uploaded file cleanup also failed.',
    )
  }
  throw databaseError
}
