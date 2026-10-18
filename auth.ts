import 'server-only'
import type { NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import AppleProvider from 'next-auth/providers/apple'
import EmailProvider from 'next-auth/providers/email'
import CredentialsProvider from 'next-auth/providers/credentials'
import { timingSafeEqual, scryptSync } from 'node:crypto'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { consumeLoginRateLimit } from '@/lib/login-rate-limit'

const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
const providers: NextAuthOptions['providers'] = []

async function allowCredentialAttempt(request: { headers: Record<string, string | string[] | undefined> }): Promise<boolean> {
  const configuredHeader = (process.env.LOGIN_RATE_LIMIT_IP_HEADER || 'x-real-ip').toLowerCase()
  const raw = request.headers[configuredHeader]
  const address = Array.isArray(raw) ? raw[0] : raw
  try {
    const result = await consumeLoginRateLimit(address || 'unknown')
    return result.allowed
  } catch {
    // Fail closed when the persistent rate-limit store is unavailable.
    return false
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Environment-based emergency/admin sign-in. All three values are required.
// Never expose these values to the browser or store the password in the database.
if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_EMAIL) {
  providers.push(CredentialsProvider({
    id: 'admin-credentials',
    name: '管理员账号',
    credentials: {
      username: { label: '管理员用户名', type: 'text' },
      password: { label: '管理员密码', type: 'password' },
    },
    async authorize(credentials, request) {
      if (!await allowCredentialAttempt(request)) return null
      const username = credentials?.username ?? ''
      const password = credentials?.password ?? ''
      if (!safeEqual(username, process.env.ADMIN_USERNAME!) || !safeEqual(password, process.env.ADMIN_PASSWORD!)) return null
      const email = process.env.ADMIN_EMAIL!.trim().toLowerCase()
      if (!email) return null
      const user = await prisma.user.upsert({
        where: { email },
        update: { role: 'ADMIN' },
        create: { email, name: username, role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true, email: true, name: true, role: true, status: true },
      })
      if (user.status !== 'ACTIVE') return null
      return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status }
    },
  }))
}


providers.push(CredentialsProvider({
  id: 'email-password',
  name: '邮箱和密码',
  credentials: {
    email: { label: '邮箱', type: 'email' },
    password: { label: '密码', type: 'password' },
  },
  async authorize(credentials, request) {
    if (!await allowCredentialAttempt(request)) return null
    const email = credentials?.email?.trim().toLowerCase()
    const password = credentials?.password ?? ''
    if (!email || !password || password.length > 256) return null
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, passwordHash: true, role: true, status: true, emailVerified: true } })
    if (!user?.passwordHash || user.status !== 'ACTIVE') return null
    const verificationSetting = await prisma.appSetting.findUnique({ where: { key: 'EMAIL_VERIFICATION_REQUIRED' } })
    if (verificationSetting?.value === 'true' && !user.emailVerified) return null
    const [salt, stored] = user.passwordHash.split(':')
    if (!salt || !stored) return null
    try {
      const expected = Buffer.from(stored, 'hex')
      const actual = scryptSync(password, salt, expected.length)
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
    } catch { return null }
    return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status }
  },
}))

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHubProvider({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET }))
}
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(GoogleProvider({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }))
}
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  providers.push(AzureADProvider({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    tenantId: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID || 'common',
  }))
}
if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(AppleProvider({ clientId: process.env.AUTH_APPLE_ID, clientSecret: process.env.AUTH_APPLE_SECRET }))
}
if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
  providers.push(EmailProvider({
    server: process.env.EMAIL_SERVER,
    from: process.env.EMAIL_FROM,
    maxAge: 15 * 60,
  }))
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as never),
  providers,
  secret: authSecret,
  // Credentials providers require JWT sessions. Role/status are reloaded from DB below.
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60, updateAge: 60 * 60 },
  useSecureCookies: process.env.NODE_ENV === 'production',
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      if (token.sub) {
        const record = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, status: true, email: true, name: true },
        })
        if (!record || record.status !== 'ACTIVE') {
          token.authDisabled = true
        } else {
          token.role = record.role
          token.status = record.status
          token.email = record.email ?? token.email
          token.name = record.name ?? token.name
          token.authDisabled = false
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub && !token.authDisabled) {
        session.user.id = token.sub
        session.user.role = token.role as typeof session.user.role
        session.user.status = token.status as typeof session.user.status
      } else if (session.user && token.authDisabled) {
        session.user.id = ''
      }
      return session
    },
    async signIn({ user, account }) {
      if (!user.id) return false
      const record = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true, email: true } })
      if (record?.status !== 'ACTIVE') return false
      if (account?.provider === 'email' && record.email) {
        await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } })
      }
      return true
    },
  },
}
