import NextAuth from 'next-auth'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getAuthOptions } from '@/auth'
import { consumeLoginRateLimit } from '@/lib/login-rate-limit'

// Provider credentials are loaded from the encrypted settings store on every auth request.

export default async function authHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ error: 'Authentication is not configured on this deployment.' })
    return
  }

  const path = (req.url || '').split('?')[0]
  const isSensitiveAuthEndpoint = /^\/api\/auth\/(?:signin(?:\/|$)|callback\/)/.test(path)
  if (isSensitiveAuthEndpoint) {
    // Only trust this header behind a reverse proxy that overwrites it.
    const ipHeader = (process.env.LOGIN_RATE_LIMIT_IP_HEADER || 'x-real-ip').toLowerCase()
    const rawAddress = req.headers[ipHeader]
    const clientAddress = (Array.isArray(rawAddress) ? rawAddress[0] : rawAddress) || 'unknown'
    try {
      const result = await consumeLoginRateLimit(clientAddress)
      if (!result.allowed) {
        res.setHeader('Retry-After', String(result.retryAfterSeconds))
        res.setHeader('Cache-Control', 'no-store')
        res.status(429).json({ error: 'Too many login attempts. Please wait before trying again.' })
        return
      }
    } catch {
      // Fail closed if the persistent limiter cannot be consulted.
      res.setHeader('Retry-After', '30')
      res.setHeader('Cache-Control', 'no-store')
      res.status(503).json({ error: 'Authentication is temporarily unavailable. Please try again shortly.' })
      return
    }
  }

  await NextAuth(await getAuthOptions())(req, res)
}
