import 'server-only'
import type { NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import AppleProvider from 'next-auth/providers/apple'
import EmailProvider from 'next-auth/providers/email'
import CredentialsProvider from 'next-auth/providers/credentials'
import { timingSafeEqual, scryptSync } from 'node:crypto'
import { decryptSecretSetting } from '@/lib/secret-settings'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { consumeLoginRateLimit } from '@/lib/login-rate-limit'

const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
async function buildProviders(): Promise<NextAuthOptions['providers']> {
const providers: NextAuthOptions['providers'] = []
const stored = await prisma.appSetting.findMany({
  where: { key: { in: [
    'AUTH_OAUTH_GITHUB_CLIENT_ID','AUTH_SECRET_OAUTH_GITHUB_CLIENT_SECRET','AUTH_OAUTH_GITHUB_DISABLED',
    'AUTH_OAUTH_GOOGLE_CLIENT_ID','AUTH_SECRET_OAUTH_GOOGLE_CLIENT_SECRET','AUTH_OAUTH_GOOGLE_DISABLED',
    'AUTH_OAUTH_MICROSOFT_CLIENT_ID','AUTH_SECRET_OAUTH_MICROSOFT_CLIENT_SECRET','AUTH_OAUTH_MICROSOFT_TENANT_ID','AUTH_OAUTH_MICROSOFT_DISABLED',
    'AUTH_OAUTH_APPLE_CLIENT_ID','AUTH_SECRET_OAUTH_APPLE_CLIENT_SECRET','AUTH_OAUTH_APPLE_DISABLED',
    'MAIL_SMTP_HOST','MAIL_SMTP_PORT','MAIL_SMTP_USER','MAIL_SECRET_SMTP_PASSWORD','MAIL_FROM','MAIL_SMTP_SECURE',
  ] } },
  select: { key: true, value: true },
}).catch(() => [])
const config = Object.fromEntries(stored.map((item) => [item.key, item.value]))
type OAuthCredentials = { clientId: string; clientSecret: string }
const credential = (provider: string, envId?: string, envSecret?: string): Partial<OAuthCredentials> => config['AUTH_OAUTH_' + provider + '_DISABLED'] === 'true' ? {} : ({
  clientId: config['AUTH_OAUTH_' + provider + '_CLIENT_ID'] || (envId ? process.env[envId] : undefined),
  clientSecret: decryptSecretSetting(config['AUTH_SECRET_OAUTH_' + provider + '_CLIENT_SECRET']) || (envSecret ? process.env[envSecret] : undefined),
})

async function allowCredentialAttempt(request: { headers?: unknown }): Promise<boolean> {
  const configuredHeader = (process.env.LOGIN_RATE_LIMIT_IP_HEADER || 'x-real-ip').toLowerCase()
  const headers = (request.headers ?? {}) as Record<string, string | string[] | undefined>
  const raw = headers[configuredHeader]
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
      // Never mutate a suspended/deleted account while attempting emergency sign-in.
      // Check status inside the same transaction as the role update to avoid a stale
      // preflight check granting ADMIN after another request suspends the account.
      const user = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { email },
          select: { id: true, status: true },
        })
        if (existing) {
          if (existing.status !== 'ACTIVE') return null
          const updated = await tx.user.updateMany({
            where: { id: existing.id, status: 'ACTIVE' },
            data: { role: 'ADMIN' },
          })
          if (updated.count !== 1) return null
          return tx.user.findUnique({
            where: { id: existing.id },
            select: { id: true, email: true, name: true, role: true, status: true },
          })
        }
        return tx.user.create({
          data: { email, name: username, role: 'ADMIN', status: 'ACTIVE' },
          select: { id: true, email: true, name: true, role: true, status: true },
        })
      })
      if (!user || user.status !== 'ACTIVE') return null
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

