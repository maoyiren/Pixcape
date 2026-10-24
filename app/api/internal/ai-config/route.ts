import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function decryptAISecret(value: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('AI secret encryption key is unavailable')
  const [ivText, tagText, encryptedText] = value.split('.')
  if (!ivText || !tagText || !encryptedText) throw new Error('Invalid encrypted AI secret')
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), Buffer.from(ivText, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8')
}

export async function GET(request: Request) {
  const expected = process.env.AI_CONFIG_SYNC_TOKEN
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!expected || !supplied) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const expectedBytes = Buffer.from(expected)
  const suppliedBytes = Buffer.from(supplied)
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const entries = await prisma.appSetting.findMany({
    where: { key: { in: [
      'AI_DEFAULT_PROVIDER', 'AI_DEFAULT_MODEL', 'GEMINI_IMAGE_MODELS', 'OPENAI_IMAGE_MODELS',
      'OPENROUTER_IMAGE_MODELS', 'SEEDREAM_IMAGE_MODELS', 'ARK_BASE_URL',
      'AI_SECRET_GEMINI_API_KEY', 'AI_SECRET_OPENAI_API_KEY', 'AI_SECRET_OPENROUTER_API_KEY', 'AI_SECRET_ARK_API_KEY',
    ] } },
  })
  const values = Object.fromEntries(entries.map((entry) => [entry.key, entry.value]))
  const env: Record<string, string> = {}
  const mappings: Record<string, string> = {
    AI_DEFAULT_PROVIDER: 'AI_DEFAULT_PROVIDER', AI_DEFAULT_MODEL: 'AI_DEFAULT_MODEL',
    GEMINI_IMAGE_MODELS: 'GEMINI_IMAGE_MODELS', OPENAI_IMAGE_MODELS: 'OPENAI_IMAGE_MODELS',
    OPENROUTER_IMAGE_MODELS: 'OPENROUTER_IMAGE_MODELS', SEEDREAM_IMAGE_MODELS: 'SEEDREAM_IMAGE_MODELS',
    ARK_BASE_URL: 'ARK_BASE_URL',
  }
  for (const [settingKey, envKey] of Object.entries(mappings)) {
    if (typeof values[settingKey] === 'string') env[envKey] = values[settingKey]
  }
  const secretMappings: Record<string, string> = {
    AI_SECRET_GEMINI_API_KEY: 'GEMINI_API_KEY', AI_SECRET_OPENAI_API_KEY: 'OPENAI_API_KEY',
    AI_SECRET_OPENROUTER_API_KEY: 'OPENROUTER_API_KEY', AI_SECRET_ARK_API_KEY: 'ARK_API_KEY',
  }
  try {
    for (const [settingKey, envKey] of Object.entries(secretMappings)) {
      const value = values[settingKey]
      if (typeof value === 'string') env[envKey] = value ? decryptAISecret(value) : ''
    }
  } catch {
    return NextResponse.json({ error: 'Stored AI configuration cannot be decrypted' }, { status: 503 })
  }
  return NextResponse.json({ env }, { headers: { 'Cache-Control': 'no-store' } })
}
