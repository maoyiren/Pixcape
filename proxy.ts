import { NextRequest, NextResponse } from 'next/server'
import { resolveAdminPath } from '@/lib/admin-path-core'

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const adminPath = resolveAdminPath(process.env.CDPC_ADMIN_PATH)

  // The implementation route is never publicly addressable.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
    })
  }

  if (pathname === adminPath || pathname.startsWith(`${adminPath}/`)) {
    const destination = request.nextUrl.clone()
    destination.pathname = `/admin${pathname.slice(adminPath.length)}`
    return NextResponse.rewrite(destination)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
