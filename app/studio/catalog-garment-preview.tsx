'use client'

import { useEffect, useRef, useState } from 'react'
import { SkinViewer } from 'skinview3d'
import { selectStudioOverlayTexture, validateStudioOverlayMatchesBase, validateStudioSkinTexture } from '@/src/domain/studio-texture'
import { getStudioOverlayUvProfile } from '@/src/domain/studio-uv-layout'
import { attachStudioShoeGeometry } from '@/src/client/studio-shoe-geometry'

type Item = { id?: string; name: string; category: string; texture: string; fileUrl?: string; modelTexture?: string; texture128?: string; modelTexture128?: string }
type Props = { item: Item; model: 'steve' | 'alex'; skinUrl: string }

const ASSET_ROOT = 'https://raw.githubusercontent.com/lonelyang/CapeSkinImage/master/examples/img/'

// Catalog cards share one paused WebGL context. Creating one SkinViewer per card
// repeatedly exhausts browser WebGL contexts while the user scrolls/switches tabs.
let sharedCatalogViewer: SkinViewer | null = null
let catalogRenderQueue: Promise<void> = Promise.resolve()

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('素材加载失败：' + src.split('/').pop()))
    image.src = src
  })
}

function getCatalogViewer(): SkinViewer {
  if (sharedCatalogViewer && !sharedCatalogViewer.disposed) return sharedCatalogViewer
  const canvas = document.createElement('canvas')
  const viewer = new SkinViewer({
    canvas,
    width: 180,
    height: 116,
    enableControls: false,
    pixelRatio: 1,
    renderPaused: true,
  })
  viewer.renderer.setClearColor(0x202833, 0)
  viewer.controls.autoRotate = false
  sharedCatalogViewer = viewer
  return viewer
}

