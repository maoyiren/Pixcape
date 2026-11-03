export class RequestBodyTooLargeError extends Error {
  readonly maxBytes: number

  constructor(maxBytes: number) {
    super(`Request body exceeds the ${maxBytes} byte limit.`)
    this.name = 'RequestBodyTooLargeError'
    this.maxBytes = maxBytes
  }
}

/**
 * Read a request body with a hard streaming limit.
 * Content-Length is not trusted: chunked/streamed requests are counted as read.
 */
export async function readRequestBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError('maxBytes must be a non-negative safe integer.')
  }
  if (!body) return Buffer.alloc(0)

  const reader = body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel('Request body limit exceeded.').catch(() => undefined)
        throw new RequestBodyTooLargeError(maxBytes)
      }
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, total)
  } catch (error) {
    await reader.cancel(error).catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
}
