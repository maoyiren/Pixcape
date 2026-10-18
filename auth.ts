import 'server-only'
import type { NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import AppleProvider from 'next-auth/providers/apple'
import EmailProvider from 'next-auth/providers/email'
import CredentialsProvider from 'next-auth/providers/credentials'
import { timingSafeEqual } from 'node:crypto'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
const providers: NextAuthOptions['providers'] = []

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
    async authorize(credentials) {
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
    async signIn({ user }) {
      if (!user.id) return false
      const record = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true } })
      return record?.status === 'ACTIVE'
    },
  },
}
