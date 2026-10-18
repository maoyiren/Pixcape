import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const email = (url.searchParams.get('email') || '').trim().toLowerCase()
  const token = url.searchParams.get('token') || ''
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.redirect(new URL('/login?verification=invalid', url.origin))
  }
  try {
    const record = await prisma.verificationToken.findUnique({ where: { token } })
    if (!record || record.identifier !== `register:${email}` || record.expires.getTime() < Date.now()) {
      if (record) await prisma.verificationToken.deleteMany({ where: { token } })
      return NextResponse.redirect(new URL('/login?verification=expired', url.origin))
    }
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (!user) return NextResponse.redirect(new URL('/login?verification=invalid', url.origin))
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } })
      await tx.verificationToken.deleteMany({ where: { token } })
    })
    return NextResponse.redirect(new URL('/login?verification=success', url.origin))
  } catch {
    return NextResponse.redirect(new URL('/login?verification=error', url.origin))
  }
}
