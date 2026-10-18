import { NextResponse } from 'next/server'
import { scryptSync, randomBytes } from 'node:crypto'
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
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return NextResponse.json({ error: '该邮箱已注册，请直接登录。' }, { status: 409 })
    const salt = randomBytes(16).toString('hex')
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
    await prisma.user.create({
      data: { email, name: name || email.split('@')[0], passwordHash, role: 'USER', status: 'ACTIVE' },
      select: { id: true },
    })
    return NextResponse.json({ ok: true, message: '注册成功，请使用邮箱和密码登录。' }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '注册失败，请稍后重试。' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
