import { z } from 'zod'

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'api', 'account', 'accounts', 'auth', 'login',
  'logout', 'register', 'settings', 'setup', 'support', 'help', 'about',
  'studio', 'editor', 'ai', 'creator', 'creators', 'u', 'user', 'users',
  'assets', 'asset', 'skin', 'skins', 'outfit', 'outfits', 'wardrobe',
  'favorites', 'creations', 'workbench', 'public', 'static', 'cdn',
])

export const UsernameSchema = z.string()
  .trim()
  .toLowerCase()
  .min(3, '用户名至少需要 3 个字符')
  .max(24, '用户名不能超过 24 个字符')
  .regex(/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/, '用户名仅支持小写字母、数字、下划线和连字符，且首尾必须是字母或数字')
  .refine(value => !RESERVED_USERNAMES.has(value), '该用户名为系统保留名称')

export type Username = z.infer<typeof UsernameSchema>

export function normalizeUsername(value: unknown): Username | null {
  const parsed = UsernameSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
