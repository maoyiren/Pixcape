import { useEffect, useRef, useState } from 'react'
import { SkinViewer } from 'skinview3d'

type Props = {
  kind: 'skin' | 'cape'
  imageUrl: string
  slimImageUrl?: string
  modelType?: 'steve' | 'alex'
  showAuthor?: boolean
}

const BASE_SKIN = 'https://raw.githubusercontent.com/lonelyang/CapeSkinImage/master/examples/img/stevea.png'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load preview texture'))
    image.src = src
  })
}

async function createRenderedPreview(
  viewer: SkinViewer,
  kind: Props['kind'],
  imageUrl: string,
  slimImageUrl: string | undefined,
  modelType: Props['modelType'],
) {
  const base = await loadImage(BASE_SKIN)
  const skinCanvas = document.createElement('canvas')
  skinCanvas.width = 64
  skinCanvas.height = 64
  const context = skinCanvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')
  context.imageSmoothingEnabled = false
  context.drawImage(base, 0, 0, 64, 64)

  if (kind === 'skin') {
    const overlay = await loadImage(modelType === 'alex' && slimImageUrl ? slimImageUrl : imageUrl)
    context.drawImage(overlay, 0, 0, 64, 64)
  }

  await viewer.loadSkin(skinCanvas, { model: modelType === 'alex' ? 'slim' : 'default' })
  if (kind === 'cape') {
    await viewer.loadCape(imageUrl, { makeVisible: false })
    viewer.playerObject.backEquipment = 'cape'
    viewer.playerObject.rotation.y = Math.PI + 0.18
  } else {
    viewer.playerObject.backEquipment = null
    viewer.playerObject.rotation.y = -0.18
  }
}

export default function PresetThumbnail({ kind, imageUrl, slimImageUrl, modelType = 'steve', showAuthor = true }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [renderedImage, setRenderedImage] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host || renderedImage) return
    let cancelled = false
    let viewer: SkinViewer | undefined
    let frame = 0

    const render = async () => {
      try {
        const canvas = document.createElement('canvas')
        viewer = new SkinViewer({
          canvas,
          width: 96,
          height: 96,
          enableControls: false,
          pixelRatio: 1,
        })
        viewer.controls.enabled = false
        await createRenderedPreview(viewer, kind, imageUrl, slimImageUrl, modelType)
        if (cancelled) return
        // Let skinview3d draw the loaded model before taking a static snapshot.
        frame = requestAnimationFrame(() => {
          if (cancelled || !viewer) return
          try {
            setRenderedImage(viewer.canvas.toDataURL('image/png'))
          } catch {
            setFailed(true)
          } finally {
            viewer.dispose()
            viewer = undefined
          }
        })
      } catch {
        if (!cancelled) setFailed(true)
        viewer?.dispose()
        viewer = undefined
      }
    }

    let observer: IntersectionObserver | undefined
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer?.disconnect()
          void render()
        }
      }, { rootMargin: '120px' })
      observer.observe(host)
    } else {
      void render()
    }

    return () => {
      cancelled = true
      observer?.disconnect()
      if (frame) cancelAnimationFrame(frame)
      viewer?.dispose()
    }
  }, [kind, imageUrl, slimImageUrl, modelType, renderedImage])

  return (
    <span className="preset-thumbnail">
      <span ref={hostRef} className="preset-thumbnail-render">
        {renderedImage && <img src={renderedImage} alt="" />}
        {failed && <span className="preset-thumbnail-fallback">预览暂不可用</span>}
      </span>
      {showAuthor && <small className="preset-author">作者：lonelyang</small>}
    </span>
  )
}
