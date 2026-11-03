/**
 * CDPC browser API client.
 *
 * Keep endpoint paths, HTTP behavior and response envelopes in one place so
 * AI, wardrobe, editor and dress-up share the same contracts.
 */

export class CdpcApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'CdpcApiError'
    this.status = status
    this.payload = payload
  }
}

export type ApiAsset = {
  id: string
  ownerId: string
  kind: string
  category: string
  mimeType: string
  byteSize: number
  width: number | null
  height: number | null
  source: string
  visibility: string
  attribution: string | null
  createdAt: string
  updatedAt?: string
  isFavorite?: boolean
  fileUrl: string
}

export type AssetList = { items: ApiAsset[]; nextCursor: string | null }

export type WorkspacePointer = {
  projectId: string | null
  activeTool: 'WARDROBE' | 'PIXEL_EDITOR' | 'AI_GENERATOR'
  activeAssetId: string | null
  activeOutfitId: string | null
  updatedAt?: string | null
}

export type OutfitInput = {
  name: string
  skinAssetId?: string | null
  skinModel: 'CLASSIC' | 'SLIM'
  background?: string | null
  pose?: string | null
  items: Array<{
    assetId: string
    category: Exclude<string, 'SKIN'>
    sortOrder: number
    equipped: boolean
  }>
}

export type ApiOutfit = {
  id: string
  ownerId: string
  name: string
  skinAssetId: string | null
  skinModel: 'CLASSIC' | 'SLIM'
  background: string | null
  pose: string | null
  updatedAt: string
  items: Array<{
    assetId: string
    category: string
    sortOrder: number
    equipped: boolean
    asset?: Pick<ApiAsset, 'id' | 'category' | 'kind' | 'width' | 'height'>
  }>
  skinAsset?: Pick<ApiAsset, 'id' | 'category' | 'kind' | 'width' | 'height'> | null
}

type ErrorEnvelope = { error?: string; message?: string }

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let payload: unknown = null
    try { payload = await response.json() } catch { /* non-JSON error response */ }
    const message = payload && typeof payload === 'object'
      ? (payload as ErrorEnvelope).error || (payload as ErrorEnvelope).message
      : undefined
    throw new CdpcApiError(message || `请求失败（${response.status}）`, response.status, payload)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const cdpcApi = {
  getWorkspace: async () => (await request<{ item: WorkspacePointer }>('/api/workspace')).item,

  updateWorkspace: async (pointer: WorkspacePointer) =>
    (await request<{ item: WorkspacePointer }>('/api/workspace', {
      method: 'PUT',
      body: JSON.stringify(pointer),
    })).item,

  listAssets: (options: { category?: string; limit?: number; cursor?: string; ids?: string[] } = {}) => {
    const params = new URLSearchParams()
    if (options.category) params.set('category', options.category)
    if (options.limit) params.set('limit', String(options.limit))
    if (options.cursor) params.set('cursor', options.cursor)
    if (options.ids?.length) params.set('ids', options.ids.join(','))
    const query = params.toString()
    return request<AssetList>(`/api/assets${query ? `?${query}` : ''}`)
  },

  uploadAsset: async (file: File, category: string, options: { visibility?: string; attribution?: string } = {}) => {
    const form = new FormData()
    form.set('file', file)
    form.set('category', category)
    form.set('visibility', options.visibility || 'PRIVATE')
    if (options.attribution) form.set('attribution', options.attribution)
    return (await request<{ item: ApiAsset }>('/api/assets', { method: 'POST', body: form })).item
  },

  listOutfits: async () => (await request<{ items: ApiOutfit[] }>('/api/outfits')).items,

  getOutfit: async (outfitId: string) =>
    (await request<{ item: ApiOutfit }>(`/api/outfits/${encodeURIComponent(outfitId)}`)).item,

  createOutfit: async (input: OutfitInput) =>
    (await request<{ item: ApiOutfit }>('/api/outfits', {
      method: 'POST',
      body: JSON.stringify(input),
    })).item,

  updateOutfit: async (outfitId: string, input: OutfitInput) =>
    (await request<{ item: ApiOutfit }>(`/api/outfits/${encodeURIComponent(outfitId)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })).item,

  deleteOutfit: (outfitId: string) =>
    request<{ ok: true }>(`/api/outfits/${encodeURIComponent(outfitId)}`, { method: 'DELETE' }),

  assetFileUrl: (assetId: string) => `/api/assets/${encodeURIComponent(assetId)}/file`,
}
