import 'server-only'
import { createHmac } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { incrementMysqlRateLimitBucket, incrementRateLimitBucket, incrementSqliteRateLimitBucket } from '@/lib/login-rate-limit-store'

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterSeconds: number
}

/** Persistent, atomic fixed-window limiter shared by all app instances. */
export async function consumeLoginRateLimit(clientAddress: string): Promise<RateLimitResult> {
  const stored = await prisma.appSetting.findMany({
    where: { key: { in: ['SECURITY_LOGIN_RATE_LIMIT_MAX', 'SECURITY_LOGIN_RATE_LIMIT_WINDOW_SECONDS'] } },
    select: { key: true, value: true },
  }).catch(() => [])
  const settings = Object.fromEntries(stored.map((item) => [item.key, item.value]))
  const limit = parsePositiveInteger(settings.SECURITY_LOGIN_RATE_LIMIT_MAX || process.env.LOGIN_RATE_LIMIT_MAX, 10, 100)
  const windowSeconds = parsePositiveInteger(settings.SECURITY_LOGIN_RATE_LIMIT_WINDOW_SECONDS || process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS, 900, 86_400)
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'pixcape-local-only-rate-limit-pepper'
  const normalizedAddress = (clientAddress || 'unknown').trim().slice(0, 128) || 'unknown'
  const key = createHmac('sha256', secret).update('pixcape-login:').update(normalizedAddress).digest('hex')
  const provider = process.env.DATABASE_PROVIDER ?? 'postgresql'
  const result = provider === 'mysql'
    ? await prisma.$transaction((tx) => incrementMysqlRateLimitBucket(tx, key, windowSeconds))
    : provider === 'sqlite'
      ? await incrementSqliteRateLimitBucket(prisma, key, windowSeconds)
      : await incrementRateLimitBucket(prisma, key, windowSeconds)

  if (result.count % 100 === 0) {
    await prisma.loginRateLimit.deleteMany({
      where: { windowStartedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, key: { not: key } },
    })
  }
  return {
    allowed: result.count <= limit,
    limit,
    remaining: Math.max(0, limit - result.count),
    retryAfterSeconds: result.retryAfterSeconds,
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}
