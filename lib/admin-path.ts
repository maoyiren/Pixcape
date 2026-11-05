import 'server-only'

const RESERVED = new Set(['admin', 'api', 'login', 'register', 'account', 'workbench', 'editor', 'ai', 'creator', 'wardrobe', 'dress-up'])

export function getAdminPath(): string {
  const raw = (process.env.CDPC_ADMIN_PATH || '/control-room').trim()
  const segment = raw.replace(/^\/+|\/+$/g, '')
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(segment) || RESERVED.has(segment.toLowerCase())) {
    return '/control-room'
  }
  return `/${segment}`
}

export function adminUrl(suffix = ''): string {
  const normalized = suffix ? (suffix.startsWith('/') ? suffix : `/${suffix}`) : ''
  return `${getAdminPath()}${normalized}`
}
