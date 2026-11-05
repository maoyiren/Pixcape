const RESERVED_ADMIN_SEGMENTS = new Set(['admin', 'api', 'login', 'register', 'account', 'workbench', 'editor', 'ai', 'creator', 'wardrobe', 'dress-up'])

export function resolveAdminPath(raw: string | undefined): string {
  const segment = (raw || '/control-room').trim().replace(/^\/+|\/+$/g, '')
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(segment) || RESERVED_ADMIN_SEGMENTS.has(segment.toLowerCase())) return '/control-room'
  return `/${segment}`
}
