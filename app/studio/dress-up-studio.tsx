'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cdpcApi, type ApiProjectSummary, type OutfitInput, type ProjectInput } from '@/src/client/cdpc-api'
import { CrouchAnimation, FlyingAnimation, HitAnimation, IdleAnimation, RunningAnimation, SkinViewer, SwimAnimation, WalkingAnimation, WaveAnimation } from 'skinview3d'
import CatalogGarmentPreview from './catalog-garment-preview'
import { selectStudioOverlayTexture, validateStudioOverlayMatchesBase, validateStudioSkinTexture } from '@/src/domain/studio-texture'
import { buildStudioWorkspaceState, normalizeStudioPose, type StudioPose } from '@/src/domain/studio-outfit-state'
import { canEquipStudioOverlayTogether, getStudioOverlayUvProfile, type StudioOverlayCategory } from '@/src/domain/studio-uv-layout'
import { normalizeOutfitBackupAssets, normalizeOutfitBackupSkinUrl } from '@/src/domain/outfit-backup'

const ASSET_ROOT = 'https://raw.githubusercontent.com/lonelyang/CapeSkinImage/master/examples/img/'
const BASE_SKIN = ASSET_ROOT + 'stevea.png'
const SCENE_BACKGROUNDS: Record<string, string> = {
  day: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/exploration-mindful.jpg',
  night: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/MCV_holiday_release_Eyeblossom_NightTrail_1280x720_01.jpg',
  plains: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/exploration-mindful.jpg',
  desert: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/exploration-structures.jpg',
  forest: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/forest-carousel1.jpg',
  nether: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/waste-carousel1.jpg',
  end: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/highlands-carousel1.jpg',
}
const categories = ['全部', '上衣', '外套', '裤子', '鞋子', '帽子', '披肩', '披风'] as const
type Category = typeof categories[number]
type GarmentCategory = Exclude<Category, '全部'>
type CatalogItem = { id: string; name: string; category: GarmentCategory; texture: string; texture128?: string; modelTexture?: string; modelTexture128?: string; note: string; assetId?: string; fileUrl?: string; attribution?: string | null; source?: string; visibility?: string; provenance?: 'USER_CREATED' | 'OFFICIAL' | 'LICENSED' | 'THIRD_PARTY' | 'UNKNOWN'; downloadPolicy?: 'DENY' | 'OWNER_ONLY' | 'LICENSED_PUBLIC'; canDownload?: boolean }
const catalog: CatalogItem[] = [
  { id: 'office-shawl', name: '眼眸花披肩', category: '披肩', texture: 'office_shawl_default_64.png', texture128: 'office_shawl_default_128.png', modelTexture: 'office_shawl_slim_64.png', modelTexture128: 'office_shawl_slim_128.png', note: '正式披肩贴图' },
  { id: 'mcc-shawl', name: 'MCC 披肩', category: '披肩', texture: 'MCC_shawl_default_64.png', texture128: 'MCC_shawl_default_128.png', modelTexture: 'MCC_shawl_slim_64.png', modelTexture128: 'MCC_shawl_slim_128.png', note: '正式披肩贴图' },
  { id: 'creeper-shawl', name: '苦力怕披肩', category: '披肩', texture: 'creeper_shawl_default_64.png', texture128: 'creeper_shawl_default_128.png', modelTexture: 'creeper_shawl_slim_64.png', modelTexture128: 'creeper_shawl_slim_128.png', note: '正式披肩贴图' },
  { id: 'tiktok-shawl', name: 'TikTok 披肩', category: '披肩', texture: 'tiktok_shawl_default_64.png', texture128: 'tiktok_shawl_default_128.png', modelTexture: 'tiktok_shawl_slim_64.png', modelTexture128: 'tiktok_shawl_slim_128.png', note: '正式披肩贴图' },
  { id: 'twitch-shawl', name: 'Twitch 披肩', category: '披肩', texture: 'twitch_shawl_default_64.png', texture128: 'twitch_shawl_default_128.png', modelTexture: 'twitch_shawl_slim_64.png', modelTexture128: 'twitch_shawl_slim_128.png', note: '正式披肩贴图' },
  { id: 'creeper-coat', name: '苦力怕外套', category: '外套', texture: 'creeper_coat_default_64.png', texture128: 'creeper_coat_default_128.png', modelTexture: 'creeper_coat_slim_64.png', modelTexture128: 'creeper_coat_slim_128.png', note: '正式外套贴图' },
  { id: 'tiktok-coat', name: 'TikTok 外套', category: '外套', texture: 'tiktok_coat_default_64.png', texture128: 'tiktok_coat_default_128.png', modelTexture: 'tiktok_coat_slim_64.png', modelTexture128: 'tiktok_coat_slim_128.png', note: '正式外套贴图' },
  { id: 'twitch-coat', name: 'Twitch 外套', category: '外套', texture: 'twitch_coat_default_64.png', texture128: 'twitch_coat_default_128.png', modelTexture: 'twitch_coat_slim_64.png', modelTexture128: 'twitch_coat_slim_128.png', note: '正式外套贴图' },
  { id: 'office-cape', name: '眼眸花披风', category: '披风', texture: 'cape_office.png', note: '背部披风纹理' },
  { id: 'mcc-cape', name: 'MCC 披风', category: '披风', texture: 'cape_MCC.png', note: '背部披风纹理' },
  { id: 'creeper-cape', name: '苦力怕披风', category: '披风', texture: 'cape_creeper.png', note: '背部披风纹理' },
  { id: 'tiktok-cape', name: 'TikTok 披风', category: '披风', texture: 'cape_tiktok.png', note: '背部披风纹理' },
  { id: 'twitch-cape', name: 'Twitch 披风', category: '披风', texture: 'cape_twitch.png', note: '背部披风纹理' },
]
const availableCategories = new Set<GarmentCategory>(['披肩', '外套', '披风'])
type ModelType = 'steve' | 'alex'
type StudioView = 'front' | 'back' | 'side'
type LocalOutfit = { id: string; name: string; itemIds: string[]; model: ModelType; pose?: StudioPose; background: string; backgroundScene?: string; skinUrl?: string; skinName: string; savedAt: string; cloud?: boolean; skinAssetId?: string | null; skinAssetUrl?: string; assetItems?: CatalogItem[] }


function toAssetCategory(category: GarmentCategory): 'SHAWL' | 'COAT' | 'CAPE' {
  if (category === '披肩') return 'SHAWL'
  if (category === '外套') return 'COAT'
  if (category === '披风') return 'CAPE'
  throw new Error('该服装分类尚未接入云端素材类型')
}

