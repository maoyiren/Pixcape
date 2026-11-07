'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cdpcApi, type OutfitInput } from '@/src/client/cdpc-api'
import { FlyingAnimation, IdleAnimation, SkinViewer, WalkingAnimation } from 'skinview3d'
import { validateStudioSkinTexture } from '@/src/domain/studio-texture'
import { buildStudioWorkspaceState, normalizeStudioPose, type StudioPose } from '@/src/domain/studio-outfit-state'

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
type CatalogItem = { id: string; name: string; category: GarmentCategory; texture: string; modelTexture?: string; note: string; assetId?: string; fileUrl?: string }
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
  const viewerRef = useRef<SkinViewer | null>(null)
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
  const [wardrobeItems, setWardrobeItems] = useState<CatalogItem[]>([])

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
          name: asset.attribution || `云端${category}`,
          category,
          note: '账号云端素材',
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
            name: asset.attribution || `我的${garmentCategory}`,
            category: garmentCategory,
            note: '我的衣橱素材',
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

  const availableItems = useMemo(() => {
    const merged = new Map<string, CatalogItem>()
    for (const item of catalog) merged.set(item.id, item)
    for (const item of wardrobeItems) merged.set(item.id, item)
    return [...merged.values()]
  }, [wardrobeItems])

  const filtered = useMemo(() => availableItems.filter(item =>
    (category === '全部' || item.category === category) &&
    (item.name.toLowerCase().includes(query.trim().toLowerCase()) || item.category.includes(query.trim())),
  ), [availableItems, category, query])
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
          name: asset.attribution || `云端${garmentCategory}`,
          category: garmentCategory,
          note: '从衣橱载入的云端素材',
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
    const animation = pose === 'fly' ? new FlyingAnimation() : pose === 'walk' ? new WalkingAnimation() : new IdleAnimation()
    if (pose === 'wave') {
      animation.addAnimation((player, progress) => {
        player.skin.rightArm.rotation.z = -2.35 + Math.sin(progress * 5) * 0.22
        player.skin.rightArm.rotation.x = Math.sin(progress * 3) * 0.12
      })
    }
    if (pose === 'fly' && cape && !elytraVisible) {
      animation.addAnimation((player, progress) => {
        player.cape.rotation.x = 0.35 + Math.sin(progress * 2.2) * 0.02
        player.cape.rotation.z = Math.sin(progress * 1.8) * 0.025
      })
    }
    animation.speed = pose === 'walk' ? 0.72 : 1
    viewer.animation = animation
    return () => { if (viewer.animation === animation) viewer.animation = null }
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
        const uvScale = textureSize / 64
        const canvas = document.createElement('canvas')
        canvas.width = textureSize
        canvas.height = textureSize
        const context = canvas.getContext('2d')
        if (!context) throw new Error('无法创建皮肤画布')
        context.imageSmoothingEnabled = false
        context.drawImage(base, 0, 0, textureSize, textureSize)
        for (const item of selectedItems.filter(item => item.category !== '披风')) {
          const textureName = model === 'alex' && item.modelTexture ? item.modelTexture : item.texture
          const overlay = await loadImage(item.fileUrl || ASSET_ROOT + textureName)
          if (cancelled) return
          const overlayError = validateStudioSkinTexture({ width: overlay.naturalWidth, height: overlay.naturalHeight }, 'clothing-overlay')
          if (overlayError) throw new Error(`${item.name}：${overlayError}`)
          context.save()
          context.beginPath()
          const uvRegions = [{ x: 16, y: 16, width: 24, height: 16 }, { x: 16, y: 32, width: 24, height: 16 }, { x: 40, y: 16, width: 16, height: 16 }, { x: 40, y: 32, width: 16, height: 16 }, { x: 32, y: 48, width: 16, height: 16 }, { x: 48, y: 48, width: 16, height: 16 }]
          uvRegions.forEach(region => context.rect(region.x * uvScale, region.y * uvScale, region.width * uvScale, region.height * uvScale))
          context.clip()
          context.drawImage(overlay, 0, 0, textureSize, textureSize)
          context.restore()
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
      else next[item.category] = item
      return next
    })
  }


  async function uploadAssetFromUrl(url: string, category: 'SKIN' | 'SHAWL' | 'COAT' | 'CAPE', attribution: string) {
    const imageResponse = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
    if (!imageResponse.ok) throw new Error(`无法读取素材：${attribution}`)
    const blob = await imageResponse.blob()
    if (blob.type !== 'image/png') throw new Error(`素材“${attribution}”不是 PNG 格式`)
    if (category !== 'CAPE') {
      const bitmap = await createImageBitmap(blob)
      try {
        const role = category === 'SKIN' ? 'base-skin' : 'clothing-overlay'
        const textureError = validateStudioSkinTexture({ width: bitmap.width, height: bitmap.height }, role)
        if (textureError) throw new Error(`素材“${attribution}”：${textureError}`)
      } finally {
        bitmap.close()
      }
    }
    const file = new File([blob], `${category.toLowerCase()}-${Date.now()}.png`, { type: 'image/png' })
    const asset = await cdpcApi.uploadAsset(file, category, {
      visibility: 'PRIVATE',
      attribution,
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
      for (const item of selectedItems) {
        if (item.assetId && item.fileUrl) {
          persistedItems.push(item)
          continue
        }
        const textureName = model === 'alex' && item.modelTexture ? item.modelTexture : item.texture
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
      assetItems: selectedItems.filter(item => Boolean(item.assetId && item.fileUrl)),
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
      background,
      backgroundScene,
      skinUrl: skinUrl.startsWith('data:image/png') ? skinUrl : undefined,
      skinAssetId: /\/api\/assets\/([^/]+)\/file(?:\?|$)/.exec(skinUrl)?.[1] ?? null,
      skinAssetUrl: /\/api\/assets\/([^/]+)\/file(?:\?|$)/.test(skinUrl) ? skinUrl : undefined,
      skinName,
      savedAt: new Date().toISOString(),
      assetItems: selectedItems.filter(item => Boolean(item.assetId && item.fileUrl)),
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
      const backupAssets = Array.isArray(outfit.assetItems) ? outfit.assetItems.filter(item => item && typeof item.id === 'string' && typeof item.fileUrl === 'string' && fromAssetCategory(item.category === '披肩' ? 'SHAWL' : item.category === '外套' ? 'COAT' : item.category === '披风' ? 'CAPE' : '') !== null) : []
      const backupIds = new Set(backupAssets.map(item => item.id))
      const itemIds = outfit.itemIds.filter((id): id is string => typeof id === 'string' && (catalog.some(item => item.id === id) || backupIds.has(id)))
      const nextSkinUrl = typeof outfit.skinUrl === 'string' && outfit.skinUrl.startsWith('data:image/png;base64,') ? outfit.skinUrl : undefined
      let nextSkinAssetUrl = typeof outfit.skinAssetUrl === 'string' && /\/api\/assets\/([^/]+)\/file(?:\?|$)/.test(outfit.skinAssetUrl) ? outfit.skinAssetUrl : undefined
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
      const textureSize = base.naturalWidth
      const uvScale = textureSize / 64
      setSaveNotice(`正在合成 ${textureSize} × ${textureSize} 皮肤 PNG…`)
      const canvas = document.createElement('canvas')
      canvas.width = textureSize
      canvas.height = textureSize
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法创建导出画布')
      context.imageSmoothingEnabled = false
      context.drawImage(base, 0, 0, textureSize, textureSize)
      const uvRegions = [
        { x: 16, y: 16, width: 24, height: 16 },
        { x: 16, y: 32, width: 24, height: 16 },
        { x: 40, y: 16, width: 16, height: 16 },
        { x: 40, y: 32, width: 16, height: 16 },
        { x: 32, y: 48, width: 16, height: 16 },
        { x: 48, y: 48, width: 16, height: 16 },
      ].map(region => ({ x: region.x * uvScale, y: region.y * uvScale, width: region.width * uvScale, height: region.height * uvScale }))
      for (const item of selectedItems.filter(entry => entry.category !== '披风')) {
        const textureName = model === 'alex' && item.modelTexture ? item.modelTexture : item.texture
        const overlay = await loadImage(item.fileUrl || ASSET_ROOT + textureName)
        context.save()
        context.beginPath()
        uvRegions.forEach(region => context.rect(region.x, region.y, region.width, region.height))
        context.clip()
        context.drawImage(overlay, 0, 0, textureSize, textureSize)
        context.restore()
      }
      const link = document.createElement('a')
      link.download = `cdpc-skin-${textureSize}x${textureSize}.png`
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
    if (!viewer) {
      setSaveNotice('3D 预览尚未准备好')
      return
    }
    viewer.playerObject.rotation.set(0, 0, 0)
    viewer.controls.reset()
    setViewAngle('front')
    setSaveNotice('已重置角色视角')
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
    for (const itemCategory of ['披肩', '外套', '披风'] as const) {
      const options = availableItems.filter(item => item.category === itemCategory)
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
        const textureError = validateStudioSkinTexture({ width: image.naturalWidth, height: image.naturalHeight }, 'base-skin')
        if (textureError) {
          setLoadError(`${textureError} 当前文件未应用。`)
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
          <input className="dressup-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索服装名称…" aria-label="搜索服装" />
          <div className="dressup-categories" aria-label="服装分类">
            {categories.map(item => <button type="button" className="dressup-category" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          {category !== '全部' && !availableCategories.has(category) && <div className="dressup-unavailable"><strong>{category}素材尚未接入</strong><p>目前正式素材目录尚未提供该分类的可用贴图，因此不会展示虚构素材。素材接入后会在这里出现。</p></div>}
          <div className="dressup-items">
            {filtered.map(item => <button type="button" key={item.id} className="dressup-item" aria-pressed={selected[item.category]?.id === item.id} onClick={() => toggleItem(item)}>
              <img className="dressup-item-thumbnail" src={item.fileUrl || ASSET_ROOT + (model === 'alex' && item.modelTexture ? item.modelTexture : item.texture)} alt="" aria-hidden="true" loading="lazy" draggable={false} />
              <strong>{item.name}</strong>
              <small>{item.category} · {item.note}</small>
              <span className="dressup-item-state">{selected[item.category]?.id === item.id ? '已选择' : '点击试穿'}</span>
            </button>)}
          </div>
          {filtered.length === 0 && category !== '全部' && availableCategories.has(category) && <p className="dressup-empty">该分类暂无匹配素材，请更换关键词。</p>}
          {filtered.length === 0 && category === '全部' && <p className="dressup-empty">没有找到匹配的素材。试试其他关键词。</p>}
          <div className="dressup-source-note">素材来自项目预设与账号衣橱；账号素材可直接试穿、保存和导出。</div>
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
                <option value="fly">飞行</option>
                <option value="wave">挥手</option>
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
            <button type="button" onClick={() => skinFileRef.current?.click()}>导入 64×64 PNG</button>
            <input ref={skinFileRef} hidden type="file" accept="image/png,.png" onChange={event => importSkin(event.target.files?.[0])} />
          </div>
          {loadError && <div className="dressup-error" role="alert"><span>{loadError}</span><button type="button" onClick={() => { setLoadError(''); setRetryVersion(version => version + 1) }}>重试</button></div>}
          <p className="dressup-preview-note">拖动角色可旋转，滚轮可缩放。当前使用真实 3D 模型；已接入素材的贴图会合成到皮肤，披风单独作为背部装备加载。</p>
        </section>

        <aside className="dressup-panel" aria-label="当前穿搭">
          <div className="dressup-panel-heading"><h2>搭配清单</h2><span>{selectedItems.length} 件</span></div>
          {selectedItems.length ? <div className="dressup-selected-list">
            {selectedItems.map(item => <div className="dressup-selected-row" key={item.id}><span><small>{item.category}</small><strong>{item.name}</strong></span><button type="button" onClick={() => toggleItem(item)}>移除</button></div>)}
          </div> : <p className="dressup-empty">还没有选择素材。点击左侧已接入的披肩、外套或披风开始搭配。</p>}
          <div className="dressup-actions dressup-primary-actions">
            <button type="button" onClick={removeCurrentCategory} disabled={category === '全部' || !selected[category]}>脱下当前分类</button>
            <button type="button" onClick={randomOutfit}>随机搭配</button>
            <button type="button" onClick={() => void saveOutfitToCloud()} disabled={savingCloud}>{savingCloud ? '云端保存中…' : '保存搭配'}</button>
            <button type="button" onClick={saveLocalOutfit}>保存本地草稿</button>
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
              <button type="button" onClick={loadSavedOutfit} disabled={!selectedSavedOutfitId}>载入选择</button>
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
