const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const

/** Read PNG IHDR metadata without trusting the multipart MIME type. */
export function parsePng(bytes: Uint8Array) {
  if (bytes.byteLength < 33 || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new Error('仅支持有效的 PNG 图片。')
  }
  const header = String.fromCharCode(...bytes.subarray(12, 16))
  if (header !== 'IHDR') throw new Error('PNG 图片头无效。')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(16, false)
  const height = view.getUint32(20, false)
  if (!width || !height || width > 1024 || height > 1024) {
    throw new Error('图片尺寸必须在 1×1 至 1024×1024 之间。')
  }
  return { width, height }
}
