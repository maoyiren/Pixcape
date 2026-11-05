import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('缺少 AUTH_SECRET / NEXTAUTH_SECRET，无法安全保存系统凭据')
  return createHash('sha256').update(secret).digest()
}

export function encryptSecretSetting(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptSecretSetting(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const [ivText, tagText, encryptedText] = value.split('.')
    if (!ivText || !tagText || !encryptedText) return undefined
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8')
  } catch { return undefined }
}
