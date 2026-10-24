'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SkinViewer } from 'skinview3d'

const ASSET_ROOT = 'https://raw.githubusercontent.com/lonelyang/CapeSkinImage/master/examples/img/'
const BASE_SKIN = ASSET_ROOT + 'stevea.png'
const categories = ['全部', '上衣', '外套', '裤子', '鞋子', '帽子', '披肩', '披风'] as const
type Category = typeof categories[number]
type GarmentCategory = Exclude<Category, '全部'>
type CatalogItem = { id: string; name: string; category: GarmentCategory; texture: string; modelTexture?: string; note: string }
const catalog: CatalogItem[] = [
  { id: 'office-shawl', name: '眼眸花披肩', category: '披肩', texture: 'office_shawl_default_64.png', modelTexture: 'office_shawl_slim_64.png', note: '正式披肩贴图' },
  { id: 'mcc-shawl', name: 'MCC 披肩', category: '披肩', texture: 'MCC_shawl_default_64.png', modelTexture: 'MCC_shawl_slim_64.png', note: '正式披肩贴图' },
  { id: 'creeper-shawl', name: '苦力怕披肩', category: '披肩', texture: 'creeper_shawl_default_64.png', modelTexture: 'creeper_shawl_slim_64.png', note: '正式披肩贴图' },
  { id: 'tiktok-shawl', name: 'TikTok 披肩', category: '披肩', texture: 'tiktok_shawl_default_64.png', modelTexture: 'tiktok_shawl_slim_64.png', note: '正式披肩贴图' },
  { id: 'twitch-shawl', name: 'Twitch 披肩', category: '披肩', texture: 'twitch_shawl_default_64.png', modelTexture: 'twitch_shawl_slim_64.png', note: '正式披肩贴图' },
  { id: 'creeper-coat', name: '苦力怕外套', category: '外套', texture: 'creeper_coat_default_64.png', modelTexture: 'creeper_coat_slim_64.png', note: '正式外套贴图' },
  { id: 'tiktok-coat', name: 'TikTok 外套', category: '外套', texture: 'tiktok_coat_default_64.png', modelTexture: 'tiktok_coat_slim_64.png', note: '正式外套贴图' },
  { id: 'twitch-coat', name: 'Twitch 外套', category: '外套', texture: 'twitch_coat_default_64.png', modelTexture: 'twitch_coat_slim_64.png', note: '正式外套贴图' },
  { id: 'office-cape', name: '眼眸花披风', category: '披风', texture: 'cape_office.png', note: '背部披风纹理' },
  { id: 'mcc-cape', name: 'MCC 披风', category: '披风', texture: 'cape_MCC.png', note: '背部披风纹理' },
  { id: 'creeper-cape', name: '苦力怕披风', category: '披风', texture: 'cape_creeper.png', note: '背部披风纹理' },
  { id: 'tiktok-cape', name: 'TikTok 披风', category: '披风', texture: 'cape_tiktok.png', note: '背部披风纹理' },
  { id: 'twitch-cape', name: 'Twitch 披风', category: '披风', texture: 'cape_twitch.png', note: '背部披风纹理' },
]
const availableCategories = new Set<GarmentCategory>(['披肩', '外套', '披风'])
type ModelType = 'steve' | 'alex'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('素材加载失败：' + src.split('/').pop()))
    image.src = src
  })
}

