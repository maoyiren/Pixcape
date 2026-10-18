import { useEffect, useRef } from 'react'
import { FlyingAnimation, IdleAnimation, SkinViewer, WalkingAnimation } from 'skinview3d'

type LayerData = { pixels: string[]; visible: boolean; opacity: number }
type ModelType = 'steve' | 'alex'
type Pose = 'idle' | 'wave' | 'walk' | 'fly'
type Props = {
  backgroundImageUrl?: string
  backgroundColor?: string
  layers: LayerData[]
  side: 'front' | 'back'
  rotation: number
  tilt: number
  roll: number
  zoom: number
  modelType: ModelType
  onRotationChange: (value: number) => void
  onTiltChange: (value: number) => void
  onRollChange: (value: number) => void
  onZoomChange: (value: number) => void
  capeTextureUrl?: string
  capeVisible?: boolean
  elytraVisible?: boolean
  pose?: Pose
}

function makeSkinCanvas(layers: LayerData[]) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (!context) return canvas

  context.clearRect(0, 0, 64, 64)
  for (const layer of layers) {
    if (!layer.visible) continue
    context.globalAlpha = layer.opacity / 100
    layer.pixels.forEach((color, index) => {
      if (color) {
        context.fillStyle = color
        context.fillRect(index % 64, Math.floor(index / 64), 1, 1)
      }
    })
  }
  context.globalAlpha = 1
  return canvas
}

function makeFallbackCape(skin: HTMLCanvasElement) {
  // CapeSkinImage uses the official skinview3d cape model/UV layout.
  // Keep the fallback texture in the standard 64x32 cape atlas format.
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 32
  const context = canvas.getContext('2d')
  if (context) {
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, 64, 32)
    context.drawImage(skin, 1, 33, 10, 16, 1, 1, 10, 16)
  }
  return canvas
}

