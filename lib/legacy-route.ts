export type LegacySearchParams = Record<string, string | string[] | undefined>

export function legacyRedirectUrl(
  destination: string,
  searchParams: LegacySearchParams = {},
): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item)
    } else if (typeof value === 'string') {
      query.set(key, value)
    }
  }
  const suffix = query.toString()
  return suffix ? `${destination}?${suffix}` : destination
}
