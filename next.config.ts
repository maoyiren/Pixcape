import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Playwright uses 127.0.0.1 for the Next.js dev server in CI.
  allowedDevOrigins: ['127.0.0.1'],
  // Next.js App Router is the only application runtime and page entry.
  poweredByHeader: false,
  reactStrictMode: true,
  typescript: { tsconfigPath: 'tsconfig.next.json' },
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]
    if (process.env.NODE_ENV === 'production') {
      // Only the current host is covered; avoid imposing HTTPS on unverified subdomains.
      securityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000' })
    }
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      { source: '/:path*', headers: securityHeaders },
    ]
  },
}

export default nextConfig
