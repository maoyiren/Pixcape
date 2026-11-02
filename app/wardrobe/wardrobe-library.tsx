'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Category = 'SKIN' | 'SHAWL' | 'COAT' | 'CAPE' | 'HAT' | 'PANTS' | 'SHOES' | 'OTHER_ACCESSORY'
type Asset = {
  id: string
  category: Category | null
  kind: string
  width: number | null
  height: number | null
  attribution: string | null
  fileUrl: string
  createdAt: string
  isFavorite: boolean
}
type Outfit = { id: string; name: string; items: Array<{ assetId: string }> }
type Filter = 'ALL' | 'FAVORITES' | 'OUTFITS' | Category

const categories: Array<{ value: Category; label: string }> = [
  { value: 'SKIN', label: '皮肤' },
  { value: 'SHAWL', label: '披肩' },
  { value: 'COAT', label: '外套' },
  { value: 'CAPE', label: '披风' },
  { value: 'HAT', label: '帽子' },
  { value: 'PANTS', label: '裤子' },
  { value: 'SHOES', label: '鞋子' },
  { value: 'OTHER_ACCESSORY', label: '其他配饰' },
]

const categoryLabel = (value: Category | null) =>
  categories.find((item) => item.value === value)?.label ?? '未分类'

export default function WardrobeLibrary() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('正在加载你的收藏库…')
  const [uploadCategory, setUploadCategory] = useState<Category>('SKIN')
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    const [assetResponse, outfitResponse] = await Promise.all([
      fetch('/api/assets?limit=60', { cache: 'no-store' }),
      fetch('/api/outfits', { cache: 'no-store' }),
    ])
    if (assetResponse.status === 401 || outfitResponse.status === 401) {
      setNotice('登录后即可管理你的私人素材与穿搭')
      return
    }
    if (!assetResponse.ok || !outfitResponse.ok) throw new Error('读取衣橱失败，请稍后重试')
    const [assetData, outfitData] = await Promise.all([assetResponse.json(), outfitResponse.json()])
    setAssets(Array.isArray(assetData.items) ? assetData.items : [])
    setNextCursor(typeof assetData.nextCursor === 'string' ? assetData.nextCursor : null)
    setOutfits(Array.isArray(outfitData.items) ? outfitData.items : [])
    setNotice('你的素材已同步到云端')
  }, [])

  useEffect(() => {
    void reload().catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
  }, [reload])

  const counts = useMemo(() => {
    const result: Record<string, number> = {
      ALL: assets.length,
      FAVORITES: assets.filter((item) => item.isFavorite).length,
      OUTFITS: outfits.length,
    }
    for (const item of categories) result[item.value] = assets.filter((asset) => asset.category === item.value).length
    return result
  }, [assets, outfits])

  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return assets.filter((asset) => {
      const matchesFilter = filter === 'ALL' || filter === 'FAVORITES'
        ? filter === 'ALL' || asset.isFavorite
        : filter === 'OUTFITS' ? false : asset.category === filter
      const matchesQuery = !normalized || categoryLabel(asset.category).toLowerCase().includes(normalized)
        || (asset.attribution || '').toLowerCase().includes(normalized)
        || asset.id.toLowerCase().includes(normalized)
      return matchesFilter && matchesQuery
    })
  }, [assets, filter, query])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setError('')
    try {
      const response = await fetch('/api/assets?limit=60&cursor=' + encodeURIComponent(nextCursor), { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '加载更多素材失败')
      const page = Array.isArray(data.items) ? data.items as Asset[] : []
      setAssets((current) => {
        const merged = new Map(current.map((asset) => [asset.id, asset]))
        for (const asset of page) merged.set(asset.id, asset)
        return [...merged.values()]
      })
      setNextCursor(typeof data.nextCursor === 'string' ? data.nextCursor : null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载更多素材失败')
    } finally {
      setLoadingMore(false)
    }
  }
  const toggleFavorite = async (asset: Asset) => {
    setError('')
    try {
      const response = await fetch(`/api/assets/${asset.id}/favorite`, { method: asset.isFavorite ? 'DELETE' : 'PUT' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '更新收藏失败')
      setAssets((current) => current.map((item) => item.id === asset.id ? { ...item, isFavorite: Boolean(data.favorited) } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新收藏失败')
    }
  }

  const upload = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('category', uploadCategory)
      form.set('visibility', 'PRIVATE')
      const response = await fetch('/api/assets', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '上传失败')
      await reload()
      setFilter(uploadCategory)
      setNotice('素材已上传并保存到私人衣橱')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '上传失败')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <main className="cdpc-library">
      <style jsx>{`
        .cdpc-library{max-width:1440px;margin:0 auto;padding:34px 28px 64px;color:var(--mantine-color-text,#e8edf5)}
        .library-head{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:26px;flex-wrap:wrap}
        .eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mantine-color-dimmed,#94a3b8);margin:0 0 8px}
        h1{font-size:clamp(27px,3vw,36px);line-height:1.15;margin:0 0 8px;font-weight:750}
        .subtitle{margin:0;color:var(--mantine-color-dimmed,#94a3b8);font-size:14px}
        .head-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .action{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--mantine-color-default-border,#334155);border-radius:10px;padding:10px 14px;color:inherit;text-decoration:none;background:var(--mantine-color-body,#111827);font-size:14px;font-weight:600;cursor:pointer}
        .action.primary{background:#2563eb;border-color:#2563eb;color:white}
        .library-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px;align-items:start}
        .sidebar{border:1px solid var(--mantine-color-default-border,#334155);border-radius:14px;padding:12px;background:var(--mantine-color-body,#111827)}
        .side-title{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--mantine-color-dimmed,#94a3b8);padding:10px 10px 8px;text-transform:uppercase}
        .side-item{width:100%;display:flex;align-items:center;justify-content:space-between;border:0;border-radius:8px;padding:10px;color:inherit;background:transparent;text-align:left;cursor:pointer;font:inherit;font-size:14px}
        .side-item:hover{background:rgba(148,163,184,.09)}
        .side-item.active{background:rgba(59,130,246,.15);color:#93c5fd;font-weight:650}
        .count{font-size:12px;color:var(--mantine-color-dimmed,#94a3b8);font-variant-numeric:tabular-nums}
        .side-divider{height:1px;background:var(--mantine-color-default-border,#334155);margin:9px 4px}
        .content{min-width:0}
        .content-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:18px}
        .content-title{font-size:19px;font-weight:700;margin:0}
        .tools{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
        .search{width:min(280px,65vw);border:1px solid var(--mantine-color-default-border,#475569);border-radius:9px;padding:10px 12px;background:var(--mantine-color-body,#111827);color:inherit;font:inherit;font-size:14px}
        .upload-select{border:1px solid var(--mantine-color-default-border,#475569);border-radius:9px;padding:9px;background:var(--mantine-color-body,#111827);color:inherit;font:inherit}
        .asset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
        .asset-card{min-width:0;border:1px solid var(--mantine-color-default-border,#334155);border-radius:12px;overflow:hidden;background:var(--mantine-color-body,#111827);transition:border-color .15s,transform .15s}
        .asset-card:hover{border-color:#64748b;transform:translateY(-2px)}
        .thumb{height:158px;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#111827,#1e293b);padding:16px}
        .thumb img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}
        .asset-meta{padding:11px 12px 12px}
        .asset-category{font-size:11px;color:#93c5fd;margin-bottom:5px}
        .asset-name{font-size:13px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .asset-bottom{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px}
        .asset-date{font-size:11px;color:var(--mantine-color-dimmed,#94a3b8)}
        .favorite{border:0;background:transparent;color:inherit;font-size:18px;cursor:pointer;padding:2px 5px}
        .empty{border:1px dashed var(--mantine-color-default-border,#475569);border-radius:13px;padding:48px 18px;text-align:center;color:var(--mantine-color-dimmed,#94a3b8)}
        .empty strong{display:block;color:inherit;margin-bottom:8px}
        .notice{font-size:12px;color:var(--mantine-color-dimmed,#94a3b8);margin-top:18px}
        .error{color:#f87171;font-size:13px;margin:12px 0}
        .outfit-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
        .outfit-card{border:1px solid var(--mantine-color-default-border,#334155);border-radius:12px;padding:16px;background:var(--mantine-color-body,#111827)}
        .outfit-card strong{display:block;margin-bottom:8px}
        @media(max-width:760px){.cdpc-library{padding:24px 16px 44px}.library-layout{grid-template-columns:1fr;gap:14px}.sidebar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px}.side-title{grid-column:1/-1}.side-divider{display:none}.side-item{padding:9px 8px;font-size:13px}.asset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.thumb{height:138px}}
      `}</style>

      <header className="library-head">
        <div>
          <p className="eyebrow">CDPC · MY COLLECTION</p>
          <h1>我的衣橱</h1>
          <p className="subtitle">集中管理你的 Minecraft 皮肤、服装素材与收藏。</p>
        </div>
        <div className="head-actions">
          <select className="upload-select" aria-label="上传素材类型" value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value as Category)}>
            {categories.map((item) => <option key={item.value} value={item.value}>上传：{item.label}</option>)}
          </select>
          <button className="action primary" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? '上传中…' : '＋ 上传素材'}</button>
          <input ref={fileRef} type="file" accept="image/png" hidden disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} />
          <Link className="action" href="/dress-up">进入 3D 换装</Link>
        </div>
      </header>

      <div className="library-layout">
        <aside className="sidebar" aria-label="衣橱分类">
          <div className="side-title">我的收藏库</div>
          <button className={filter === 'ALL' ? 'side-item active' : 'side-item'} onClick={() => setFilter('ALL')}><span>全部素材</span><span className="count">{counts.ALL}</span></button>
          <button className={filter === 'FAVORITES' ? 'side-item active' : 'side-item'} onClick={() => setFilter('FAVORITES')}><span>我的收藏</span><span className="count">{counts.FAVORITES}</span></button>
          <button className={filter === 'OUTFITS' ? 'side-item active' : 'side-item'} onClick={() => setFilter('OUTFITS')}><span>我的穿搭</span><span className="count">{counts.OUTFITS}</span></button>
          <div className="side-divider" />
          <div className="side-title">按类型浏览</div>
          {categories.map((item) => <button key={item.value} className={filter === item.value ? 'side-item active' : 'side-item'} onClick={() => setFilter(item.value)}><span>{item.label}</span><span className="count">{counts[item.value]}</span></button>)}
        </aside>

        <section className="content">
          <div className="content-head">
            <h2 className="content-title">{filter === 'ALL' ? '全部素材' : filter === 'FAVORITES' ? '我的收藏' : filter === 'OUTFITS' ? '我的穿搭' : categoryLabel(filter)}</h2>
            <div className="tools">
              <input className="search" type="search" placeholder="搜索素材…" aria-label="搜索素材" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          {filter === 'OUTFITS' ? (
            outfits.length ? <div className="outfit-list">{outfits.map((outfit) => <article className="outfit-card" key={outfit.id}><strong>{outfit.name}</strong><p className="subtitle">{outfit.items.length} 件已保存单品</p><Link className="action" href="/dress-up">在 3D 换装中管理</Link></article>)}</div>
              : <div className="empty"><strong>还没有保存的穿搭</strong>前往 3D 换装工作台组合并保存你的第一套搭配。<p><Link className="action" href="/dress-up">开始换装</Link></p></div>
          ) : visibleAssets.length ? (
            <div className="asset-grid">{visibleAssets.map((asset) => <article className="asset-card" key={asset.id}>
              <div className="thumb"><img src={asset.fileUrl} alt={categoryLabel(asset.category)} loading="lazy" /></div>
              <div className="asset-meta">
                <div className="asset-category">{categoryLabel(asset.category)}</div>
                <div className="asset-name" title={asset.attribution || asset.id}>{asset.attribution || asset.id.slice(0, 12)}</div>
                <div className="asset-bottom">
                  <span className="asset-date">{asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'PNG 素材'}</span>
                  <button className="favorite" type="button" aria-label={asset.isFavorite ? '取消收藏' : '收藏素材'} aria-pressed={asset.isFavorite} onClick={() => void toggleFavorite(asset)}>{asset.isFavorite ? '★' : '☆'}</button>
                </div>
              </div>
            </article>)}</div>
          ) : (
            <div className="empty"><strong>{filter === 'FAVORITES' ? '还没有收藏素材' : '这个分类还没有素材'}</strong>上传 PNG 素材后，它们会集中显示在这里。<p><button className="action primary" type="button" onClick={() => fileRef.current?.click()}>上传第一件素材</button></p></div>
          )}
          {filter !== 'OUTFITS' && nextCursor && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <button className="action" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? '加载中…' : '加载更多素材'}</button>
            </div>
          )}
          <p className="notice">{notice} · 披肩、外套与披风保持独立分类。皮肤 PNG 不包含 Minecraft 官方披风。</p>
        </section>
      </div>
    </main>
  )
}
