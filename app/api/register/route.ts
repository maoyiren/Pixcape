import { NextResponse } from 'next/server'
import { scryptSync, randomBytes } from 'node:crypto'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { consumeLoginRateLimit } from '@/lib/login-rate-limit'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const ipHeader = (process.env.LOGIN_RATE_LIMIT_IP_HEADER || 'x-real-ip').toLowerCase()
  const forwarded = request.headers.get(ipHeader) || 'unknown'
  try {
    const limit = await consumeLoginRateLimit(forwarded)
    if (!limit.allowed) return NextResponse.json({ error: '尝试次数过多，请稍后再试。' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds), 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '认证服务暂时不可用，请稍后重试。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  let body: { email?: unknown; password?: unknown; name?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: '请求格式无效。' }, { status: 400 }) }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: '请输入有效的邮箱地址。' }, { status: 400 })
  }
  if (password.length < 10 || password.length > 256) {
    return NextResponse.json({ error: '密码长度必须为 10 至 256 个字符。' }, { status: 400 })
  }
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'EMAIL_VERIFICATION_REQUIRED' } })
    const requireVerification = setting?.value === 'true'
    if (requireVerification && (!process.env.EMAIL_SERVER || !process.env.EMAIL_FROM || !process.env.NEXTAUTH_URL)) {
      return NextResponse.json({ error: '邮箱验证已开启，但 SMTP 或站点地址未配置。请联系管理员。' }, { status: 503 })
    }
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return NextResponse.json({ error: '该邮箱已注册，请直接登录。' }, { status: 409 })
    const salt = randomBytes(16).toString('hex')
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: name || email.split('@')[0], passwordHash, role: 'CREATOR', status: 'ACTIVE', ...(requireVerification ? {} : { emailVerified: null }) },
        select: { id: true, name: true, email: true },
      })
      await tx.creatorProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, displayName: (user.name || user.email?.split('@')[0] || 'CDPC 创作者').slice(0, 48), bio: '', reviewStatus: 'NOT_SUBMITTED' },
      })
    })
    if (requireVerification) {
      const token = randomBytes(32).toString('hex')
      const identifier = `register:${email}`
      const expires = new Date(Date.now() + 30 * 60 * 1000)
      await prisma.verificationToken.deleteMany({ where: { identifier } })
      await prisma.verificationToken.create({ data: { identifier, token, expires } })
      const verifyUrl = new URL('/api/register/verify', process.env.NEXTAUTH_URL)
      verifyUrl.searchParams.set('email', email)
      verifyUrl.searchParams.set('token', token)
      try {
        const transport = nodemailer.createTransport(process.env.EMAIL_SERVER!)
        await transport.sendMail({
          from: process.env.EMAIL_FROM,
          to: email,
          subject: '验证你的 CDPC 邮箱',
          text: `请在 30 分钟内打开此链接验证邮箱：${verifyUrl.toString()}`,
          html: `<p>请在 30 分钟内点击下方链接验证邮箱。</p><p><a href="${verifyUrl.toString()}">验证邮箱</a></p>`,
        })
      } catch {
        await prisma.verificationToken.deleteMany({ where: { identifier } })
        await prisma.user.deleteMany({ where: { email, passwordHash } })
        return NextResponse.json({ error: '验证邮件发送失败，请联系管理员检查 SMTP 配置。' }, { status: 503 })
      }
      return NextResponse.json({ ok: true, message: '注册已提交，请查收验证邮件。验证链接 30 分钟后过期。' }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ ok: true, message: '注册成功，请使用邮箱和密码登录。' }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '注册失败，请稍后重试。' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