function fromAssetCategory(category: string | null): GarmentCategory | null {
  if (category === 'SHAWL') return '披肩'
  if (category === 'COAT') return '外套'
  if (category === 'CAPE') return '披风'
  return null
}

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
  const singleItemPreviewHost = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<SkinViewer | null>(null)
  const [singlePreviewItem, setSinglePreviewItem] = useState<CatalogItem | null>(null)
  const skinFileRef = useRef<HTMLInputElement>(null)
  const outfitFileRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<Category>('全部')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<string, CatalogItem>>({})
  const [model, setModel] = useState<ModelType>('steve')
  const [skinUrl, setSkinUrl] = useState(BASE_SKIN)
  const [skinName, setSkinName] = useState('Steve 默认皮肤')
  const [status, setStatus] = useState('正在初始化 3D 预览…')
  const [loadError, setLoadError] = useState('')
  const [background, setBackground] = useState('#182437')
  const [backgroundScene, setBackgroundScene] = useState('night')
  const [pose, setPose] = useState<StudioPose>('idle')
  const [elytraVisible, setElytraVisible] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)
  const [viewAngle, setViewAngle] = useState<StudioView>('front')
  const [isBusy, setIsBusy] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)
  const [saveNotice, setSaveNotice] = useState('')
  const [outfitName, setOutfitName] = useState('我的穿搭')
  const [savedOutfits, setSavedOutfits] = useState<LocalOutfit[]>([])
  const [selectedSavedOutfitId, setSelectedSavedOutfitId] = useState('')
  const [savingCloud, setSavingCloud] = useState(false)
  const [projects, setProjects] = useState<ApiProjectSummary[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedProjectRevision, setSelectedProjectRevision] = useState(0)
  const [savingProject, setSavingProject] = useState(false)
  const [wardrobeItems, setWardrobeItems] = useState<CatalogItem[]>([])
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [favoritesLoaded, setFavoritesLoaded] = useState(false)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('cdpc:studio:favorites:v1')
      if (stored) {
        const parsed: unknown = JSON.parse(stored)
        if (Array.isArray(parsed)) setFavoriteIds(parsed.filter((value): value is string => typeof value === 'string').slice(0, 1000))
      }
    } catch {
      setSaveNotice('本地收藏记录无法读取；你仍可继续使用换装功能')
    } finally {
      setFavoritesLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!favoritesLoaded) return
    try {
      window.localStorage.setItem('cdpc:studio:favorites:v1', JSON.stringify(favoriteIds))
    } catch {
      setSaveNotice('收藏保存失败：浏览器本地存储空间可能不足')
    }
  }, [favoriteIds, favoritesLoaded])

  const toggleFavorite = useCallback((itemId: string) => {
    setFavoriteIds(current => current.includes(itemId) ? current.filter(id => id !== itemId) : [...current, itemId].slice(-1000))
  }, [])

  const refreshCloudOutfits = useCallback(async () => {
    let outfits
    try { outfits = await cdpcApi.listOutfits() } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 401) return
      throw new Error('无法读取账号云端穿搭')
    }
    const ids = [...new Set(outfits.flatMap((outfit: any) => [
      ...(outfit.skinAssetId ? [outfit.skinAssetId] : []),
      ...(Array.isArray(outfit.items) ? outfit.items.map((item: any) => item.assetId) : []),
    ]).filter((id: unknown): id is string => typeof id === 'string'))]
    const assets = new Map<string, any>()
    for (let index = 0; index < ids.length; index += 65) {
      const batch = ids.slice(index, index + 65)
      const assetPayload = await cdpcApi.listAssets({ ids: batch })
      for (const asset of assetPayload.items ?? []) assets.set(asset.id, asset)
    }
    const cloud: LocalOutfit[] = outfits.map((outfit: any) => {
      const assetItems: CatalogItem[] = (outfit.items ?? []).flatMap((entry: any) => {
        const asset = assets.get(entry.assetId)
        const category = fromAssetCategory(asset?.category || entry.category)
        if (!asset?.fileUrl || !category) return []
        return [{
          id: asset.id,
          assetId: asset.id,
          fileUrl: asset.fileUrl,
          texture: asset.fileUrl,
          name: typeof asset.name === 'string' && asset.name.trim() ? asset.name : `云端${category}素材`,
          category,
          note: '账号云端素材',
          attribution: asset.attribution,
          source: asset.source,
          visibility: asset.visibility,
          provenance: asset.provenance,
          downloadPolicy: asset.downloadPolicy,
          canDownload: asset.canDownload === true,
        }]
      })
      const skin = outfit.skinAssetId ? assets.get(outfit.skinAssetId) : null
      return {
        id: outfit.id,
        name: outfit.name,
        itemIds: assetItems.map(item => item.id),
        model: outfit.skinModel === 'SLIM' ? 'alex' : 'steve',
        pose: normalizeStudioPose(outfit.pose),
        background: typeof outfit.background === 'string' && /^#[0-9a-f]{6}$/i.test(outfit.background) ? outfit.background : '#182437',
        skinUrl: skin?.fileUrl,
        skinAssetId: outfit.skinAssetId ?? null,
        skinAssetUrl: skin?.fileUrl,
        skinName: skin?.attribution || (skin ? '云端皮肤' : 'Steve 默认皮肤'),
        savedAt: outfit.updatedAt || outfit.createdAt || new Date().toISOString(),
        cloud: true,
        assetItems,
      }
    })
    setSavedOutfits(current => [...current.filter(item => !item.cloud), ...cloud])
    const workspace = await cdpcApi.getWorkspace().catch(() => null)
    if (workspace) {
      const activeOutfit = cloud.find(item => item.id === workspace.activeOutfitId)
      if (activeOutfit?.assetItems) {
        setSelected(activeOutfit.assetItems.reduce<Record<string, CatalogItem>>((items, item) => {
          items[item.category] = item
          return items
        }, {}))
        setSkinUrl(activeOutfit.skinAssetUrl || BASE_SKIN)
        setSkinName(activeOutfit.skinName || 'Steve 默认皮肤')
        setModel(activeOutfit.model)
        setPose(activeOutfit.pose || 'idle')
        setBackgroundScene('custom')
        setBackground(activeOutfit.background)
        setOutfitName(activeOutfit.name)
        setSelectedSavedOutfitId(activeOutfit.id)
        setSaveNotice(`已从衣橱恢复云端穿搭“${activeOutfit.name}”`)
      }
    }
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('cdpc:dress-up:outfits-v1')
      if (!raw) return
      const parsed = JSON.parse(raw) as LocalOutfit[]
      if (Array.isArray(parsed)) setSavedOutfits(parsed.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.itemIds)))
    } catch {
      setSaveNotice('已保存穿搭列表无法读取；你仍可重新保存穿搭')
    }
  }, [])

  useEffect(() => {
    void refreshCloudOutfits().catch(error => {
      setSaveNotice(error instanceof Error ? error.message : '云端穿搭读取失败')
    })
  }, [refreshCloudOutfits])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('cdpc:dress-up:local-v1')
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<LocalOutfit>
      if (typeof saved.name === 'string' && saved.name.trim()) setOutfitName(saved.name.slice(0, 48))
      if (typeof saved.id === 'string') setSelectedSavedOutfitId(saved.id)
      const savedAssets = Array.isArray(saved.assetItems) ? saved.assetItems : []
      const restored = (saved.itemIds ?? []).reduce<Record<string, CatalogItem>>((items, id) => {
        const item = savedAssets.find(entry => entry.id === id) || catalog.find(entry => entry.id === id)
        if (item) items[item.category] = item
        return items
      }, {})
      setSelected(restored)
      if (saved.model === 'steve' || saved.model === 'alex') setModel(saved.model)
      setPose(normalizeStudioPose(saved.pose))
      if (typeof saved.background === 'string' && /^#[0-9a-f]{6}$/i.test(saved.background)) setBackground(saved.background)
      if (saved.backgroundScene === 'day' || saved.backgroundScene === 'night' || saved.backgroundScene === 'plains' || saved.backgroundScene === 'desert' || saved.backgroundScene === 'forest' || saved.backgroundScene === 'nether' || saved.backgroundScene === 'end' || saved.backgroundScene === 'custom') setBackgroundScene(saved.backgroundScene)
      else setBackgroundScene('custom')
      if (typeof saved.skinAssetUrl === 'string') setSkinUrl(saved.skinAssetUrl)
      else if (typeof saved.skinUrl === 'string' && saved.skinUrl.startsWith('data:image/png')) setSkinUrl(saved.skinUrl)
      else setSkinUrl(BASE_SKIN)
      if (typeof saved.skinName === 'string') setSkinName(saved.skinName)
      setSaveNotice('已恢复上次保存在此设备的穿搭')
    } catch {
      setSaveNotice('上次的本地穿搭无法读取，可重新保存一份')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadWardrobeAssets = async () => {
      try {
        const assets: Awaited<ReturnType<typeof cdpcApi.listAssets>>['items'] = []
        let cursor: string | null = null
        let page = 0
        do {
          const response = await cdpcApi.listAssets({ limit: 60, ...(cursor ? { cursor } : {}) })
          assets.push(...response.items)
          cursor = response.nextCursor
          page += 1
        } while (cursor && page < 20)
        if (cancelled) return
        const items: CatalogItem[] = assets.flatMap(asset => {
          const garmentCategory = fromAssetCategory(asset.category)
          if (!garmentCategory || !asset.fileUrl) return []
          return [{
            id: asset.id,
            assetId: asset.id,
            fileUrl: asset.fileUrl,
            texture: asset.fileUrl,
            name: typeof asset.name === 'string' && asset.name.trim() ? asset.name : `我的${garmentCategory}素材`,
            category: garmentCategory,
            note: '我的衣橱素材',
            attribution: asset.attribution,
            source: asset.source,
            visibility: asset.visibility,
            provenance: asset.provenance,
            downloadPolicy: asset.downloadPolicy,
            canDownload: asset.canDownload === true,
          }]
        })
        setWardrobeItems(items)
      } catch (error) {
        if (cancelled) return
        if (error instanceof Error && 'status' in error && error.status === 401) return
        setSaveNotice(error instanceof Error ? `衣橱素材加载失败：${error.message}` : '衣橱素材加载失败')
      }
    }
    void loadWardrobeAssets()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void cdpcApi.listProjects().then(items => { if (!cancelled) setProjects(items) }).catch(error => {
      if (!cancelled && !(error instanceof Error && 'status' in error && error.status === 401)) setSaveNotice(error instanceof Error ? `云端项目列表加载失败：${error.message}` : '云端项目列表加载失败')
    })
    return () => { cancelled = true }
  }, [])

  const availableItems = useMemo(() => {
    const merged = new Map<string, CatalogItem>()
    for (const item of catalog) merged.set(item.id, item)
    for (const item of wardrobeItems) merged.set(item.id, item)
    return [...merged.values()]
  }, [wardrobeItems])

  const filtered = useMemo(() => availableItems.filter(item =>
    (category === '全部' || item.category === category) &&
    (!showFavoritesOnly || favoriteIds.includes(item.id)) &&
    (item.name.toLowerCase().includes(query.trim().toLowerCase()) || item.category.includes(query.trim())),
  ), [availableItems, category, query, favoriteIds, showFavoritesOnly])
  const selectedItems = Object.values(selected)
  const cape = selected['披风']

  useEffect(() => {
    let cancelled = false
    const restoreWorkspaceAsset = async () => {
      try {
        const workspace = await cdpcApi.getWorkspace()
        const assetId = workspace.activeAssetId
        if (!assetId) return
        const asset = (await cdpcApi.listAssets({ ids: [assetId], limit: 1 })).items[0]
        if (cancelled || !asset?.fileUrl) return
        if (asset.category === 'SKIN') {
          setSkinUrl(asset.fileUrl)
          setSkinName(asset.attribution || '衣橱皮肤')
          setSaveNotice('已从衣橱载入当前基础皮肤')
          return
        }
        const garmentCategory = fromAssetCategory(asset.category)
        if (!garmentCategory) return
        const item: CatalogItem = {
          id: asset.id,
          assetId: asset.id,
          fileUrl: asset.fileUrl,
          texture: asset.fileUrl,
          name: typeof asset.name === 'string' && asset.name.trim() ? asset.name : `云端${garmentCategory}素材`,
          category: garmentCategory,
          note: '从衣橱载入的云端素材',
          attribution: asset.attribution,
          source: asset.source,
          visibility: asset.visibility,
          provenance: asset.provenance,
          downloadPolicy: asset.downloadPolicy,
          canDownload: asset.canDownload === true,
        }
        setSelected(current => ({ ...current, [garmentCategory]: item }))
        setSaveNotice(`已从衣橱载入${garmentCategory}素材`)
      } catch (error) {
        if (cancelled) return
        setSaveNotice(error instanceof Error ? error.message : '衣橱素材恢复失败')
      }
    }
    void restoreWorkspaceAsset()
    return () => { cancelled = true }
  }, [])

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
      viewer.controls.autoRotate = false
      viewer.controls.autoRotateSpeed = 1.25
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
    const host = singleItemPreviewHost.current
    const item = singlePreviewItem
    if (!host || !item) return

    let viewer: SkinViewer
    let cancelled = false
    try {
      const canvas = document.createElement('canvas')
      viewer = new SkinViewer({
        canvas,
        width: Math.max(host.clientWidth, 240),
        height: 240,
        enableControls: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      })
      viewer.controls.enableDamping = true
      viewer.controls.enablePan = false
      viewer.controls.autoRotate = true
      viewer.controls.autoRotateSpeed = 1.6
      viewer.renderer.setClearColor(0x182437, 0)
      host.replaceChildren(canvas)
    } catch {
      host.textContent = '当前浏览器无法初始化单件 3D 预览（需要 WebGL）。'
      return
    }

    const makeTransparentSkinSurface = () => {
      viewer.playerObject.skin.traverse(object => {
        const mesh = object as unknown as { isMesh?: boolean; material?: unknown }
        if (!mesh.isMesh || !mesh.material) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const entry of materials) {
          const material = entry as { transparent: boolean; alphaTest: number; needsUpdate: boolean }
          material.transparent = true
          material.alphaTest = 0.001
          material.needsUpdate = true
        }
      })
    }

    const resize = () => {
      if (!cancelled && host.clientWidth) viewer.width = Math.max(host.clientWidth, 240)
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(host)
    window.addEventListener('resize', resize)

    void (async () => {
      try {
        if (item.category === '披风') {
          const transparentSkin = document.createElement('canvas')
          transparentSkin.width = 64
          transparentSkin.height = 64
          await viewer.loadSkin(transparentSkin, { model: model === 'alex' ? 'slim' : 'default' })
          if (cancelled) return
          makeTransparentSkinSurface()
          await viewer.loadCape(item.fileUrl || ASSET_ROOT + item.texture, { backEquipment: 'cape' })
        } else {
          if (item.category !== '披肩' && item.category !== '外套') {
            throw new Error(`尚未定义 ${item.category} 的真实 UV 布局，无法进行单件预览`)
          }
          const uvProfile = getStudioOverlayUvProfile(item.category)
          if (uvProfile.composition !== 'full-atlas-alpha') throw new Error('不支持的单件服装 UV 预览方式')
          const base = await loadImage(skinUrl)
          if (cancelled) return
          const baseError = validateStudioSkinTexture({ width: base.naturalWidth, height: base.naturalHeight }, 'base-skin')
          if (baseError) throw new Error(baseError)
          const textureName = item.fileUrl || ASSET_ROOT + selectStudioOverlayTexture(item, model, base.naturalWidth as 64 | 128)
          const overlay = await loadImage(textureName)
          if (cancelled) return
          const textureError = validateStudioOverlayMatchesBase(
            { width: base.naturalWidth, height: base.naturalHeight },
            { width: overlay.naturalWidth, height: overlay.naturalHeight },
          )
          if (textureError) throw new Error(textureError)
          // Render the source atlas directly on the 3D skin geometry with no
          // character skin underneath. Transparent pixels stay invisible, so
          // the user sees only the selected garment's mapped surfaces.
          await viewer.loadSkin(overlay, { model: model === 'alex' ? 'slim' : 'default' })
          if (cancelled) return
          makeTransparentSkinSurface()
          viewer.playerObject.backEquipment = null
        }
        if (!cancelled) viewer.controls.autoRotate = true
      } catch (error) {
        if (!cancelled) host.textContent = error instanceof Error ? `单件预览失败：${error.message}` : '单件预览失败，请检查素材文件。'
      }
    })()

    return () => {
      cancelled = true
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      viewer.dispose()
    }
  }, [singlePreviewItem, model])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.controls.autoRotate = autoRotate
  }, [autoRotate])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const url = SCENE_BACKGROUNDS[backgroundScene]
    if (!url) {
      viewer.background = Number.parseInt(background.replace('#', ''), 16)
      return
    }
    let cancelled = false
    void viewer.loadBackground(url).catch(() => {
      if (!cancelled) {
        viewer.background = Number.parseInt(background.replace('#', ''), 16)
        setSaveNotice('场景背景加载失败，已切换为纯色背景')
      }
    })
    return () => { cancelled = true }
  }, [backgroundScene, background])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // Use skinview3d's native animation classes. Replacing the animation
    // directly lets SkinViewer stop/reset the previous pose exactly once;
    // clearing to null in effect cleanup caused an unnecessary intermediate
    // reset during rapid pose changes.
    const animation =
      pose === 'fly' ? new FlyingAnimation()
        : pose === 'walk' ? new WalkingAnimation()
          : pose === 'run' ? new RunningAnimation()
            : pose === 'wave' ? new WaveAnimation()
              : pose === 'crouch' ? new CrouchAnimation()
                : pose === 'hit' ? new HitAnimation()
                  : pose === 'swim' ? new SwimAnimation()
                    : new IdleAnimation()

    animation.speed = pose === 'walk' ? 0.72 : pose === 'run' ? 1.45 : 1
    viewer.animation = animation
  }, [pose, cape?.id, elytraVisible])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.playerObject.backEquipment = elytraVisible ? 'elytra' : cape ? 'cape' : null
  }, [elytraVisible, cape?.id])

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
        if (cancelled) return
        const baseError = validateStudioSkinTexture({ width: base.naturalWidth, height: base.naturalHeight }, 'base-skin')
        if (baseError) throw new Error(baseError)
        const textureSize = base.naturalWidth
        const canvas = document.createElement('canvas')
        canvas.width = textureSize
        canvas.height = textureSize
        const context = canvas.getContext('2d')
        if (!context) throw new Error('无法创建皮肤画布')
        context.imageSmoothingEnabled = false
        context.drawImage(base, 0, 0, textureSize, textureSize)
        for (const item of selectedItems.filter(item => item.category !== '披风')) {
          if (item.category !== '披肩' && item.category !== '外套') {
            throw new Error(`尚未定义 ${item.category} 的真实 UV 布局，已停止合成`)
          }
          const uvProfile = getStudioOverlayUvProfile(item.category)
          if (uvProfile.composition !== 'full-atlas-alpha') throw new Error('不支持的服装 UV 合成方式')
          const textureName = item.fileUrl || ASSET_ROOT + selectStudioOverlayTexture(item, model, textureSize as 64 | 128)
          const overlay = await loadImage(textureName)
          if (cancelled) return
          const overlayError = validateStudioOverlayMatchesBase(
            { width: base.naturalWidth, height: base.naturalHeight },
            { width: overlay.naturalWidth, height: overlay.naturalHeight },
          )
          if (overlayError) throw new Error(`${item.name}：${overlayError}`)
          // These source PNGs are already authored as complete Minecraft skin UV
          // atlases. Composite the full alpha map; clipping every category to the
          // same guessed rectangles corrupts the category-specific UV artwork.
          context.drawImage(overlay, 0, 0, textureSize, textureSize)
        }
        await viewer.loadSkin(canvas, { model: model === 'alex' ? 'slim' : 'default' })
        if (cancelled) return
        if (cape) {
          await viewer.loadCape(cape.fileUrl || ASSET_ROOT + cape.texture, { makeVisible: false })
          if (cancelled) return
          viewer.playerObject.backEquipment = elytraVisible ? 'elytra' : 'cape'
        } else {
          viewer.playerObject.backEquipment = elytraVisible ? 'elytra' : null
        }
        if (cancelled) return
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
  }, [skinUrl, model, selected, retryVersion])

  function toggleItem(item: CatalogItem) {
    setSelected(current => {
      const next = { ...current }
      if (next[item.category]?.id === item.id) delete next[item.category]
      else {
        // Shawl and coat use separate authored skin atlases, but overlap on the
        // same Minecraft body surfaces. Enforce the tested compatibility profile.
        if (item.category === '披肩' || item.category === '外套') {
          const incoming = item.category as StudioOverlayCategory
          const equipped = Object.keys(next).filter(key => key === '披肩' || key === '外套') as StudioOverlayCategory[]
          if (!canEquipStudioOverlayTogether(equipped, incoming)) {
            delete next[getStudioOverlayUvProfile(incoming).mutuallyExclusiveWith]
          }
        }
        next[item.category] = item
      }
      return next
    })
  }


  async function uploadAssetFromUrl(url: string, category: 'SKIN' | 'SHAWL' | 'COAT' | 'CAPE', name: string) {
    const imageResponse = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
    if (!imageResponse.ok) throw new Error(`无法读取素材：${name}`)
    const blob = await imageResponse.blob()
    if (blob.type !== 'image/png') throw new Error(`素材“${name}”不是 PNG 格式`)
    if (category !== 'CAPE') {
      const bitmap = await createImageBitmap(blob)
      try {
        const role = category === 'SKIN' ? 'base-skin' : 'clothing-overlay'
        const textureError = validateStudioSkinTexture({ width: bitmap.width, height: bitmap.height }, role)
        if (textureError) throw new Error(`素材“${name}”：${textureError}`)
      } finally {
        bitmap.close()
      }
    }
    const file = new File([blob], `${category.toLowerCase()}-${Date.now()}.png`, { type: 'image/png' })
    const asset = await cdpcApi.uploadAsset(file, category, {
      visibility: 'PRIVATE',
      name,
    })
    return { id: asset.id, fileUrl: asset.fileUrl }
  }

  async function saveOutfitToCloud() {
    const name = outfitName.trim().slice(0, 80)
    if (!name) {
      setSaveNotice('请先填写穿搭名称')
      return
    }
    if (savingCloud) return
    setSavingCloud(true)
    setSaveNotice('正在同步素材并保存账号云端穿搭…')
    try {
      const persistedItems: CatalogItem[] = []
      const saveBaseSkin = await loadImage(skinUrl)
      const saveBaseError = validateStudioSkinTexture(
        { width: saveBaseSkin.naturalWidth, height: saveBaseSkin.naturalHeight },
        'base-skin',
      )
      if (saveBaseError) throw new Error(saveBaseError)
      const saveTextureSize = saveBaseSkin.naturalWidth as 64 | 128
      for (const item of selectedItems) {
        if (item.assetId && item.fileUrl) {
          persistedItems.push(item)
          continue
        }
        const textureName = item.category === '披风'
          ? item.texture
          : selectStudioOverlayTexture(item, model, saveTextureSize)
        const sourceUrl = item.fileUrl || ASSET_ROOT + textureName
        const asset = await uploadAssetFromUrl(sourceUrl, toAssetCategory(item.category), item.name)
        const persisted = { ...item, assetId: asset.id, fileUrl: asset.fileUrl }
        persistedItems.push(persisted)
        setSelected(current => ({ ...current, [item.category]: persisted }))
      }

      let skinAssetId: string | null = null
      let skinAssetUrl: string | undefined
      const existingSkin = /\/api\/assets\/([^/]+)\/file(?:\?|$)/.exec(skinUrl)
      if (existingSkin) {
        skinAssetId = existingSkin[1]
        skinAssetUrl = skinUrl
      } else if (skinUrl.startsWith('data:image/png')) {
        const skin = await uploadAssetFromUrl(skinUrl, 'SKIN', skinName || '换装基础皮肤')
        skinAssetId = skin.id
        skinAssetUrl = skin.fileUrl
      }

      const input: OutfitInput = {
        name,
        skinAssetId,
        skinModel: model === 'alex' ? 'SLIM' : 'CLASSIC',
        background,
        pose,
        items: persistedItems.map((item, index) => ({
          assetId: item.assetId!,
          category: toAssetCategory(item.category),
          sortOrder: index,
          equipped: true,
        })),
      }
      const existingCloud = savedOutfits.find(item => item.id === selectedSavedOutfitId && item.cloud)
      const saved = existingCloud
        ? await cdpcApi.updateOutfit(existingCloud.id, input)
        : await cdpcApi.createOutfit(input)
      const savedId = saved.id

      // The outfit record is authoritative. A workspace-pointer failure must not
      // turn a successful cloud save into a reported save failure.
      let workspaceSyncFailed = false
      try {
        const workspace = await cdpcApi.getWorkspace()
        await cdpcApi.updateWorkspace(buildStudioWorkspaceState(workspace, savedId, skinAssetId))
      } catch {
        workspaceSyncFailed = true
      }

      setSelectedSavedOutfitId(savedId)
      setOutfitName(name)
      setSelected(current => persistedItems.reduce((next, item) => ({ ...next, [item.category]: item }), current))
      const localCache: LocalOutfit = {
        id: savedId, name, itemIds: persistedItems.map(item => item.id), model, pose, background,
        skinUrl: skinUrl.startsWith('data:image/png') ? skinUrl : undefined,
        skinAssetId, skinAssetUrl, skinName, savedAt: new Date().toISOString(), cloud: true,
        assetItems: persistedItems,
      }
      setSavedOutfits(current => [...current.filter(item => item.id !== savedId), localCache])
      try { window.localStorage.setItem('cdpc:dress-up:local-v1', JSON.stringify(localCache)) } catch { /* Cloud save remains authoritative. */ }
      setSaveNotice(workspaceSyncFailed
        ? `“${name}”已保存到账号云端，但工作区指针同步失败；可在已保存穿搭中重新载入`
        : `“${name}”已保存到账号云端，衣橱可在其他设备读取`)
      void refreshCloudOutfits().catch(() => undefined)
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : '云端保存失败，请登录后重试')
    } finally {
      setSavingCloud(false)
    }
  }

  async function saveStudioProject() {
    const title = outfitName.trim().slice(0, 80)
    if (!title) { setSaveNotice('请先填写项目名称'); return }
    if (savingProject) return
    setSavingProject(true); setSaveNotice('正在整理素材并保存完整创作项目…')
    try {
      const base = await loadImage(skinUrl)
      const invalid = validateStudioSkinTexture({ width: base.naturalWidth, height: base.naturalHeight }, 'base-skin')
      if (invalid) throw new Error(invalid)
      const size = base.naturalWidth as 64 | 128
      const persisted: CatalogItem[] = []
      for (const item of selectedItems) {
        if (item.assetId && item.fileUrl) { persisted.push(item); continue }
        const filename = item.category === '披风' ? item.texture : selectStudioOverlayTexture(item, model, size)
        const uploaded = await uploadAssetFromUrl(item.fileUrl || ASSET_ROOT + filename, toAssetCategory(item.category), item.name)
        persisted.push({ ...item, assetId: uploaded.id, fileUrl: uploaded.fileUrl })
      }
      let skinAssetId = /\/api\/assets\/([^/]+)\/file(?:\?|$)/.exec(skinUrl)?.[1] ?? null
      if (!skinAssetId && skinUrl.startsWith('data:image/png')) skinAssetId = (await uploadAssetFromUrl(skinUrl, 'SKIN', skinName || '创作项目基础皮肤')).id
      const assetIds = [...new Set([...persisted.map(item => item.assetId).filter((id): id is string => Boolean(id)), ...(skinAssetId ? [skinAssetId] : [])])]
      const document = {
        format: 'cdpc-studio-project', version: 1,
        workspace: { activeTool: 'WARDROBE', model, pose, background, backgroundScene, skinName },
        outfit: { name: title, itemAssetIds: persisted.map(item => item.assetId), skinAssetId },
      }
      const input: ProjectInput = { title, description: 'CDPC 角色换装与创作项目', visibility: 'PRIVATE', document, assetIds }
      const saved = selectedProjectId ? await cdpcApi.updateProject(selectedProjectId, input, selectedProjectRevision) : await cdpcApi.createProject(input)
      setSelectedProjectId(saved.id); setSelectedProjectRevision(saved.revision)
      setProjects(current => [saved, ...current.filter(item => item.id !== saved.id)])
      setSelected(current => persisted.reduce<Record<string, CatalogItem>>((next, item) => ({ ...next, [item.category]: item }), current))
      setSaveNotice(`“${title}”已保存为账号云端项目（版本 ${saved.revision}）；项目素材已绑定，可在其他设备恢复。`)
    } catch (error) { setSaveNotice(error instanceof Error ? `项目保存失败：${error.message}` : '项目保存失败，请登录后重试') }
    finally { setSavingProject(false) }
  }

  async function loadStudioProject() {
    if (!selectedProjectId) { setSaveNotice('请先选择一个云端项目'); return }
    try {
      setSaveNotice('正在从账号云端恢复创作项目…')
      const project = await cdpcApi.getProject(selectedProjectId), doc = project.document
      if (doc.format !== 'cdpc-studio-project' || doc.version !== 1 || !doc.workspace || typeof doc.workspace !== 'object' || !doc.outfit || typeof doc.outfit !== 'object') throw new Error('项目文档格式或版本不受支持')
      const workspace = doc.workspace as Record<string, unknown>, outfit = doc.outfit as Record<string, unknown>
      const itemIds = Array.isArray(outfit.itemAssetIds) ? outfit.itemAssetIds.filter((id): id is string => typeof id === 'string') : []
      const skinId = typeof outfit.skinAssetId === 'string' ? outfit.skinAssetId : null
      const ids = [...new Set([...itemIds, ...(skinId ? [skinId] : [])])]
      const assets = ids.length ? (await cdpcApi.listAssets({ ids, limit: 100 })).items : []
      const byId = new Map(assets.map(asset => [asset.id, asset])), restored: Record<string, CatalogItem> = {}
      for (const id of itemIds) {
        const asset = byId.get(id), cat = fromAssetCategory(asset?.category ?? null)
        if (!asset?.fileUrl || !cat) continue
        restored[cat] = { id: asset.id, assetId: asset.id, fileUrl: asset.fileUrl, texture: asset.fileUrl, name: asset.name || `云端${cat}素材`, category: cat, note: '云端项目素材', attribution: asset.attribution, source: asset.source, visibility: asset.visibility, provenance: asset.provenance, downloadPolicy: asset.downloadPolicy, canDownload: asset.canDownload }
      }
      const skin = skinId ? byId.get(skinId) : null
      if (skinId && (!skin || skin.category !== 'SKIN')) throw new Error('项目基础皮肤不存在或无权访问')
      setSelected(restored); setSkinUrl(skin?.fileUrl || BASE_SKIN)
      setSkinName(typeof workspace.skinName === 'string' ? workspace.skinName : skin?.name || 'Steve 默认皮肤')
      setModel(workspace.model === 'alex' ? 'alex' : 'steve'); setPose(normalizeStudioPose(workspace.pose))
      if (typeof workspace.background === 'string' && /^#[0-9a-f]{6}$/i.test(workspace.background)) setBackground(workspace.background)
      const scenes = ['day','night','plains','desert','forest','nether','end','custom']
      setBackgroundScene(typeof workspace.backgroundScene === 'string' && scenes.includes(workspace.backgroundScene) ? workspace.backgroundScene : 'custom')
      setOutfitName(typeof outfit.name === 'string' ? outfit.name : project.title); setSelectedProjectRevision(project.revision)
      const pointer = await cdpcApi.getWorkspace()
      await cdpcApi.updateWorkspace({ ...pointer, projectId: project.id, activeTool: 'WARDROBE' })
      setSaveNotice(`已恢复云端项目“${project.title}”（版本 ${project.revision}）`)
    } catch (error) { setSaveNotice(error instanceof Error ? `项目恢复失败：${error.message}` : '项目恢复失败，请稍后重试') }
  }

  function saveLocalOutfit() {
    const name = outfitName.trim().slice(0, 48)
    if (!name) {
      setSaveNotice('请先填写穿搭名称')
      return
    }
    const selectedOutfit = savedOutfits.find(item => item.id === selectedSavedOutfitId && !item.cloud)
    const id = selectedOutfit?.id || `local-${Date.now()}`
    const outfit: LocalOutfit = {
      id,
      name,
      itemIds: selectedItems.map(item => item.id),
      model,
      pose,
      background,
      backgroundScene,
      skinUrl: skinUrl.startsWith('data:image/png') ? skinUrl : undefined,
      skinAssetId: /\/api\/assets\/([^/]+)\/file(?:\?|$)/.exec(skinUrl)?.[1] ?? null,
      skinAssetUrl: /\/api\/assets\/([^/]+)\/file(?:\?|$)/.test(skinUrl) ? skinUrl : undefined,
      skinName,
      savedAt: new Date().toISOString(),
      assetItems: selectedItems.filter(item => Boolean(item.assetId && item.fileUrl) && item.provenance !== 'OFFICIAL'),
    }
    try {
      const next = selectedOutfit
        ? savedOutfits.map(item => item.id === selectedOutfit.id ? outfit : item)
        : [...savedOutfits, outfit]
      setSelectedSavedOutfitId(id)
      window.localStorage.setItem('cdpc:dress-up:outfits-v1', JSON.stringify(next.filter(item => !item.cloud)))
      window.localStorage.setItem('cdpc:dress-up:local-v1', JSON.stringify(outfit))
      setSavedOutfits(next)
      setOutfitName(name)
      setSaveNotice(`“${name}”已保存到此设备；此数据不会自动同步到其他设备`)
    } catch {
      setSaveNotice('保存失败：浏览器存储空间可能不足，尤其是导入的皮肤图片较大时')
    }
  }

  function loadSavedOutfit() {
    const outfit = savedOutfits.find(item => item.id === selectedSavedOutfitId)
    if (!outfit) {
      setSaveNotice('请选择一套已保存的穿搭')
      return
    }
    if (outfit.cloud && outfit.assetItems) {
      setSelected(outfit.assetItems.reduce<Record<string, CatalogItem>>((items, item) => {
        items[item.category] = item
        return items
      }, {}))
      setSkinUrl(outfit.skinAssetUrl || BASE_SKIN)
      setSkinName(outfit.skinName || 'Steve 默认皮肤')
    } else {
      const savedAssets = Array.isArray(outfit.assetItems) ? outfit.assetItems : []
      setSelected((outfit.itemIds ?? []).reduce<Record<string, CatalogItem>>((items, id) => {
        const item = savedAssets.find(entry => entry.id === id) || catalog.find(entry => entry.id === id)
        if (item) items[item.category] = item
        return items
      }, {}))
      if (typeof outfit.skinAssetUrl === 'string') setSkinUrl(outfit.skinAssetUrl)
      else if (typeof outfit.skinUrl === 'string' && outfit.skinUrl.startsWith('data:image/png')) setSkinUrl(outfit.skinUrl)
      else setSkinUrl(BASE_SKIN)
      if (typeof outfit.skinName === 'string') setSkinName(outfit.skinName)
    }
    if (outfit.model === 'steve' || outfit.model === 'alex') setModel(outfit.model)
    setPose(normalizeStudioPose(outfit.pose))
    if (/^#[0-9a-f]{6}$/i.test(outfit.background)) setBackground(outfit.background)
    if (outfit.backgroundScene === 'day' || outfit.backgroundScene === 'night' || outfit.backgroundScene === 'plains' || outfit.backgroundScene === 'desert' || outfit.backgroundScene === 'forest' || outfit.backgroundScene === 'nether' || outfit.backgroundScene === 'end' || outfit.backgroundScene === 'custom') setBackgroundScene(outfit.backgroundScene)
    else setBackgroundScene('custom')
    setOutfitName(outfit.name)
    setSaveNotice(outfit.cloud ? `已从账号云端载入“${outfit.name}”` : `已载入本地草稿“${outfit.name}”`)
    if (outfit.cloud) {
      void cdpcApi.getWorkspace().then(workspace => cdpcApi.updateWorkspace({
        projectId: workspace.projectId ?? null,
        activeTool: 'WARDROBE',
        activeAssetId: outfit.skinAssetId ?? null,
        activeOutfitId: outfit.id,
      })).catch(() => undefined)
    }
  }

  async function deleteSavedOutfit() {
    const outfit = savedOutfits.find(item => item.id === selectedSavedOutfitId)
    if (!outfit) {
      setSaveNotice('请选择要删除的穿搭')
      return
    }
    if (!window.confirm(`确定删除“${outfit.name}”吗？此操作无法撤销。`)) return
    if (outfit.cloud) {
      try {
        await cdpcApi.deleteOutfit(outfit.id)
      } catch (error) {
        setSaveNotice(error instanceof Error ? `云端删除失败：${error.message}` : '云端穿搭删除失败；当前记录未从列表移除')
        return
      }
      setSavedOutfits(current => current.filter(item => item.id !== outfit.id))
      setSelectedSavedOutfitId('')
      setOutfitName('我的穿搭')
      let workspaceSyncFailed = false
      try {
        const workspace = await cdpcApi.getWorkspace()
        if (workspace.activeOutfitId === outfit.id) {
          await cdpcApi.updateWorkspace({
            projectId: workspace.projectId ?? null,
            activeTool: 'WARDROBE',
            activeAssetId: workspace.activeAssetId ?? null,
            activeOutfitId: null,
          })
        }
      } catch {
        workspaceSyncFailed = true
      }
      try {
        const raw = window.localStorage.getItem('cdpc:dress-up:local-v1')
        if (raw && (JSON.parse(raw) as Partial<LocalOutfit>).id === outfit.id) {
          window.localStorage.removeItem('cdpc:dress-up:local-v1')
        }
      } catch { /* Cloud deletion succeeded; a stale local cache is non-authoritative. */ }
      setSaveNotice(workspaceSyncFailed
        ? `“${outfit.name}”已从云端删除，但工作区指针同步失败；请重新载入衣橱状态`
        : `已从账号云端删除“${outfit.name}”`)
      return
    }
    const next = savedOutfits.filter(item => item.id !== selectedSavedOutfitId)
    try {
      window.localStorage.setItem('cdpc:dress-up:outfits-v1', JSON.stringify(next.filter(item => !item.cloud)))
      setSavedOutfits(next)
      setSelectedSavedOutfitId('')
      setOutfitName('我的穿搭')
      setSaveNotice(`已删除本地草稿“${outfit.name}”`)
    } catch {
      setSaveNotice('删除失败，请刷新页面后重试')
    }
  }

  function restoreLastSavedOutfit() {
    try {
      const raw = window.localStorage.getItem('cdpc:dress-up:local-v1')
      if (!raw) {
        setSaveNotice('此设备还没有保存过穿搭')
        return
      }
      const saved = JSON.parse(raw) as Partial<LocalOutfit>
      if (typeof saved.name === 'string' && saved.name.trim()) setOutfitName(saved.name.slice(0, 48))
      if (typeof saved.id === 'string') setSelectedSavedOutfitId(saved.id)
      const savedAssets = Array.isArray(saved.assetItems) ? saved.assetItems : []
      setSelected((saved.itemIds ?? []).reduce<Record<string, CatalogItem>>((items, id) => {
        const item = savedAssets.find(entry => entry.id === id) || catalog.find(entry => entry.id === id)
        if (item) items[item.category] = item
        return items
      }, {}))
      if (saved.model === 'steve' || saved.model === 'alex') setModel(saved.model)
      if (typeof saved.background === 'string' && /^#[0-9a-f]{6}$/i.test(saved.background)) setBackground(saved.background)
      if (saved.backgroundScene === 'day' || saved.backgroundScene === 'night' || saved.backgroundScene === 'plains' || saved.backgroundScene === 'desert' || saved.backgroundScene === 'forest' || saved.backgroundScene === 'nether' || saved.backgroundScene === 'end' || saved.backgroundScene === 'custom') setBackgroundScene(saved.backgroundScene)
      else setBackgroundScene('custom')
      if (typeof saved.skinAssetUrl === 'string') setSkinUrl(saved.skinAssetUrl)
      else if (typeof saved.skinUrl === 'string' && saved.skinUrl.startsWith('data:image/png')) setSkinUrl(saved.skinUrl)
      if (typeof saved.skinName === 'string') setSkinName(saved.skinName)
      setSaveNotice('已恢复最近保存的本地穿搭')
    } catch {
      setSaveNotice('无法读取本地穿搭，请重新保存')
    }
  }

  function exportOutfitBackup() {
    const payload: LocalOutfit = {
      id: `outfit-${Date.now()}`,
      name: outfitName.trim().slice(0, 48) || '我的穿搭',
      itemIds: selectedItems.map(item => item.id),
      model,
      pose,
      background,
      backgroundScene,
      skinUrl: skinUrl.startsWith('data:image/png') ? skinUrl : undefined,
      skinAssetId: /\/api\/assets\/([^/]+)\/file(?:\?|$)/.exec(skinUrl)?.[1] ?? null,
      skinAssetUrl: /\/api\/assets\/([^/]+)\/file(?:\?|$)/.test(skinUrl) ? skinUrl : undefined,
      skinName,
      savedAt: new Date().toISOString(),
      assetItems: selectedItems.filter(item => Boolean(item.assetId && item.fileUrl) && item.provenance !== 'OFFICIAL'),
    }
    const blob = new Blob([JSON.stringify({ format: 'cdpc-outfit', version: 1, outfit: payload }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cdpc-outfit-backup.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setSaveNotice('穿搭备份 JSON 已导出。若包含导入的皮肤图片，文件可能较大；备份保存在你的设备中。')
  }


  async function importOutfitBackup(file?: File) {
    if (!file) return
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error('备份文件超过 12 MB，请检查文件是否正确')
      const parsed = JSON.parse(await file.text()) as { format?: string; version?: number; outfit?: Partial<LocalOutfit> }
      const outfit = parsed.outfit
      if (parsed.format !== 'cdpc-outfit' || parsed.version !== 1 || !outfit || !Array.isArray(outfit.itemIds)) {
        throw new Error('文件格式不正确或版本不受支持')
      }
      const backupAssets = normalizeOutfitBackupAssets(outfit.assetItems)
      const backupIds = new Set(backupAssets.map(item => item.id))
      const itemIds = outfit.itemIds.filter((id): id is string => typeof id === 'string' && (catalog.some(item => item.id === id) || backupIds.has(id)))
      const nextSkinUrl = typeof outfit.skinUrl === 'string' && outfit.skinUrl.startsWith('data:image/png;base64,') ? outfit.skinUrl : undefined
      let nextSkinAssetUrl = normalizeOutfitBackupSkinUrl(outfit.skinAssetUrl)
      let skinAssetUnavailable = false
      if (nextSkinUrl) {
        const image = await loadImage(nextSkinUrl)
        const textureError = validateStudioSkinTexture({ width: image.naturalWidth, height: image.naturalHeight }, 'base-skin')
        if (textureError) throw new Error(`备份中的皮肤无效：${textureError}`)
      } else if (nextSkinAssetUrl) {
        try { await loadImage(nextSkinAssetUrl) } catch {
          nextSkinAssetUrl = undefined
          skinAssetUnavailable = true
        }
      }
      const restored: LocalOutfit = {
        id: `outfit-${Date.now()}`,
        name: (typeof outfit.name === 'string' ? outfit.name.trim().slice(0, 48) : '') || '导入的穿搭',
        itemIds,
        model: outfit.model === 'alex' ? 'alex' : 'steve',
        pose: normalizeStudioPose(outfit.pose),
        background: typeof outfit.background === 'string' && /^#[0-9a-f]{6}$/i.test(outfit.background) ? outfit.background : '#182437',
        backgroundScene: outfit.backgroundScene === 'day' || outfit.backgroundScene === 'night' || outfit.backgroundScene === 'plains' || outfit.backgroundScene === 'desert' || outfit.backgroundScene === 'forest' || outfit.backgroundScene === 'nether' || outfit.backgroundScene === 'end' ? outfit.backgroundScene : 'custom',
        skinUrl: nextSkinUrl,
        skinAssetId: typeof outfit.skinAssetId === 'string' ? outfit.skinAssetId : null,
        skinAssetUrl: nextSkinAssetUrl,
        skinName: typeof outfit.skinName === 'string' ? outfit.skinName.slice(0, 160) : '导入的皮肤',
        savedAt: new Date().toISOString(),
        assetItems: backupAssets as CatalogItem[],
      }
      const next = [...savedOutfits, restored]
      window.localStorage.setItem('cdpc:dress-up:outfits-v1', JSON.stringify(next))
      window.localStorage.setItem('cdpc:dress-up:local-v1', JSON.stringify(restored))
      setSavedOutfits(next)
      setSelectedSavedOutfitId(restored.id)
      setOutfitName(restored.name)
      setSelected(itemIds.reduce<Record<string, CatalogItem>>((items, id) => {
        const item = backupAssets.find(entry => entry.id === id) || catalog.find(entry => entry.id === id)
        if (item) items[item.category] = item
        return items
      }, {}))
      setModel(restored.model)
      setPose(normalizeStudioPose(restored.pose))
      setBackgroundScene(restored.backgroundScene || 'custom')
      setBackground(restored.background)
      setSkinUrl(restored.skinAssetUrl || restored.skinUrl || BASE_SKIN)
      setSkinName(restored.skinAssetUrl || restored.skinUrl ? restored.skinName : 'Steve 默认皮肤')
      setSaveNotice(restored.skinAssetUrl || restored.skinUrl
        ? `已导入“${restored.name}”，并保存到此设备`
        : skinAssetUnavailable
          ? `已导入“${restored.name}”，但备份引用的云端皮肤当前不可访问，已使用默认皮肤。`
          : `已导入“${restored.name}”。备份未包含可迁移的皮肤 PNG，已使用默认皮肤；如需保留自定义皮肤，请先导入 64 × 64 PNG 后重新备份。`)
    } catch (error) {
      setSaveNotice(error instanceof Error ? `导入失败：${error.message}` : '导入失败，请选择有效的 CDPC JSON 备份')
    }
  }

  async function exportSkinPng() {
    try {
      setIsBusy(true)
      const base = await loadImage(skinUrl)
      const baseError = validateStudioSkinTexture({ width: base.naturalWidth, height: base.naturalHeight }, 'base-skin')
      if (baseError) throw new Error(baseError)
      const textureSize = base.naturalWidth as 64 | 128
      setSaveNotice(`正在合成 ${textureSize} × ${textureSize} 皮肤 PNG…`)
      const canvas = document.createElement('canvas')
      canvas.width = textureSize
      canvas.height = textureSize
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法创建导出画布')
      context.imageSmoothingEnabled = false
      context.drawImage(base, 0, 0, textureSize, textureSize)
      for (const item of selectedItems.filter(entry => entry.category !== '披风')) {
        if (item.category !== '披肩' && item.category !== '外套') {
          throw new Error(`尚未定义 ${item.category} 的真实 UV 布局，无法导出`)
        }
        const uvProfile = getStudioOverlayUvProfile(item.category)
        if (uvProfile.composition !== 'full-atlas-alpha') throw new Error('不支持的服装 UV 导出方式')
        const textureName = item.fileUrl || ASSET_ROOT + selectStudioOverlayTexture(item, model, textureSize)
        const overlay = await loadImage(textureName)
        const overlayError = validateStudioOverlayMatchesBase(
          { width: base.naturalWidth, height: base.naturalHeight },
          { width: overlay.naturalWidth, height: overlay.naturalHeight },
        )
        if (overlayError) throw new Error(`${item.name}：${overlayError}`)
        // Export the complete, pre-mapped category UV atlas with its alpha channel.
        context.drawImage(overlay, 0, 0)
      }
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob)
          else reject(new Error('无法生成 PNG 文件'))
        }, 'image/png')
      })
      const objectUrl = URL.createObjectURL(pngBlob)
      const link = document.createElement('a')
      link.download = `cdpc-skin-${textureSize}x${textureSize}.png`
      link.href = objectUrl
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      // Keep the anchor mounted through the browser's download dispatch.
      window.setTimeout(() => link.remove(), 0)
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
      setSaveNotice(cape
        ? '标准皮肤 PNG 已导出。注意：披风是独立背部装备，不包含在标准皮肤 PNG 中。'
        : `标准皮肤 PNG 已导出（${textureSize} × ${textureSize}）。`)
    } catch (error) {
      setSaveNotice(error instanceof Error ? `导出失败：${error.message}` : '导出失败，请稍后重试')
    } finally {
      setIsBusy(false)
    }
  }

  function resetToDefault() {
    const viewer = viewerRef.current
    viewer?.playerObject.rotation.set(0, 0, 0)
    viewer?.controls.reset()
    setSelectedSavedOutfitId('')
    setOutfitName('我的穿搭')
    setSelected({})
    setModel('steve')
    setSkinUrl(BASE_SKIN)
    setSkinName('Steve 默认皮肤')
    setBackground('#182437')
    setBackgroundScene('night')
    setPose('idle')
    setElytraVisible(false)
    setAutoRotate(false)
    setViewAngle('front')
    setSaveNotice('已恢复默认角色状态；此前保存的本地穿搭不会被删除')
  }

  function downloadCapeAsset(item: CatalogItem) {
    if (item.category !== '披风' || !item.assetId || item.canDownload !== true) {
      setSaveNotice('该披风素材没有可用的下载授权；官方或未授权素材仅可在平台内预览。')
      return
    }
    const link = document.createElement('a')
    link.href = `/api/assets/${encodeURIComponent(item.assetId)}/download`
    link.download = `${item.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'cdpc-cape'}.png`
    link.click()
    setSaveNotice('已请求下载你有权导出的独立披风 PNG。')
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

  function setPreviewView(angle: StudioView) {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.playerObject.rotation.y = angle === 'back' ? Math.PI : angle === 'side' ? Math.PI / 2 : 0
    setViewAngle(angle)
  }

  function resetPreviewCamera() {
    const viewer = viewerRef.current
    // The view selector is application state, not a side effect of WebGL
    // readiness. Always reset it so the control cannot remain stuck on
    // "back"/"side" while the viewer is mounting or recovering.
    setViewAngle('front')
    if (viewer) {
      viewer.playerObject.rotation.set(0, 0, 0)
      viewer.controls.reset()
      setSaveNotice('已重置角色视角')
      return
    }
    setSaveNotice('视角状态已重置；3D 预览正在初始化')
  }

  function removeCurrentCategory() {
    if (category === '全部') return
    if (!selected[category]) {
      setSaveNotice(`${category}分类当前没有穿戴素材`)
      return
    }
    setSelected(current => {
      const next = { ...current }
      delete next[category]
      return next
    })
    setSaveNotice(`已脱下当前${category}素材`)
  }

  function randomOutfit() {
    setSelectedSavedOutfitId('')
    setOutfitName('随机搭配 ' + new Date().toLocaleDateString())
    const next: Record<string, CatalogItem> = {}
    const upperBodyOptions = availableItems.filter(item => item.category === '披肩' || item.category === '外套')
    if (upperBodyOptions.length) {
      const item = upperBodyOptions[Math.floor(Math.random() * upperBodyOptions.length)]
      next[item.category] = item
    }
    const capeOptions = availableItems.filter(item => item.category === '披风')
    if (capeOptions.length) next['披风'] = capeOptions[Math.floor(Math.random() * capeOptions.length)]
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
        const textureError = validateStudioSkinTexture({ width: image.naturalWidth, height: image.naturalHeight }, 'base-skin')
        if (textureError) {
          setLoadError(`${textureError} 当前文件未应用。`)
          return
        }
        // Disable export in the same render that publishes the new skin name.
        // The preview effect runs after paint; without this, the UI can briefly
        // show the imported filename while the old preview is still exportable.
        setIsBusy(true)
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
    <main className="dressup-page" data-studio-mode="dress-up">
      <header className="dressup-heading">
        <div>
          <div className="dressup-eyebrow">CDPC / CHARACTER STYLE</div>
          <h1>角色穿搭</h1>
          <p>挑选喜欢的服装，实时看看角色的新造型。满意后保存搭配，或导出皮肤。</p>
        </div>
        <Link className="cdpc-button cdpc-button-quiet" href="/wardrobe">我的衣橱 ↗</Link>
      </header>

      <div className="dressup-layout">
        <section className="dressup-panel" aria-label="服装素材">
          <div className="dressup-panel-heading"><h2>挑选服装</h2><span>{filtered.length} 项</span></div>
          <div className="dressup-catalog-tools"><input className="dressup-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索服装名称…" aria-label="搜索服装" /><button type="button" className="dressup-favorites-filter" aria-pressed={showFavoritesOnly} onClick={() => setShowFavoritesOnly(value => !value)}>{showFavoritesOnly ? '显示全部素材' : `只看收藏 (${favoriteIds.length})`}</button></div>
          <div className="dressup-categories" aria-label="服装分类">
            {categories.map(item => <button type="button" className="dressup-category" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          {category !== '全部' && !availableCategories.has(category) && <div className="dressup-unavailable"><strong>{category}素材尚未接入</strong><p>目前正式素材目录尚未提供该分类的可用贴图，因此不会展示虚构素材。素材接入后会在这里出现。</p></div>}
          {singlePreviewItem && <section className="dressup-single-item-card" aria-label="单件素材独立渲染预览">
            <div className="dressup-panel-heading"><h3>单件 3D 预览</h3><button type="button" onClick={() => setSinglePreviewItem(null)}>关闭</button></div>
            <p className="dressup-preview-note">{singlePreviewItem.name} · 仅渲染该素材贴图对应的模型表面，不叠加基础皮肤</p>
            <div ref={singleItemPreviewHost} className="dressup-single-item-preview" />
          </section>}
          <div className="dressup-items">
            {filtered.map(item => <div className="dressup-item-wrap" key={item.id}>
              <button type="button" className="dressup-item" aria-pressed={selected[item.category]?.id === item.id} onClick={() => { setSinglePreviewItem(item); toggleItem(item) }}>
                <CatalogGarmentPreview item={item} model={model} skinUrl={skinUrl} />
                <strong>{item.name}</strong>
                <small>{item.category} · {item.note}</small>
                {(item.attribution || item.source || item.visibility) && <small className="dressup-item-provenance">作者/署名：{item.attribution || '未注明'} · 来源：{item.source || '未知'} · {item.visibility === 'PRIVATE' ? '私有素材' : item.visibility === 'PUBLIC' ? '公开素材' : item.visibility === 'UNLISTED' ? '未列出' : '权限未知'}</small>}
                <span className="dressup-item-state">{selected[item.category]?.id === item.id ? '已选择' : '点击试穿'}</span>
              </button>
              <button type="button" className="dressup-favorite-toggle" aria-label={favoriteIds.includes(item.id) ? '取消收藏 ' + item.name : '收藏 ' + item.name} aria-pressed={favoriteIds.includes(item.id)} onClick={() => toggleFavorite(item.id)}>{favoriteIds.includes(item.id) ? '★' : '☆'}</button>
            </div>)}
          </div>
          {filtered.length === 0 && category !== '全部' && availableCategories.has(category) && <p className="dressup-empty">该分类暂无匹配素材，请更换关键词。</p>}
          {filtered.length === 0 && category === '全部' && <p className="dressup-empty">没有找到匹配的素材。试试其他关键词。</p>}
          <div className="dressup-source-note">素材来自项目预设与账号衣橱；此处收藏为设备本地快捷收藏，账号素材的云端收藏请在我的衣橱管理。</div>
        </section>

        <section className="dressup-panel dressup-preview" aria-label="角色搭配预览">
          <div className="dressup-panel-heading"><h2>角色预览</h2><span className={loadError ? 'dressup-status is-error' : 'dressup-status'}>{isBusy ? '加载中' : status}</span></div>
          <div className="dressup-preview-tools">
            <div className="dressup-model-switch" role="group" aria-label="角色模型">
              <button type="button" aria-pressed={model === 'steve'} onClick={() => setModel('steve')}>Steve 粗臂</button>
              <button type="button" aria-pressed={model === 'alex'} onClick={() => setModel('alex')}>Alex 细臂</button>
            </div>
            <label className="dressup-background-control">纯色背景 <input type="color" value={background} onChange={event => { setBackgroundScene('custom'); setBackground(event.target.value) }} aria-label="预览背景颜色" /></label>
            <select aria-label="Minecraft 场景背景" value={backgroundScene} onChange={event => setBackgroundScene(event.target.value)}><option value="day">白天</option><option value="night">夜晚</option><option value="plains">平原</option><option value="desert">沙漠</option><option value="forest">森林</option><option value="nether">下界</option><option value="end">末地</option><option value="custom">自定义纯色</option></select>
          </div>
          <div className="dressup-preview-stage dressup-real-preview" ref={previewHost} />
          <div className="dressup-preview-tools dressup-bottom-tools" role="group" aria-label="角色动作与视角">
            <label className="dressup-preview-select">
              <span>动作</span>
              <select aria-label="切换角色动作" value={pose} onChange={event => setPose(event.target.value as StudioPose)}>
                <option value="idle">待机</option>
                <option value="walk">行走</option>
                <option value="run">奔跑</option>
                <option value="fly">飞行</option>
                <option value="wave">挥手</option>
                <option value="crouch">蹲下</option>
                <option value="hit">受击</option>
                <option value="swim">游泳</option>
              </select>
            </label>
            <label className="dressup-preview-select">
              <span>视角</span>
              <select aria-label="切换角色视角" value={viewAngle} onChange={event => setPreviewView(event.target.value as StudioView)}>
                <option value="front">正面</option>
                <option value="back">背面</option>
                <option value="side">侧面</option>
              </select>
            </label>
            <button type="button" aria-pressed={autoRotate} onClick={() => setAutoRotate(value => !value)}>{autoRotate ? '停止旋转' : '自动旋转'}</button>
            <button type="button" aria-pressed={elytraVisible} onClick={() => setElytraVisible(value => !value)}>{elytraVisible ? '显示披风' : '显示鞘翅'}</button>
          </div>
          <div className="dressup-preview-tools dressup-bottom-tools">
            <span className="dressup-skin-name" title={skinName}>当前皮肤：{skinName}</span>
            <button type="button" onClick={resetPreviewCamera}>重置视角</button>
            <button type="button" onClick={downloadPreviewScreenshot}>下载预览截图</button>
            <button type="button" onClick={() => skinFileRef.current?.click()}>导入 64×64 / 128×128 PNG</button>
            <input ref={skinFileRef} hidden type="file" accept="image/png,.png" onChange={event => importSkin(event.target.files?.[0])} />
          </div>
          {loadError && <div className="dressup-error" role="alert"><span>{loadError}</span><button type="button" onClick={() => { setLoadError(''); setRetryVersion(version => version + 1) }}>重试</button></div>}
          <p className="dressup-preview-note">拖动角色可旋转，滚轮可缩放。当前使用真实 3D 模型；已接入素材的贴图会合成到皮肤，披风单独作为背部装备加载。</p>
        </section>

        <aside className="dressup-panel" aria-label="当前穿搭">
          <div className="dressup-panel-heading"><h2>搭配清单</h2><span>{selectedItems.length} 件</span></div>
          {selectedItems.length ? <div className="dressup-selected-list">
            {selectedItems.map(item => <div className="dressup-selected-row" key={item.id}><span><small>{item.category}</small><strong>{item.name}</strong>{item.attribution && <small>作者/署名：{item.attribution}</small>}</span><div className="dressup-selected-row-actions"><button type="button" onClick={() => setSinglePreviewItem(item)}>独立预览</button>{item.category === '披风' && item.canDownload === true && <button type="button" onClick={() => downloadCapeAsset(item)}>导出披风 PNG</button>}<button type="button" onClick={() => toggleItem(item)}>移除</button></div></div>)}
          </div> : <p className="dressup-empty">还没有选择素材。点击左侧已接入的披肩、外套或披风开始搭配。</p>}
          <div className="dressup-actions dressup-primary-actions">
            <button type="button" onClick={removeCurrentCategory} disabled={category === '全部' || !selected[category]}>脱下当前分类</button>
            <button type="button" onClick={randomOutfit}>随机搭配</button>
            <button type="button" onClick={() => void saveOutfitToCloud()} disabled={savingCloud}>{savingCloud ? '云端保存中…' : '保存搭配'}</button>
            <button type="button" data-testid="studio-save-local-outfit" onClick={saveLocalOutfit}>保存本地草稿</button>
            <button type="button" className="primary" onClick={() => void exportSkinPng()} disabled={isBusy}>导出皮肤 PNG</button>
          </div>
          <details className="dressup-more-actions">
            <summary>更多操作与备份</summary>
            <div className="dressup-more-actions-grid">
              <button type="button" onClick={exportOutfitBackup}>导出穿搭备份 JSON</button>
              <button type="button" onClick={() => outfitFileRef.current?.click()}>导入穿搭备份 JSON</button>
              <input ref={outfitFileRef} hidden type="file" accept="application/json,.json" onChange={event => { void importOutfitBackup(event.target.files?.[0]); event.currentTarget.value = '' }} />
              <button type="button" onClick={restoreLastSavedOutfit}>恢复最近保存</button>
              <button type="button" onClick={resetToDefault}>恢复默认角色</button>
              <button type="button" onClick={() => setSelected({})} disabled={!selectedItems.length}>全部脱下</button>
              <button type="button" onClick={() => skinFileRef.current?.click()}>更换基础皮肤</button>
            </div>
          </details>
          <div className="dressup-outfit-manager">
            <label htmlFor="dressup-project-select">云端创作项目（{projects.length}）</label>
            <select id="dressup-project-select" value={selectedProjectId} onChange={event => {
              const id = event.target.value; setSelectedProjectId(id)
              const found = projects.find(project => project.id === id)
              setSelectedProjectRevision(found?.revision ?? 0)
              if (found) setOutfitName(found.title)
            }}>
              <option value="">新建项目 / 选择项目…</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.title} · v{project.revision}</option>)}
            </select>
            <div className="dressup-outfit-manager-actions">
              <button type="button" onClick={() => void saveStudioProject()} disabled={savingProject}>{savingProject ? '项目保存中…' : selectedProjectId ? '保存项目版本' : '保存为云端项目'}</button>
              <button type="button" onClick={() => void loadStudioProject()} disabled={!selectedProjectId || savingProject}>载入云端项目</button>
            </div>
          </div>
          <div className="dressup-outfit-manager">
            <label htmlFor="dressup-outfit-name">穿搭名称</label>
            <input id="dressup-outfit-name" value={outfitName} maxLength={48} onChange={event => setOutfitName(event.target.value)} placeholder="例如：夜行披风套装" />
            <label htmlFor="dressup-saved-outfit">已保存穿搭（{savedOutfits.length}）</label>
            <select id="dressup-saved-outfit" value={selectedSavedOutfitId} onChange={event => {
              setSelectedSavedOutfitId(event.target.value)
              const found = savedOutfits.find(item => item.id === event.target.value)
              if (found) setOutfitName(found.name)
            }}>
              <option value="">选择一套穿搭…</option>
              {savedOutfits.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <div className="dressup-outfit-manager-actions">
              <button type="button" data-testid="studio-load-saved-outfit" onClick={loadSavedOutfit} disabled={!selectedSavedOutfitId}>载入选择</button>
              <button type="button" onClick={deleteSavedOutfit} disabled={!selectedSavedOutfitId}>删除选择</button>
            </div>
          </div>
          {saveNotice && <p className="dressup-save-notice" role="status">{saveNotice}</p>}
          <p className="dressup-preview-note">账号云端穿搭会同步保存素材引用、皮肤模型与背景；本地草稿仅用于离线恢复。标准皮肤 PNG 导出不包含独立披风。</p>
        </aside>
      </div>
    </main>
  )
}
