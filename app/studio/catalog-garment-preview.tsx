'use client'
import { useEffect, useRef, useState } from 'react'
import { SkinViewer } from 'skinview3d'
import { selectStudioOverlayTexture, validateStudioOverlayMatchesBase, validateStudioSkinTexture } from '@/src/domain/studio-texture'
import { getStudioOverlayUvProfile } from '@/src/domain/studio-uv-layout'

type Item = { name: string; category: string; texture: string; fileUrl?: string; modelTexture?: string; texture128?: string; modelTexture128?: string }
type Props = { item: Item; model: 'steve' | 'alex'; skinUrl: string }
const ASSET_ROOT = 'https://raw.githubusercontent.com/lonelyang/CapeSkinImage/master/examples/img/'
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => resolve(image); image.onerror = () => reject(new Error('素材加载失败')); image.src = src })
}
/** Lazy isolated 3D render for each visible catalog card. */
export default function CatalogGarmentPreview({ item, model, skinUrl }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const supported = item.category === '披肩' || item.category === '外套' || item.category === '披风'
  useEffect(() => {
    const host = hostRef.current
    if (!host || !supported) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver(entries => {
      const current = entries.find(entry => entry.target === host)
      if (current) setVisible(current.isIntersecting)
    }, { rootMargin: '96px', threshold: 0 })
    observer.observe(host)
    return () => observer.disconnect()
  }, [supported])
  useEffect(() => {
    const host = hostRef.current
    if (!host || !visible || !supported) return
    let cancelled = false
    let viewer: SkinViewer
    setError('')
    try {
      const canvas = document.createElement('canvas')
      viewer = new SkinViewer({ canvas, width: Math.max(host.clientWidth, 120), height: 116, enableControls: false, pixelRatio: 1 })
      viewer.renderer.setClearColor(0x202833, 0); viewer.controls.autoRotate = false; host.replaceChildren(canvas)
    } catch { setError('WebGL 不可用'); return }
    const makeTransparent = () => viewer.playerObject.skin.traverse(object => {
      const mesh = object as unknown as { isMesh?: boolean; material?: unknown }
      if (!mesh.isMesh || !mesh.material) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const entry of materials) { const material = entry as { transparent: boolean; alphaTest: number; needsUpdate: boolean }; material.transparent = true; material.alphaTest = 0.001; material.needsUpdate = true }
    })
    const resize = () => { if (!cancelled && host.clientWidth) viewer.width = Math.max(host.clientWidth, 120) }
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    resizeObserver?.observe(host)
    void (async () => {
      try {
        if (item.category === '披风') {
          const emptySkin = document.createElement('canvas'); emptySkin.width = 64; emptySkin.height = 64
          await viewer.loadSkin(emptySkin, { model: model === 'alex' ? 'slim' : 'default' }); if (cancelled) return
          makeTransparent(); await viewer.loadCape(item.fileUrl || ASSET_ROOT + item.texture, { backEquipment: 'cape' })
        } else {
          if (item.category !== '披肩' && item.category !== '外套') throw new Error('该分类尚无独立 UV 规范')
          const profile = getStudioOverlayUvProfile(item.category as '披肩' | '外套')
          if (profile.composition !== 'full-atlas-alpha') throw new Error('不支持的贴图格式')
          const base = await loadImage(skinUrl); if (cancelled) return
          const baseError = validateStudioSkinTexture({ width: base.naturalWidth, height: base.naturalHeight }, 'base-skin')
          if (baseError) throw new Error(baseError)
          const url = item.fileUrl || ASSET_ROOT + selectStudioOverlayTexture(item as never, model, base.naturalWidth as 64 | 128)
          const overlay = await loadImage(url); if (cancelled) return
          const textureError = validateStudioOverlayMatchesBase({ width: base.naturalWidth, height: base.naturalHeight }, { width: overlay.naturalWidth, height: overlay.naturalHeight })
          if (textureError) throw new Error(textureError)
          await viewer.loadSkin(overlay, { model: model === 'alex' ? 'slim' : 'default' }); if (cancelled) return
          makeTransparent(); viewer.playerObject.backEquipment = null
        }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : '预览加载失败') }
    })()
    return () => { cancelled = true; resizeObserver?.disconnect(); viewer.dispose() }
  }, [item, model, skinUrl, visible, supported])
  return <div className="dressup-item-render" ref={hostRef} aria-label={(typeof item.name === 'string' ? item.name : '服装素材') + ' 3D 单件预览'}>{!supported ? <span className="dressup-item-render-placeholder">3D 渲染开发中</span> : !visible ? <span>3D 预览</span> : null}{error && <span role="status">{error}</span>}</div>
}