function completeOAuthCredentials(value: { clientId?: string; clientSecret?: string }): OAuthCredentials | undefined {
  if (!value.clientId || !value.clientSecret) return undefined
  return { clientId: value.clientId, clientSecret: value.clientSecret }
}
const github = completeOAuthCredentials(credential('GITHUB', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET'))
if (github) providers.push(GitHubProvider(github))
const google = completeOAuthCredentials(credential('GOOGLE', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'))
if (google) providers.push(GoogleProvider(google))
const microsoft = completeOAuthCredentials(credential('MICROSOFT', 'AUTH_MICROSOFT_ENTRA_ID_ID', 'AUTH_MICROSOFT_ENTRA_ID_SECRET'))
if (microsoft) providers.push(AzureADProvider({ ...microsoft, tenantId: config.AUTH_OAUTH_MICROSOFT_TENANT_ID || process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID || 'common' }))
const apple = completeOAuthCredentials(credential('APPLE', 'AUTH_APPLE_ID', 'AUTH_APPLE_SECRET'))
if (apple) providers.push(AppleProvider(apple))
const smtpPassword = decryptSecretSetting(config.MAIL_SECRET_SMTP_PASSWORD)
const smtpHost = config.MAIL_SMTP_HOST
const smtpFrom = config.MAIL_FROM || process.env.EMAIL_FROM
if ((smtpHost && smtpFrom && smtpPassword) || (process.env.EMAIL_SERVER && process.env.EMAIL_FROM)) {
  const server = smtpHost && smtpPassword
    ? { host: smtpHost, port: Number(config.MAIL_SMTP_PORT || 587), secure: config.MAIL_SMTP_SECURE === 'true', auth: { user: config.MAIL_SMTP_USER || '', pass: smtpPassword } }
    : process.env.EMAIL_SERVER!
  providers.push(EmailProvider({ server, from: smtpFrom || process.env.EMAIL_FROM!, maxAge: 15 * 60 }))
}
return providers
}

const authOptionsBase: Omit<NextAuthOptions, 'providers'> = {
  adapter: PrismaAdapter(prisma as never),
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
        const status = typeof record?.status === 'string' ? record.status.trim().toUpperCase() : ''
        if (!record || status !== 'ACTIVE') {
          token.authDisabled = true
        } else {
          token.role = record.role
          token.status = 'ACTIVE'
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
      if (!user.id) {
        console.warn('[auth] signIn denied: adapter returned no user id')
        return false
      }
      const record = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true, email: true } })
      const status = typeof record?.status === 'string' ? record.status.trim().toUpperCase() : ''
      if (!record || status !== 'ACTIVE') {
        console.warn('[auth] signIn denied: user record missing or status is not ACTIVE')
        return false
      }
      // Every authenticated account can create immediately. Keep ADMIN privileged, but
      // promote legacy USER accounts to CREATOR and ensure profile creation is idempotent.
      await prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, email: true, role: true } })
        if (!current) throw new Error('Authenticated user disappeared')
        if (current.role === 'USER') {
          await tx.user.update({ where: { id: current.id }, data: { role: 'CREATOR' } })
        }
        await tx.creatorProfile.upsert({
          where: { userId: current.id },
          update: {},
          create: { userId: current.id, displayName: (current.name || current.email?.split('@')[0] || 'CDPC 创作者').slice(0, 48), bio: '', reviewStatus: 'NOT_SUBMITTED' },
        })
        if (account?.provider === 'email' && current.email) {
          await tx.user.update({ where: { id: current.id }, data: { emailVerified: new Date() } })
        }
      })
      return true
    },
  },
}

export async function getAuthOptions(): Promise<NextAuthOptions> {
  return { ...authOptionsBase, providers: await buildProviders() }
}

// Compatibility options for legacy getServerSession(authOptions) call sites.
// OAuth callback initialization always uses getAuthOptions() in the NextAuth handler;
// this provider-less object shares the same JWT/session callbacks and adapter.
export const authOptions = authOptionsBase as NextAuthOptions
