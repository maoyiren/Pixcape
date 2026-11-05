import 'server-only'
import { resolveAdminPath } from '@/lib/admin-path-core'

export function getAdminPath(): string {
  return resolveAdminPath(process.env.CDPC_ADMIN_PATH)
}

export function adminUrl(suffix = ''): string {
  const normalized = suffix ? (suffix.startsWith('/') ? suffix : `/${suffix}`) : ''
  return `${getAdminPath()}${normalized}`
}