function makeSkinSurfaceTransparent(viewer: SkinViewer) {
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

async function renderCatalogItem(item: Item, model: 'steve' | 'alex', skinUrl: string): Promise<string> {
  const viewer = getCatalogViewer()
  // Reset the previous card before loading the next item into the shared scene.
  viewer.animation = null
  viewer.autoRotate = false
  viewer.controls.autoRotate = false
  viewer.playerWrapper.rotation.set(0, 0, 0)
  viewer.resetCameraPose()
  viewer.loadCape(null)
  viewer.loadSkin(null)
  viewer.playerObject.backEquipment = null
  viewer.background = null

  let cleanupShoes: (() => void) | null = null
  if (item.category === '披风') {
    const emptySkin = document.createElement('canvas')
    emptySkin.width = 64
    emptySkin.height = 64
    await viewer.loadSkin(emptySkin, { model: model === 'alex' ? 'slim' : 'default' })
    makeSkinSurfaceTransparent(viewer)
    await viewer.loadCape(item.fileUrl || ASSET_ROOT + item.texture, { backEquipment: 'cape' })
  } else if (item.category === '鞋子') {
    const shoe = await loadImage(item.fileUrl || ASSET_ROOT + item.texture)
    if (shoe.naturalWidth !== 64 && shoe.naturalWidth !== 128) throw new Error('鞋子贴图必须为 64×64 或 128×128 PNG')
    if (shoe.naturalWidth !== shoe.naturalHeight) throw new Error('鞋子贴图必须为正方形皮肤图集')
    const emptySkin = document.createElement('canvas')
    emptySkin.width = shoe.naturalWidth
    emptySkin.height = shoe.naturalHeight
    await viewer.loadSkin(emptySkin, { model: model === 'alex' ? 'slim' : 'default' })
    makeSkinSurfaceTransparent(viewer)
    cleanupShoes = attachStudioShoeGeometry(viewer.playerObject.skin, shoe, shoe.naturalWidth as 64 | 128)
  } else {
    if (!['披肩', '外套', '帽子', '裤子'].includes(item.category)) {
      throw new Error('该分类尚无独立 UV 规范')
    }
    const profile = getStudioOverlayUvProfile(item.category as '披肩' | '外套' | '帽子' | '裤子')
    if (profile.composition !== 'full-atlas-alpha' && profile.composition !== 'outer-layer-parts') throw new Error('不支持的贴图格式')
    const base = await loadImage(skinUrl)
    const baseError = validateStudioSkinTexture({ width: base.naturalWidth, height: base.naturalHeight }, 'base-skin')
    if (baseError) throw new Error(baseError)
    const url = item.fileUrl || ASSET_ROOT + selectStudioOverlayTexture(item as never, model, base.naturalWidth as 64 | 128)
    const overlay = await loadImage(url)
    const textureError = validateStudioOverlayMatchesBase(
      { width: base.naturalWidth, height: base.naturalHeight },
      { width: overlay.naturalWidth, height: overlay.naturalHeight },
    )
    if (textureError) throw new Error(textureError)
    await viewer.loadSkin(overlay, { model: model === 'alex' ? 'slim' : 'default' })
    makeSkinSurfaceTransparent(viewer)
    if (profile.targetParts) {
      const skin = viewer.playerObject.skin as unknown as Record<string, { innerLayer?: { visible: boolean }; outerLayer?: { visible: boolean } }>
      const targets = new Set(profile.targetParts)
      for (const [partName, part] of Object.entries(skin)) {
        if (!part || typeof part !== 'object') continue
        if (part.innerLayer) part.innerLayer.visible = false
        if (part.outerLayer) part.outerLayer.visible = targets.has(partName as 'head' | 'leftLeg' | 'rightLeg')
      }
    }
    viewer.playerObject.backEquipment = null
  }

  // renderPaused prevents an animation loop per catalog item; render exactly one
  // frame after the item texture and model have been applied, then keep a PNG.
  viewer.render()
  const image = viewer.canvas.toDataURL('image/png')
  cleanupShoes?.()
  return image
}

function enqueueCatalogRender(item: Item, model: 'steve' | 'alex', skinUrl: string): Promise<string> {
  const task = catalogRenderQueue.then(() => renderCatalogItem(item, model, skinUrl))
  catalogRenderQueue = task.then(() => undefined, () => undefined)
  return task
}

/** Each card displays a real isolated 3D render, rasterized by one shared viewer. */
export default function CatalogGarmentPreview({ item, model, skinUrl }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const supported = item.category === '披肩' || item.category === '外套' || item.category === '披风' || item.category === '帽子' || item.category === '裤子' || item.category === '鞋子'

  useEffect(() => {
    const host = hostRef.current
    if (!host || !supported) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(entries => {
      const current = entries.find(entry => entry.target === host)
      if (current) setVisible(current.isIntersecting)
    }, { rootMargin: '96px', threshold: 0 })
    observer.observe(host)
    return () => observer.disconnect()
  }, [supported])

  useEffect(() => {
    if (!visible || !supported) return
    let cancelled = false
    setError('')
    setPreviewUrl('')
    void enqueueCatalogRender(item, model, skinUrl).then(url => {
      if (!cancelled) setPreviewUrl(url)
    }).catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : '预览加载失败')
    })
    return () => { cancelled = true }
  }, [item, model, skinUrl, visible, supported])

  return (
    <div
      ref={hostRef}
      className="dressup-item-render"
      aria-label={(typeof item.name === 'string' ? item.name : '服装素材') + ' 3D 单件预览'}
    >
      {!supported
        ? <span className="dressup-item-render-placeholder">3D 渲染开发中</span>
        : previewUrl
          ? <img src={previewUrl} alt={item.name + ' 单件 3D 预览'} style={{ display: 'block', width: '100%', height: 116, objectFit: 'contain' }} />
          : error
            ? <span role="status">{error}</span>
            : <span>{visible ? '正在生成 3D 预览…' : '3D 单件预览'}</span>}
    </div>
  )
}