export default function DressUpStudio() {
  const previewHost = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<SkinViewer | null>(null)
  const skinFileRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<Category>('全部')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<string, CatalogItem>>({})
  const [model, setModel] = useState<ModelType>('steve')
  const [skinUrl, setSkinUrl] = useState(BASE_SKIN)
  const [skinName, setSkinName] = useState('Steve 默认皮肤')
  const [status, setStatus] = useState('正在初始化 3D 预览…')
  const [loadError, setLoadError] = useState('')
  const [background, setBackground] = useState('#182437')
  const [isBusy, setIsBusy] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)
  const [saveNotice, setSaveNotice] = useState('')

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('cdpc:dress-up:local-v1')
      if (!raw) return
      const saved = JSON.parse(raw) as { itemIds?: string[]; model?: ModelType; background?: string; skinUrl?: string; skinName?: string }
      const restored = (saved.itemIds ?? []).reduce<Record<string, CatalogItem>>((items, id) => {
        const item = catalog.find(entry => entry.id === id)
        if (item) items[item.category] = item
        return items
      }, {})
      setSelected(restored)
      if (saved.model === 'steve' || saved.model === 'alex') setModel(saved.model)
      if (typeof saved.background === 'string' && /^#[0-9a-f]{6}$/i.test(saved.background)) setBackground(saved.background)
      if (typeof saved.skinUrl === 'string' && saved.skinUrl.startsWith('data:image/png')) setSkinUrl(saved.skinUrl)
      if (typeof saved.skinName === 'string') setSkinName(saved.skinName)
      setSaveNotice('已恢复上次保存在此设备的穿搭')
    } catch {
      setSaveNotice('上次的本地穿搭无法读取，可重新保存一份')
    }
  }, [])

  const filtered = useMemo(() => catalog.filter(item =>
    (category === '全部' || item.category === category) &&
    (item.name.toLowerCase().includes(query.trim().toLowerCase()) || item.category.includes(query.trim())),
  ), [category, query])
  const selectedItems = Object.values(selected)
  const cape = selected['披风']

  useEffect(() => {
    const host = previewHost.current
    if (!host) return
    let viewer: SkinViewer
    try {
      const canvas = document.createElement('canvas')
      viewer = new SkinViewer({ canvas, width: Math.max(host.clientWidth, 320), height: Math.max(host.clientHeight, 360), enableControls: true, pixelRatio: Math.min(window.devicePixelRatio || 1, 2) })
      viewer.controls.enableDamping = false
      viewer.controls.enablePan = false
      viewer.controls.enableRotate = true
      viewer.controls.enableZoom = true
      viewer.controls.rotateSpeed = 0.9
      viewer.renderer.setClearColor(0x182437, 1)
      host.replaceChildren(canvas)
      viewerRef.current = viewer
      setStatus('3D 预览已启动')
    } catch {
      setLoadError('当前浏览器无法初始化 WebGL 预览。请更新浏览器或使用支持 WebGL 的设备。')
      return
    }
    const resize = () => {
      if (!previewHost.current || !viewerRef.current) return
      viewerRef.current.width = Math.max(previewHost.current.clientWidth, 280)
      viewerRef.current.height = Math.max(previewHost.current.clientHeight, 320)
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    if (observer) observer.observe(host)
    window.addEventListener('resize', resize)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      viewer.dispose()
      viewerRef.current = null
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    let cancelled = false
    const updatePreview = async () => {
      setIsBusy(true)
      setLoadError('')
      setStatus('正在加载皮肤与选装素材…')
      try {
        const base = await loadImage(skinUrl)
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const context = canvas.getContext('2d')
        if (!context) throw new Error('无法创建皮肤画布')
        context.imageSmoothingEnabled = false
        context.drawImage(base, 0, 0, 64, 64)
        for (const item of selectedItems.filter(item => item.category !== '披风')) {
          const textureName = model === 'alex' && item.modelTexture ? item.modelTexture : item.texture
          const overlay = await loadImage(ASSET_ROOT + textureName)
          if (cancelled) return
          context.save()
          context.beginPath()
          const uvRegions = [{ x: 16, y: 16, width: 24, height: 16 }, { x: 16, y: 32, width: 24, height: 16 }, { x: 40, y: 16, width: 16, height: 16 }, { x: 40, y: 32, width: 16, height: 16 }, { x: 32, y: 48, width: 16, height: 16 }, { x: 48, y: 48, width: 16, height: 16 }]
          uvRegions.forEach(region => context.rect(region.x, region.y, region.width, region.height))
          context.clip()
          context.drawImage(overlay, 0, 0, 64, 64)
          context.restore()
        }
        await viewer.loadSkin(canvas, { model: model === 'alex' ? 'slim' : 'default' })
        if (cancelled) return
        if (cape) {
          await viewer.loadCape(ASSET_ROOT + cape.texture, { makeVisible: false })
          if (cancelled) return
          viewer.playerObject.backEquipment = 'cape'
        } else {
          viewer.playerObject.backEquipment = null
        }
        if (cancelled) return
        viewer.background = Number.parseInt(background.replace('#', ''), 16)
        setStatus('预览已更新')
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : '预览加载失败，请检查网络后重试。')
          setStatus('部分素材加载失败')
        }
      } finally {
        if (!cancelled) setIsBusy(false)
      }
    }
    void updatePreview()
    return () => { cancelled = true }
  }, [skinUrl, model, selected, background, retryVersion])

  function toggleItem(item: CatalogItem) {
    setSelected(current => {
      const next = { ...current }
      if (next[item.category]?.id === item.id) delete next[item.category]
      else next[item.category] = item
      return next
    })
  }

  function saveLocalOutfit() {
    try {
      window.localStorage.setItem('cdpc:dress-up:local-v1', JSON.stringify({
        itemIds: selectedItems.map(item => item.id),
        model,
        background,
        skinUrl: skinUrl.startsWith('data:image/png') ? skinUrl : undefined,
        skinName,
        savedAt: new Date().toISOString(),
      }))
      setSaveNotice('穿搭已保存在此设备；登录账户同步功能尚未接入')
    } catch {
      setSaveNotice('保存失败：浏览器存储空间可能不足，请减少图片数据后重试')
    }
  }

  async function exportSkinPng() {
    try {
      setIsBusy(true)
      setSaveNotice('正在合成 64 × 64 标准皮肤 PNG…')
      const base = await loadImage(skinUrl)
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法创建导出画布')
      context.imageSmoothingEnabled = false
      context.drawImage(base, 0, 0, 64, 64)
      const uvRegions = [
        { x: 16, y: 16, width: 24, height: 16 },
        { x: 16, y: 32, width: 24, height: 16 },
        { x: 40, y: 16, width: 16, height: 16 },
        { x: 40, y: 32, width: 16, height: 16 },
        { x: 32, y: 48, width: 16, height: 16 },
        { x: 48, y: 48, width: 16, height: 16 },
      ]
      for (const item of selectedItems.filter(entry => entry.category !== '披风')) {
        const textureName = model === 'alex' && item.modelTexture ? item.modelTexture : item.texture
        const overlay = await loadImage(ASSET_ROOT + textureName)
        context.save()
        context.beginPath()
        uvRegions.forEach(region => context.rect(region.x, region.y, region.width, region.height))
        context.clip()
        context.drawImage(overlay, 0, 0, 64, 64)
        context.restore()
      }
      const link = document.createElement('a')
      link.download = 'cdpc-skin-64x64.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
      setSaveNotice(cape
        ? '标准皮肤 PNG 已导出。注意：披风是独立背部装备，不包含在标准皮肤 PNG 中。'
        : '标准皮肤 PNG 已导出（64 × 64）。')
    } catch (error) {
      setSaveNotice(error instanceof Error ? `导出失败：${error.message}` : '导出失败，请稍后重试')
    } finally {
      setIsBusy(false)
    }
  }

  function resetToDefault() {
    setSelected({})
    setModel('steve')
    setSkinUrl(BASE_SKIN)
    setSkinName('Steve 默认皮肤')
    setBackground('#182437')
    setSaveNotice('已恢复默认角色状态；此前保存的本地穿搭不会被删除')
  }

  function downloadPreviewScreenshot() {
    const canvas = previewHost.current?.querySelector('canvas')
    if (!canvas) {
      setSaveNotice('3D 预览尚未准备好，请稍后再试')
      return
    }
    try {
      const link = document.createElement('a')
      link.download = 'cdpc-character-preview.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
      setSaveNotice('预览截图已开始下载')
    } catch {
      setSaveNotice('截图生成失败；如果素材来自跨域地址，请检查素材服务器的跨域设置')
    }
  }

  function resetPreviewCamera() {
    const viewer = viewerRef.current
    if (!viewer) {
      setSaveNotice('3D 预览尚未准备好')
      return
    }
    viewer.controls.reset()
    setSaveNotice('已重置角色视角')
  }

  function randomOutfit() {
    const next: Record<string, CatalogItem> = {}
    for (const itemCategory of ['披肩', '外套', '披风'] as const) {
      const options = catalog.filter(item => item.category === itemCategory)
      if (options.length) next[itemCategory] = options[Math.floor(Math.random() * options.length)]
    }
    setSelected(next)
    setSaveNotice('已随机生成一套搭配；保存后才会保留到下次访问')
  }

  function importSkin(file?: File) {
    if (!file) return
    if (!file.type.includes('png')) {
      setLoadError('请选择 PNG 格式的 Minecraft 皮肤文件。')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const url = String(reader.result || '')
      try {
        const image = await loadImage(url)
        if (image.width !== 64 || image.height !== 64) {
          setLoadError('皮肤尺寸必须为标准 64 × 64 PNG。当前文件未应用。')
          return
        }
        setSkinUrl(url)
        setSkinName(file.name)
        setLoadError('')
      } catch {
        setLoadError('无法读取该 PNG，请重新选择有效的皮肤文件。')
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <main className="dressup-page">
      <header className="dressup-heading">
        <div>
          <div className="dressup-eyebrow">CDPC / OUTFIT BUILDER</div>
          <h1>衣服选装</h1>
          <p>用真实 Minecraft 角色预览搭配。披肩、外套与披风分开管理；选装完成后可继续进入工作台编辑。</p>
        </div>
        <Link className="cdpc-button cdpc-button-quiet" href="/studio">进入创作工坊 ↗</Link>
      </header>

      <div className="dressup-layout">
        <section className="dressup-panel" aria-label="服装素材">
          <div className="dressup-panel-heading"><h2>素材库</h2><span>{filtered.length} 项</span></div>
          <input className="dressup-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索服装名称…" aria-label="搜索服装" />
          <div className="dressup-categories" aria-label="服装分类">
            {categories.map(item => <button type="button" className="dressup-category" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          {category !== '全部' && !availableCategories.has(category) && <div className="dressup-unavailable"><strong>{category}素材尚未接入</strong><p>目前正式素材目录尚未提供该分类的可用贴图，因此不会展示虚构素材。素材接入后会在这里出现。</p></div>}
          <div className="dressup-items">
            {filtered.map(item => <button type="button" key={item.id} className="dressup-item" aria-pressed={selected[item.category]?.id === item.id} onClick={() => toggleItem(item)}>
              <span className="dressup-item-mark" aria-hidden="true">▦</span>
              <strong>{item.name}</strong>
              <small>{item.category} · {item.note}</small>
              <span className="dressup-item-state">{selected[item.category]?.id === item.id ? '已选择' : '点击试穿'}</span>
            </button>)}
          </div>
          {filtered.length === 0 && category !== '全部' && availableCategories.has(category) && <p className="dressup-empty">该分类暂无匹配素材，请更换关键词。</p>}
          {filtered.length === 0 && category === '全部' && <p className="dressup-empty">没有找到匹配的素材。试试其他关键词。</p>}
          <div className="dressup-source-note">素材来自项目现有预设目录；如远程素材加载失败，可稍后重试。</div>
        </section>

        <section className="dressup-panel dressup-preview" aria-label="角色搭配预览">
          <div className="dressup-panel-heading"><h2>实时 3D 预览</h2><span className={loadError ? 'dressup-status is-error' : 'dressup-status'}>{isBusy ? '加载中' : status}</span></div>
          <div className="dressup-preview-tools">
            <div className="dressup-model-switch" role="group" aria-label="角色模型">
              <button type="button" aria-pressed={model === 'steve'} onClick={() => setModel('steve')}>Steve 粗臂</button>
              <button type="button" aria-pressed={model === 'alex'} onClick={() => setModel('alex')}>Alex 细臂</button>
            </div>
            <label className="dressup-background-control">背景 <input type="color" value={background} onChange={event => setBackground(event.target.value)} aria-label="预览背景颜色" /></label>
          </div>
          <div className="dressup-preview-stage dressup-real-preview" ref={previewHost} />
          <div className="dressup-preview-tools dressup-bottom-tools">
            <span className="dressup-skin-name" title={skinName}>当前皮肤：{skinName}</span>
            <button type="button" onClick={resetPreviewCamera}>重置视角</button>
            <button type="button" onClick={downloadPreviewScreenshot}>下载预览截图</button>
            <button type="button" onClick={() => skinFileRef.current?.click()}>导入 64×64 PNG</button>
            <input ref={skinFileRef} hidden type="file" accept="image/png,.png" onChange={event => importSkin(event.target.files?.[0])} />
          </div>
          {loadError && <div className="dressup-error" role="alert"><span>{loadError}</span><button type="button" onClick={() => { setLoadError(''); setRetryVersion(version => version + 1) }}>重试</button></div>}
          <p className="dressup-preview-note">拖动角色可旋转，滚轮可缩放。当前使用真实 3D 模型；已接入素材的贴图会合成到皮肤，披风单独作为背部装备加载。</p>
        </section>

        <aside className="dressup-panel" aria-label="当前穿搭">
          <div className="dressup-panel-heading"><h2>当前穿搭</h2><span>{selectedItems.length} 件</span></div>
          {selectedItems.length ? <div className="dressup-selected-list">
            {selectedItems.map(item => <div className="dressup-selected-row" key={item.id}><span><small>{item.category}</small><strong>{item.name}</strong></span><button type="button" onClick={() => toggleItem(item)}>移除</button></div>)}
          </div> : <p className="dressup-empty">还没有选择素材。点击左侧已接入的披肩、外套或披风开始搭配。</p>}
          <div className="dressup-actions">
            <button type="button" onClick={randomOutfit}>随机搭配</button>
            <button type="button" onClick={saveLocalOutfit}>保存到此设备</button>
            <button type="button" onClick={resetToDefault}>恢复默认角色</button>
            <button type="button" onClick={() => void exportSkinPng()} disabled={isBusy}>导出标准皮肤 PNG</button>
            <button type="button" onClick={() => {
              try {
                const raw = window.localStorage.getItem('cdpc:dress-up:local-v1')
                if (!raw) { setSaveNotice('此设备还没有保存过穿搭'); return }
                const saved = JSON.parse(raw) as { itemIds?: string[]; model?: ModelType; background?: string; skinUrl?: string; skinName?: string }
                setSelected((saved.itemIds ?? []).reduce<Record<string, CatalogItem>>((items, id) => {
                  const item = catalog.find(entry => entry.id === id)
                  if (item) items[item.category] = item
                  return items
                }, {}))
                if (saved.model === 'steve' || saved.model === 'alex') setModel(saved.model)
                if (typeof saved.background === 'string' && /^#[0-9a-f]{6}$/i.test(saved.background)) setBackground(saved.background)
                if (typeof saved.skinUrl === 'string' && saved.skinUrl.startsWith('data:image/png')) setSkinUrl(saved.skinUrl)
                if (typeof saved.skinName === 'string') setSkinName(saved.skinName)
                setSaveNotice('已恢复本地穿搭')
              } catch {
                setSaveNotice('无法读取本地穿搭，请重新保存')
              }
            }}>恢复已保存穿搭</button>
            <button type="button" onClick={() => setSelected({})} disabled={!selectedItems.length}>全部脱下</button>
            <button type="button" onClick={() => skinFileRef.current?.click()}>更换基础皮肤</button>
            <Link className="primary" href="/studio">继续到创作工坊 ↗</Link>
          </div>
          {saveNotice && <p className="dressup-save-notice" role="status">{saveNotice}</p>}
          <p className="dressup-preview-note">当前页面支持实时预览和本地临时搭配。账号保存穿搭及一键导出合成皮肤尚未接入，因此不会显示为已完成能力。</p>
        </aside>
      </div>
    </main>
  )
}