export default function ThreeCapePreview({
  backgroundImageUrl,
  backgroundColor = '#76b9ee',
  layers,
  side,
  rotation,
  tilt,
  roll,
  zoom,
  modelType,
  onRotationChange,
  onTiltChange,
  onRollChange,
  onZoomChange,
  capeTextureUrl,
  capeVisible = true,
  elytraVisible = false,
  pose = 'idle',
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<SkinViewer | null>(null)
  const poseRef = useRef(pose)
  const backgroundRequestRef = useRef(0)
  const backgroundImageRef = useRef(backgroundImageUrl)
  const backgroundColorRef = useRef(backgroundColor)
  const rotationRef = useRef(rotation)
  const sideRef = useRef(side)
  const tiltRef = useRef(tilt)
  const rollRef = useRef(roll)
  const zoomRef = useRef(zoom)
  const onRotationChangeRef = useRef(onRotationChange)
  const onTiltChangeRef = useRef(onTiltChange)
  const onRollChangeRef = useRef(onRollChange)
  const onZoomChangeRef = useRef(onZoomChange)
  const capeVisibleRef = useRef(capeVisible)
  const elytraVisibleRef = useRef(elytraVisible)
  const capeLoadIdRef = useRef(0)
  const skinLoadIdRef = useRef(0)

  useEffect(() => { rotationRef.current = rotation }, [rotation])
  useEffect(() => { sideRef.current = side }, [side])
  useEffect(() => { tiltRef.current = tilt }, [tilt])
  useEffect(() => { rollRef.current = roll }, [roll])
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { onRotationChangeRef.current = onRotationChange }, [onRotationChange])
  useEffect(() => { onTiltChangeRef.current = onTiltChange }, [onTiltChange])
  useEffect(() => { onRollChangeRef.current = onRollChange }, [onRollChange])
  useEffect(() => { onZoomChangeRef.current = onZoomChange }, [onZoomChange])
  useEffect(() => { capeVisibleRef.current = capeVisible }, [capeVisible])
  useEffect(() => { poseRef.current = pose }, [pose])
  useEffect(() => { backgroundImageRef.current = backgroundImageUrl }, [backgroundImageUrl])
  useEffect(() => { backgroundColorRef.current = backgroundColor }, [backgroundColor])
  useEffect(() => { elytraVisibleRef.current = elytraVisible }, [elytraVisible])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let viewer: SkinViewer
    try {
      const canvas = document.createElement('canvas')
      host.prepend(canvas)
      viewer = new SkinViewer({
        canvas,
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
        enableControls: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      })
    } catch {
      host.dataset.webglUnavailable = 'true'
      return
    }

    viewer.renderer.setClearColor(0x000000, 0)
    // Use damped orbit controls so the preview can be rotated smoothly through
    // the full vertical and horizontal orbit, including looking from underneath.
    viewer.controls.enabled = true
    viewer.controls.enableRotate = true
    viewer.controls.enableZoom = true
    viewer.controls.enablePan = false
    viewer.controls.enableDamping = false
    viewer.controls.rotateSpeed = 0.85
    viewer.controls.minPolarAngle = 0
    viewer.controls.maxPolarAngle = Math.PI
    viewerRef.current = viewer

    const resize = () => {
      viewer.width = Math.max(1, host.clientWidth)
      viewer.height = Math.max(1, host.clientHeight)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    const applyRotation = () => {
      viewer.playerObject.rotation.y = (rotationRef.current + (sideRef.current === 'back' ? 180 : 0)) * Math.PI / 180
      viewer.playerObject.rotation.x = tiltRef.current * Math.PI / 180
      viewer.playerObject.rotation.z = rollRef.current * Math.PI / 180
      viewer.camera.zoom = zoomRef.current
      viewer.camera.updateProjectionMatrix()
    }
    applyRotation()



    return () => {
      observer.disconnect()
      viewer.dispose()
      viewer.canvas.remove()
      viewerRef.current = null
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const loadId = ++skinLoadIdRef.current
    const skin = makeSkinCanvas(layers)
    const model = modelType === 'alex' ? 'slim' : 'default'

    // Canvas texture uploads can fail transiently on mobile WebGL contexts.
    // Ignore stale completions and retry once rather than leaving an empty avatar.
    const load = async () => {
      try {
        await viewer.loadSkin(skin, { model })
        if (loadId === skinLoadIdRef.current && hostRef.current) {
          delete hostRef.current.dataset.skinLoadError
        }
      } catch {
        if (loadId !== skinLoadIdRef.current) return
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (loadId !== skinLoadIdRef.current || viewerRef.current !== viewer) return
        try {
          await viewer.loadSkin(skin, { model })
          if (loadId === skinLoadIdRef.current && hostRef.current) {
            delete hostRef.current.dataset.skinLoadError
          }
        } catch {
          if (loadId === skinLoadIdRef.current && hostRef.current) {
            hostRef.current.dataset.skinLoadError = 'true'
          }
        }
      }
    }
    void load()
    return () => { skinLoadIdRef.current += 1 }
  }, [layers, modelType])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const loadId = ++capeLoadIdRef.current
    viewer.resetCape()

    const source = capeTextureUrl || makeFallbackCape(makeSkinCanvas(layers))
    const result = viewer.loadCape(source, { makeVisible: false })
    void Promise.resolve(result).then(() => {
      if (loadId !== capeLoadIdRef.current) return
      // Cape and elytra are mutually exclusive in skinview3d. Switching to
      // elytra changes the back equipment instead of drawing a second mesh.
      viewer.playerObject.backEquipment = elytraVisibleRef.current
        ? 'elytra'
        : capeVisibleRef.current
          ? 'cape'
          : null
    }).catch(() => {
      if (loadId === capeLoadIdRef.current) viewer.playerObject.backEquipment = null
    })
    return () => { capeLoadIdRef.current += 1 }
  }, [capeTextureUrl, layers])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.playerObject.backEquipment = elytraVisible
      ? 'elytra'
      : capeVisible
        ? 'cape'
        : null
  }, [capeVisible, elytraVisible])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.playerObject.rotation.y = (rotation + (side === 'back' ? 180 : 0)) * Math.PI / 180
    viewer.playerObject.rotation.x = tilt * Math.PI / 180
    viewer.playerObject.rotation.z = roll * Math.PI / 180
  }, [rotation, side, tilt, roll, pose])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.camera.zoom = zoom
    viewer.camera.updateProjectionMatrix()
  }, [zoom])


  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const animation = pose === 'fly'
      ? new FlyingAnimation()
      : pose === 'walk'
        ? new WalkingAnimation()
        : new IdleAnimation()
    if (pose === 'fly') {
      // FlyingAnimation writes player.rotation.x every frame. Reapply the user tilt
      // after its built-in flight pitch so vertical dragging remains effective.
      animation.addAnimation((player, progress) => {
        const t = progress > 0 ? progress * 20 : 0
        const startProgress = Math.max(0, Math.min(1, (t * t) / 100))
        player.rotation.x = startProgress * (Math.PI / 5) + tiltRef.current * Math.PI / 180
      })
    }
    if (pose === 'wave') {
      animation.addAnimation((player, progress) => {
        player.skin.rightArm.rotation.z = -2.35 + Math.sin(progress * 5) * 0.22
        player.skin.rightArm.rotation.x = Math.sin(progress * 3) * 0.12
      })
    }
    if (pose === 'fly' && !elytraVisibleRef.current && capeVisibleRef.current) {
      animation.addAnimation((player, progress) => {
        player.cape.rotation.x = 0.35 + Math.sin(progress * 2.2) * 0.02
        player.cape.rotation.z = Math.sin(progress * 1.8) * 0.025
      })
    }
    animation.speed = pose === 'walk' ? 0.72 : 1
    viewer.animation = animation
    return () => {
      if (viewer.animation === animation) viewer.animation = null
    }
  }, [pose])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const requestId = ++backgroundRequestRef.current
    const fallback = Number.parseInt(backgroundColor.replace('#', ''), 16)
    if (!backgroundImageUrl) {
      viewer.background = fallback
      return
    }
    void viewer.loadBackground(backgroundImageUrl).then(() => {
      if (requestId !== backgroundRequestRef.current) {
        const latestUrl = backgroundImageRef.current
        if (latestUrl) {
          void viewer.loadBackground(latestUrl).catch(() => {
            viewer.background = null
          })
        } else {
          viewer.background = Number.parseInt(backgroundColorRef.current.replace('#', ''), 16)
        }
      }
    }).catch(() => {
      if (requestId === backgroundRequestRef.current) {
        viewer.background = null
        if (hostRef.current) hostRef.current.dataset.backgroundFallback = 'true'
      }
    })
    return () => {
      backgroundRequestRef.current += 1
    }
  }, [backgroundImageUrl, backgroundColor])



  return (
    <div
      ref={hostRef}
      className="three-preview-canvas"
      role="img"
      aria-label={modelType === 'steve' ? 'Steve 模型 3D 皮肤、披风与鞘翅预览' : 'Alex 模型 3D 皮肤、披风与鞘翅预览'}
    >
      <div className="webgl-fallback">当前设备无法启用 WebGL，请尝试更新浏览器或开启硬件加速。</div>
    </div>
  )
}
