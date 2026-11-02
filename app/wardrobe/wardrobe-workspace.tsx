'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SkinViewer as SkinViewerType } from 'skinview3d'

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
type Outfit = {
  id: string
  name: string
  skinAssetId: string | null
  skinModel: 'CLASSIC' | 'SLIM'
  background: string | null
  pose: string | null
  items: Array<{ assetId: string; category: Category; sortOrder: number; equipped: boolean }>
}
const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: 'SKIN', label: '皮肤' }, { value: 'SHAWL', label: '披肩' },
  { value: 'COAT', label: '外套' }, { value: 'CAPE', label: '披风' },
  { value: 'HAT', label: '帽子' }, { value: 'PANTS', label: '裤子' },
  { value: 'SHOES', label: '鞋子' }, { value: 'OTHER_ACCESSORY', label: '其他配饰' },
]
const DEFAULT_SKIN = 'https://raw.githubusercontent.com/lonelyang/CapeSkinImage/master/examples/img/stevea.png'

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = src
  })
}

export default function WardrobeWorkspace() {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<SkinViewerType | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [viewerReady, setViewerReady] = useState(false)
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [category, setCategory] = useState<Category | 'ALL'>('COAT')
  const [selected, setSelected] = useState<Record<string, Asset>>({})
  const [model, setModel] = useState<'CLASSIC' | 'SLIM'>('CLASSIC')
  const [background, setBackground] = useState('#182437')
  const [outfitName, setOutfitName] = useState('我的穿搭')
  const [activeOutfit, setActiveOutfit] = useState('')
  const [workspaceProjectId, setWorkspaceProjectId] = useState<string | null>(null)
  const [workspaceOutfitId, setWorkspaceOutfitId] = useState<string | null>(null)
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  const restoredWorkspace = useRef(false)
  const [uploadCategory, setUploadCategory] = useState<Category>('SHAWL')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('正在连接素材库…')
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    const [assetResponse, outfitResponse, workspaceResponse] = await Promise.all([
      fetch('/api/assets?limit=60', { cache: 'no-store' }),
      fetch('/api/outfits', { cache: 'no-store' }),
      fetch('/api/workspace', { cache: 'no-store' }),
    ])
    if (assetResponse.status === 401 || outfitResponse.status === 401 || workspaceResponse.status === 401) {
      setStatus('请先登录后使用云端素材库与搭配保存')
      return
    }
    if (!assetResponse.ok || !outfitResponse.ok || !workspaceResponse.ok) throw new Error('读取云端素材、搭配或工作区状态失败')
    const assetData = await assetResponse.json()
    const outfitData = await outfitResponse.json()
    const workspaceData = await workspaceResponse.json()
    setAssets(Array.isArray(assetData.items) ? assetData.items : [])
    setOutfits(Array.isArray(outfitData.items) ? outfitData.items : [])
    setWorkspaceProjectId(workspaceData.item?.projectId ?? null)
    setWorkspaceOutfitId(workspaceData.item?.activeOutfitId ?? null)
    setWorkspaceLoaded(true)
    setStatus('云端素材库与工作区状态已就绪')
  }, [])

  useEffect(() => {
    void reload().catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
  }, [reload])

  useEffect(() => {
    let disposed = false
    let viewer: SkinViewerType | null = null
    const init = async () => {
      if (!hostRef.current) return
      try {
        const { SkinViewer } = await import('skinview3d')
        if (disposed || !hostRef.current) return
        const canvas = document.createElement('canvas')
        viewer = new SkinViewer({
          canvas,
          width: Math.max(hostRef.current.clientWidth, 300),
          height: Math.max(hostRef.current.clientHeight, 360),
          enableControls: true,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        })
        viewer.controls.enableDamping = false
        viewer.controls.enablePan = false
        viewer.controls.enableRotate = true
        viewer.controls.enableZoom = true
        viewer.controls.rotateSpeed = 0.9
        hostRef.current.replaceChildren(canvas)
        viewerRef.current = viewer
        setViewerReady(true)
      } catch {
        setError('3D 预览初始化失败，请使用支持 WebGL 的浏览器')
      }
    }
    void init()
    const resize = () => {
      if (!hostRef.current || !viewerRef.current) return
      viewerRef.current.width = Math.max(hostRef.current.clientWidth, 280)
      viewerRef.current.height = Math.max(hostRef.current.clientHeight, 320)
    }
    window.addEventListener('resize', resize)
    return () => {
      disposed = true
      window.removeEventListener('resize', resize)
      viewer?.dispose()
      viewerRef.current = null
      setViewerReady(false)
    }
  }, [])

  const equipped = useMemo(() => Object.values(selected), [selected])
  useEffect(() => {
    let cancelled = false
    const render = async () => {
      const viewer = viewerRef.current
      if (!viewer) return
      setBusy(true)
      setError('')
      try {
        const skin = selected.SKIN
        const base = await loadImage(skin?.fileUrl || DEFAULT_SKIN)
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const context = canvas.getContext('2d')
        if (!context) throw new Error('无法创建皮肤画布')
        context.imageSmoothingEnabled = false
        context.drawImage(base, 0, 0, 64, 64)
        for (const item of equipped.filter((entry) => entry.category !== 'SKIN' && entry.category !== 'CAPE')) {
          const overlay = await loadImage(item.fileUrl)
          if (cancelled) return
          context.drawImage(overlay, 0, 0, 64, 64)
        }
        await viewer.loadSkin(canvas, { model: model === 'SLIM' ? 'slim' : 'default' })
        if (cancelled) return
        const cape = selected.CAPE
        if (cape) {
          await viewer.loadCape(cape.fileUrl, { makeVisible: false })
          viewer.playerObject.backEquipment = 'cape'
        } else {
          viewer.playerObject.backEquipment = null
        }
        viewer.background = Number.parseInt(background.replace('#', ''), 16)
        setStatus('3D 预览已同步当前穿搭')
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '预览更新失败')
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    void render()
    return () => { cancelled = true }
  }, [selected, model, background, equipped, viewerReady])

  const visibleAssets = assets.filter((asset) => category === 'ALL' || asset.category === category)

  const persistWorkspace = async (activeAssetId: string | null, activeOutfitId: string | null) => {
    const response = await fetch('/api/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: workspaceProjectId, activeTool: 'WARDROBE', activeAssetId, activeOutfitId }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '保存工作区状态失败')
    setWorkspaceOutfitId(data.item?.activeOutfitId ?? null)
  }

  useEffect(() => {
    if (!workspaceLoaded || restoredWorkspace.current) return
    if (!workspaceOutfitId) {
      restoredWorkspace.current = true
      return
    }
    const outfit = outfits.find((item) => item.id === workspaceOutfitId)
    if (!outfit) return
    restoredWorkspace.current = true
    void loadOutfit(outfit)
  }, [workspaceLoaded, workspaceOutfitId, outfits, assets])

  const toggleFavorite = async (asset: Asset) => {
    setError('')
    try {
      const response = await fetch(`/api/assets/${asset.id}/favorite`, {
        method: asset.isFavorite ? 'DELETE' : 'PUT',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '更新收藏失败')
      setAssets((current) => current.map((item) => item.id === asset.id
        ? { ...item, isFavorite: Boolean(data.favorited) }
        : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新收藏失败')
    }
  }

  const toggleAsset = (asset: Asset) => {
    if (!asset.category) return
    setSelected((current) => {
      const next = { ...current }
      if (next[asset.category!]?.id === asset.id) delete next[asset.category!]
      else next[asset.category!] = asset
      return next
    })
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
      setCategory(uploadCategory)
      setStatus('素材已上传并保存到云端')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '上传失败')
    } finally {
      setBusy(false)
    }
  }

  const saveOutfit = async () => {
    const payload = {
      name: outfitName.trim() || '未命名搭配',
      skinAssetId: selected.SKIN?.id ?? null,
      skinModel: model,
      background,
      pose: 'idle',
      items: equipped.filter((asset) => asset.category && asset.category !== 'SKIN').map((asset, index) => ({
        assetId: asset.id, category: asset.category, sortOrder: index, equipped: true,
      })),
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch(activeOutfit ? `/api/outfits/${activeOutfit}` : '/api/outfits', {
        method: activeOutfit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '保存搭配失败')
      setActiveOutfit(data.item.id)
      setWorkspaceOutfitId(data.item.id)
      await persistWorkspace(selected.SKIN?.id ?? equipped[0]?.id ?? null, data.item.id)
      await reload()
      setStatus('搭配已保存到账号，可在其他设备加载')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存搭配失败')
    } finally {
      setBusy(false)
    }
  }

  const loadOutfit = async (outfit: Outfit) => {
    const requiredIds = [...new Set([
      ...(outfit.skinAssetId ? [outfit.skinAssetId] : []),
      ...outfit.items.filter((item) => item.equipped).map((item) => item.assetId),
    ])]
    const known = new Map(assets.map((asset) => [asset.id, asset]))
    const missingIds = requiredIds.filter((id) => !known.has(id))
    if (missingIds.length) {
      try {
        const response = await fetch(`/api/assets?ids=${encodeURIComponent(missingIds.join(','))}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '读取搭配素材失败')
        const fetched = (Array.isArray(data.items) ? data.items : []) as Asset[]
        for (const asset of fetched) known.set(asset.id, asset)
        setAssets((current) => {
          const merged = new Map(current.map((asset) => [asset.id, asset]))
          for (const asset of fetched) merged.set(asset.id, asset)
          return [...merged.values()]
        })
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '读取搭配素材失败')
        return
      }
    }
    const next: Record<string, Asset> = {}
    if (outfit.skinAssetId) {
      const skin = known.get(outfit.skinAssetId)
      if (skin) next.SKIN = skin
    }
    for (const item of outfit.items) {
      if (!item.equipped) continue
      const asset = known.get(item.assetId)
      if (asset?.category) next[asset.category] = asset
    }
    const unresolved = requiredIds.filter((id) => !known.has(id))
    if (unresolved.length) {
      setError('搭配中的部分素材当前不可访问，已保留可用素材。')
    } else {
      setError('')
    }
    setSelected(next)
    setModel(outfit.skinModel)
    if (outfit.background && /^#[0-9a-f]{6}$/i.test(outfit.background)) setBackground(outfit.background)
    setOutfitName(outfit.name)
    setActiveOutfit(outfit.id)
    setWorkspaceOutfitId(outfit.id)
    try {
      await persistWorkspace(outfit.skinAssetId ?? outfit.items.find((item) => item.equipped)?.assetId ?? null, outfit.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存工作区状态失败')
    }
    setStatus(`已加载搭配：${outfit.name}`)
  }

  const deleteOutfit = async () => {
    if (!activeOutfit) return
    if (!window.confirm('确定删除这套云端搭配吗？')) return
    setBusy(true)
    try {
      const response = await fetch(`/api/outfits/${activeOutfit}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('删除搭配失败')
      setActiveOutfit('')
      setOutfitName('我的穿搭')
      await reload()
      setStatus('云端搭配已删除')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="cdpc-wardrobe" data-studio-mode="wardrobe">
      <style jsx>{`
        .cdpc-wardrobe{max-width:1440px;margin:0 auto;padding:28px 24px 56px;color:var(--mantine-color-text,#e8edf5)}
        .wardrobe-head{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:20px;flex-wrap:wrap}
        .wardrobe-head h1{font-size:clamp(25px,3vw,36px);margin:0 0 6px;font-weight:750}
        .wardrobe-head p{margin:0;color:var(--mantine-color-dimmed,#9ba8ba)}
        .wardrobe-grid{display:grid;grid-template-columns:minmax(300px,1fr) minmax(320px,1.05fr);gap:18px}
        .panel{border:1px solid var(--mantine-color-default-border,#334155);background:var(--mantine-color-body,#111827);border-radius:16px;padding:16px;min-width:0}
        .preview{height:520px;min-height:360px;border-radius:12px;overflow:hidden;background:#182437}
        .toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
        button,select,input{font:inherit}
        button,.select,.text-input{border:1px solid var(--mantine-color-default-border,#475569);background:var(--mantine-color-default,#1e293b);color:inherit;border-radius:9px;padding:9px 12px}
        button{cursor:pointer}button:disabled{opacity:.5;cursor:not-allowed}
        button.primary{background:#2563eb;border-color:#2563eb;color:white}
        button.active{border-color:#60a5fa;background:rgba(37,99,235,.2)}
        .asset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:9px;margin-top:12px;max-height:510px;overflow:auto}
        .asset-card{display:flex;flex-direction:column;gap:5px;min-width:0}
        .asset{display:flex;flex-direction:column;gap:8px;text-align:left;padding:8px;min-width:0;width:100%}
        .favorite{font-size:12px;padding:5px 8px;align-self:flex-end}
        .asset img{width:100%;aspect-ratio:1;object-fit:contain;image-rendering:pixelated;background:#0b1220;border-radius:6px}
        .asset small{color:var(--mantine-color-dimmed,#94a3b8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .section-title{display:flex;justify-content:space-between;align-items:center;gap:10px}
        .section-title h2{font-size:16px;margin:0}
        .status{font-size:13px;color:var(--mantine-color-dimmed,#94a3b8);margin-top:10px}
        .error{color:#f87171;font-size:13px;margin:10px 0}
        .outfit-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}
        .text-input{min-width:0;flex:1}
        @media(max-width:850px){.wardrobe-grid{grid-template-columns:1fr}.preview{height:430px}}
      `}</style>
      <div className="wardrobe-head">
        <div><h1>服装换装工作台</h1><p>上传你的皮肤与服装素材，在 3D 角色上试穿并保存搭配。</p></div>
        <div className="toolbar"><button className={model === 'CLASSIC' ? 'active' : ''} onClick={() => setModel('CLASSIC')}>Steve · Classic</button><button className={model === 'SLIM' ? 'active' : ''} onClick={() => setModel('SLIM')}>Alex · Slim</button></div>
      </div>
      <div className="wardrobe-grid">
        <section className="panel">
          <div className="section-title"><h2>3D 角色预览</h2><span className="status">{busy ? '处理中…' : status}</span></div>
          <div ref={hostRef} className="preview" />
          <div className="toolbar"><label>背景 <input aria-label="预览背景颜色" type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label><button onClick={() => { setSelected({}); setModel('CLASSIC'); setBackground('#182437'); setActiveOutfit(''); setWorkspaceOutfitId(null); setOutfitName('我的穿搭'); void persistWorkspace(null, null).catch((cause) => setError(cause instanceof Error ? cause.message : '保存工作区状态失败')) }}>重置穿搭</button></div>
          <div className="outfit-row"><input className="text-input" aria-label="搭配名称" value={outfitName} onChange={(event) => setOutfitName(event.target.value)} /><button className="primary" disabled={busy} onClick={() => void saveOutfit()}>保存搭配</button><button disabled={busy || !activeOutfit} onClick={() => void deleteOutfit()}>删除</button></div>
          <div className="outfit-row"><select className="select" aria-label="已保存搭配" value={activeOutfit} onChange={(event) => { const found = outfits.find((item) => item.id === event.target.value); if (found) loadOutfit(found); else setActiveOutfit('') }}><option value="">选择已保存搭配</option>{outfits.map((outfit) => <option key={outfit.id} value={outfit.id}>{outfit.name}</option>)}</select><button disabled={!activeOutfit} onClick={() => { const found = outfits.find((item) => item.id === activeOutfit); if (found) loadOutfit(found) }}>加载</button></div>
          {error && <p className="error" role="alert">{error}</p>}
          <p className="status" role="status">{status}</p>
        </section>
        <section className="panel">
          <div className="section-title"><h2>云端素材库</h2><span className="status">{assets.length} 件素材</span></div>
          <div className="toolbar"><select className="select" value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value as Category)} aria-label="上传素材分类">{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><label className="primary" style={{borderRadius:9,padding:'9px 12px',cursor:'pointer'}}>上传 PNG<input type="file" accept="image/png" hidden disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} /></label></div>
          <div className="toolbar" role="tablist" aria-label="素材分类">{[{value:'ALL',label:'全部'},...CATEGORIES].map((item) => <button key={item.value} type="button" role="tab" aria-selected={category === item.value} className={category === item.value ? 'active' : ''} onClick={() => setCategory(item.value as Category | 'ALL')}>{item.label}</button>)}</div>
          <div className="asset-grid">{visibleAssets.map((asset) => <div key={asset.id} className="asset-card"><button className={selected[asset.category || '']?.id === asset.id ? 'asset active' : 'asset'} onClick={() => toggleAsset(asset)}><img src={asset.fileUrl} alt="" /><strong>{CATEGORIES.find((item) => item.value === asset.category)?.label || '未分类'}</strong><small>{asset.attribution || asset.id.slice(0, 10)}</small></button><button type="button" className="favorite" aria-label={asset.isFavorite ? '取消收藏' : '收藏素材'} aria-pressed={asset.isFavorite} onClick={() => void toggleFavorite(asset)}>{asset.isFavorite ? '★ 已收藏' : '☆ 收藏'}</button></div>)}</div>
          {!visibleAssets.length && <p className="status">暂无素材。可以先上传 64×64 皮肤 PNG 或服装贴图。</p>}
        </section>
      </div>
      <p className="status">披肩、外套与披风是独立素材类别。皮肤 PNG 导出不包含 Minecraft 官方披风。本项目与 Mojang / Microsoft 无官方关联。</p>
    </main>
  )
}
