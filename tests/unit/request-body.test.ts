import test from 'node:test'
import assert from 'node:assert/strict'
import { readRequestBodyWithLimit, RequestBodyTooLargeError } from '../../lib/request-body.ts'

function streamOf(...chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
      controller.close()
    },
  })
}

test('reads a streamed request body up to the exact byte limit', async () => {
  const result = await readRequestBodyWithLimit(streamOf('1234', '5678'), 8)
  assert.equal(result.toString(), '12345678')
})

test('rejects a streamed body that exceeds the limit without Content-Length', async () => {
  await assert.rejects(
    readRequestBodyWithLimit(streamOf('1234', '5678', '9'), 8),
    (error) => error instanceof RequestBodyTooLargeError && error.maxBytes === 8,
  )
})

test('returns an empty buffer when a request has no body', async () => {
  assert.equal((await readRequestBodyWithLimit(null, 8)).length, 0)
})

test('rejects invalid body limits', async () => {
  await assert.rejects(readRequestBodyWithLimit(null, -1), RangeError)
  await assert.rejects(readRequestBodyWithLimit(null, Number.POSITIVE_INFINITY), RangeError)
})
