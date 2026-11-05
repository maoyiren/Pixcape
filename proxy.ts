import { NextRequest, NextResponse } from 'next/server'

const RESERVED = new Set(['admin', 'api', 'login', 'register', 'account', 'workbench', 'editor', 'ai', 'creator', 'wardrobe', 'dress-up'])

function configuredAdminPath(): string {
  const raw = (process.env.CDPC_ADMIN_PATH || '/control-room').trim()
  const segment = raw.replace(/^\/+|\/+$/g, '')
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(segment) || RESERVED.has(segment.toLowerCase())) return '/control-room'
  return `/${segment}`
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const adminPath = configuredAdminPath()

  // Never expose the implementation route, even when the custom path is unset.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
    })
  }

  if (pathname === adminPath || pathname.startsWith(`${adminPath}/`)) {
    const suffix = pathname.slice(adminPath.length)
    const destination = request.nextUrl.clone()
    destination.pathname = `/admin${suffix}`
    return NextResponse.rewrite(destination, {
      request: { headers: new Headers(request.headers) },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
