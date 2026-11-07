'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { bresenhamLine } from '@/src/domain/skin-paint'
import { CdpcApiError, cdpcApi } from '@/src/client/cdpc-api'
import { normalizePixelEditorDocument } from '@/src/domain/pixel-editor-document'

type Layer = { id: string; name: string; visible: boolean; opacity: number; pixels: string[] }
type Tool = 'pencil' | 'eraser' | 'fill' | 'eyedropper'
const DEFAULT_SIZE = 64
const blank = (size = DEFAULT_SIZE) => Array<string>(size * size).fill('')
const newLayer = (name: string, size = DEFAULT_SIZE): Layer => ({ id: crypto.randomUUID(), name, visible: true, opacity: 100, pixels: blank(size) })
const cloudSnapshot = (name: string, size: number, activeId: string, layers: Layer[]) => JSON.stringify({ name, document: { version: 1, width: size, height: size, activeId, layers } })

function floodFill(source: string[], start: number, replacement: string, size: number) {
  const target = source[start]
  if (target === replacement) return source
  const result = [...source]
  const queue = [start]
  const visited = new Uint8Array(size * size)
  visited[start] = 1
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor]
    if (result[index] !== target) continue
    result[index] = replacement
    const x = index % size
    const y = Math.floor(index / size)
    const neighbors = [x ? index - 1 : -1, x < size - 1 ? index + 1 : -1, y ? index - size : -1, y < size - 1 ? index + size : -1]
    for (const next of neighbors) if (next >= 0 && !visited[next] && result[next] === target) {
      visited[next] = 1
      queue.push(next)
    }
  }
  return result
}

export default function PixelCanvasEditor() {
  const [layers, setLayers] = useState<Layer[]>(() => [newLayer('基础图层')])
  const size = Math.sqrt(layers[0]?.pixels.length ?? DEFAULT_SIZE * DEFAULT_SIZE)
  const [activeId, setActiveId] = useState('')
  const [tool, setTool] = useState<Tool>('pencil')
  const [color, setColor] = useState('#263b56')
  const [zoom, setZoom] = useState(8)
  const [status, setStatus] = useState('64 × 64 画布已就绪')
  const [history, setHistory] = useState<Array<{ layers: Layer[]; activeId: string }>>([])
  const [future, setFuture] = useState<Array<{ layers: Layer[]; activeId: string }>>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cloudDocuments, setCloudDocuments] = useState<Array<{ id: string; name: string; revision: number; updatedAt: string }>>([])
  const [cloudDocumentId, setCloudDocumentId] = useState('')
  const [cloudRevision, setCloudRevision] = useState(0)
  const [cloudDocumentLoaded, setCloudDocumentLoaded] = useState(false)
  const [cloudBaseline, setCloudBaseline] = useState<string | null>(null)
  const [cloudConflict, setCloudConflict] = useState(false)
  const [cloudName, setCloudName] = useState('我的像素作品')
  const [cloudBusy, setCloudBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drawing = useRef(false)
  const lastIndex = useRef(-1)
  const hasLocalDraft = useRef(false)
  const workspaceActionStarted = useRef(false)
  const opacityGesture = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cdpc-pixel-editor-v1')
      if (raw) {
        const value = normalizePixelEditorDocument(JSON.parse(raw))
        if (value) {
          hasLocalDraft.current = true
          setLayers(value.layers)
          setActiveId(value.activeId)
          setStatus('已恢复上次本地编辑草稿')
        }
      }
    } catch { /* Ignore malformed local drafts. */ }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!activeId && layers[0]) setActiveId(layers[0].id)
  }, [activeId, layers])

  useEffect(() => {
    if (!loaded) return
    let cancelled = false
    void cdpcApi.listEditorDocuments().then(items => {
      if (!cancelled) setCloudDocuments(items)
    }).catch(() => {
      // Anonymous visitors can still use local drafts and PNG export.
    })
    return () => { cancelled = true }
  }, [loaded])

  // Restore the server-selected wardrobe asset when entering the editor.
  // LocalStorage remains an offline draft cache, not the cross-tool source of truth.
  useEffect(() => {
    if (!loaded || hasLocalDraft.current) return
    const controller = new AbortController()
    let cancelled = false
    const restore = async () => {
      try {
        const workspace = await cdpcApi.getWorkspace()
        const assetId = workspace.activeAssetId
        if (!assetId || cancelled) return
        const assetResponse = await fetch(cdpcApi.assetFileUrl(assetId), {
          cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        })
        if (!assetResponse.ok) {
          if (!cancelled && !workspaceActionStarted.current) setStatus('当前工作区素材无法读取，请检查衣橱权限或重新选择素材')
          return
        }
        const bitmap = await createImageBitmap(await assetResponse.blob())
        try {
          if ((bitmap.width !== 64 && bitmap.width !== 128) || bitmap.height !== bitmap.width) {
            if (!cancelled && !workspaceActionStarted.current) setStatus('当前素材必须为 64×64 或 128×128 皮肤')
            return
          }
          const source = document.createElement('canvas')
          source.width = bitmap.width
          source.height = bitmap.height
          const context = source.getContext('2d', { willReadFrequently: true })
          if (!context) throw new Error('无法读取皮肤像素')
          context.drawImage(bitmap, 0, 0)
          const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data
          const pixels = Array.from({ length: bitmap.width * bitmap.height }, (_, index) => {
            const offset = index * 4
            if (rgba[offset + 3] === 0) return ''
            return '#' + [rgba[offset], rgba[offset + 1], rgba[offset + 2]]
              .map(value => value.toString(16).padStart(2, '0')).join('')
          })
          if (cancelled || workspaceActionStarted.current) return
          const layer = { id: crypto.randomUUID(), name: '衣橱素材', visible: true, opacity: 100, pixels }
          setLayers([layer])
          setActiveId(layer.id)
          setHistory([])
          setFuture([])
          setStatus('已从衣橱载入当前皮肤，可继续编辑')
        } finally {
          bitmap.close()
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        if (!cancelled && !workspaceActionStarted.current) setStatus(error instanceof Error ? `素材恢复失败：${error.message}` : '素材恢复失败')
      }
    }
    void restore()
    return () => { cancelled = true; controller.abort() }
  }, [loaded])

  useEffect(() => {
    if (loaded) {
      try { localStorage.setItem('cdpc-pixel-editor-v1', JSON.stringify({ version: 1, width: size, height: size, layers, activeId })) }
      catch { setStatus('本地空间不足，请及时导出 PNG') }
    }
  }, [layers, activeId, loaded, size])

  const currentCloudSnapshot = useMemo(() => cloudSnapshot(cloudName, size, activeId, layers), [cloudName, size, activeId, layers])
  const cloudDirty = cloudDocumentLoaded && cloudBaseline !== null && currentCloudSnapshot !== cloudBaseline
  const composite = useMemo(() => {
    const result = blank(size)
    layers.forEach(layer => {
      if (!layer.visible || layer.opacity <= 0) return
      layer.pixels.forEach((pixel, index) => {
        if (!pixel) return
        const match = /^#([0-9a-f]{6})$/i.exec(pixel)
        if (!match) return
        const source = [parseInt(match[1].slice(0, 2), 16), parseInt(match[1].slice(2, 4), 16), parseInt(match[1].slice(4, 6), 16)]
        const previous = result[index]
        const previousMatch = /^rgba\((\d+), (\d+), (\d+), ([0-9.]+)\)$/.exec(previous)
        const destination = previousMatch ? [Number(previousMatch[1]), Number(previousMatch[2]), Number(previousMatch[3])] : [0, 0, 0]
        const destinationAlpha = previousMatch ? Number(previousMatch[4]) : 0
        const sourceAlpha = layer.opacity / 100
        const alpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha)
        const channels = source.map((value, channel) => Math.round((value * sourceAlpha + destination[channel] * destinationAlpha * (1 - sourceAlpha)) / alpha))
        result[index] = 'rgba(' + channels.join(', ') + ', ' + alpha.toFixed(3) + ')'
      })
    })
    return result
  }, [layers, size])

  const render = useCallback((pixels: string[]) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, size, size)
    pixels.forEach((pixel, index) => {
      if (!pixel) return
      ctx.fillStyle = pixel
      ctx.fillRect(index % size, Math.floor(index / size), 1, 1)
    })
  }, [size])
  useEffect(() => render(composite), [composite, render])

  const checkpoint = () => {
    setHistory(current => [...current.slice(-39), { layers: JSON.parse(JSON.stringify(layers)), activeId }])
    setFuture([])
  }

  const paint = (index: number) => {
    if (index < 0 || index >= size * size || index === lastIndex.current) return
    lastIndex.current = index
    if (tool === 'eyedropper') {
      const pixel = composite[index]
      const rgba = /^rgba\((\d+), (\d+), (\d+), ([0-9.]+)\)$/.exec(pixel)
      const hex = /^#([0-9a-f]{6})$/i.exec(pixel)
      if (rgba && Number(rgba[4]) > 0) {
        setColor('#' + [rgba[1], rgba[2], rgba[3]].map(value => Number(value).toString(16).padStart(2, '0')).join(''))
        setTool('pencil')
        setStatus('已吸取画布颜色')
      } else if (hex) {
        setColor('#' + hex[1])
        setTool('pencil')
        setStatus('已吸取画布颜色')
      }
      drawing.current = false
      return
    }
    const target = layers.find(layer => layer.id === activeId)
    if (!target) return
    setLayers(current => current.map(layer => {
      if (layer.id !== activeId) return layer
      if (tool === 'fill') return { ...layer, pixels: floodFill(layer.pixels, index, color, size) }
      const pixels = [...layer.pixels]
      pixels[index] = tool === 'eraser' ? '' : color
      return { ...layer, pixels }
    }))
    if (tool === 'fill') drawing.current = false
  }

  const getIndex = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(size - 1, Math.floor((event.clientX - rect.left) / rect.width * size)))
    const y = Math.max(0, Math.min(size - 1, Math.floor((event.clientY - rect.top) / rect.height * size)))
    return y * size + x
  }
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return
    if (tool !== 'eyedropper') checkpoint()
    drawing.current = true
    lastIndex.current = -1
    event.currentTarget.setPointerCapture(event.pointerId)
    paint(getIndex(event))
  }
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || tool === 'eyedropper') return
    const next = getIndex(event)
    if (lastIndex.current < 0) {
      paint(next)
      return
    }
    const from = lastIndex.current
    for (const point of bresenhamLine(from % size, Math.floor(from / size), next % size, Math.floor(next / size))) {
      paint(point.y * size + point.x)
    }
  }
  const stop = () => { drawing.current = false; lastIndex.current = -1 }

  const undo = () => {
    if (!history.length) return
    const previous = history[history.length - 1]
    setFuture(current => [{ layers: JSON.parse(JSON.stringify(layers)), activeId }, ...current].slice(0, 40))
    setHistory(current => current.slice(0, -1))
    setLayers(previous.layers)
    setActiveId(previous.activeId)
    setStatus('已撤销')
  }
  const redo = () => {
    if (!future.length) return
    const next = future[0]
    setHistory(current => [...current, { layers: JSON.parse(JSON.stringify(layers)), activeId }].slice(-40))
    setFuture(current => current.slice(1))
    setLayers(next.layers)
    setActiveId(next.activeId)
    setStatus('已重做')
  }
  const addLayer = () => {
    checkpoint()
    const layer = newLayer('图层 ' + (layers.length + 1), size)
    setLayers(current => [...current, layer])
    setActiveId(layer.id)
  }
  const removeLayer = (id: string) => {
    if (layers.length <= 1) { setStatus('至少保留一个图层'); return }
    checkpoint()
    const next = layers.filter(layer => layer.id !== id)
    setLayers(next)
    if (activeId === id) setActiveId(next[next.length - 1].id)
  }

  const importPng = async (file?: File) => {
    if (!file) return
    if (file.type !== 'image/png') { setStatus('请选择 PNG 图片'); return }
    const url = URL.createObjectURL(file)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
      })
      if ((image.width !== 64 && image.width !== 128) || image.height !== image.width) { setStatus('PNG 必须为 64 × 64 或 128 × 128 像素'); return }
      const temp = document.createElement('canvas')
      temp.width = image.width
      temp.height = image.height
      const ctx = temp.getContext('2d')
      if (!ctx) return
      ctx.drawImage(image, 0, 0)
      const data = ctx.getImageData(0, 0, image.width, image.height).data
      const pixels = Array.from({ length: image.width * image.height }, (_, index) => {
        const offset = index * 4
        if (data[offset + 3] < 8) return ''
        return '#' + [data[offset], data[offset + 1], data[offset + 2]].map(value => value.toString(16).padStart(2, '0')).join('')
      })
      checkpoint()
      const layer = { ...newLayer(file.name.replace(/\.png$/i, '') || '导入皮肤', image.width), pixels }
      setLayers([layer])
      setActiveId(layer.id)
      // checkpoint() above keeps the previous document as the undo target.
      // Do not clear history here: importing a new-sized canvas is reversible.
      setStatus('已导入 PNG，可在新画布中继续编辑')
    } catch { setStatus('无法读取 PNG 文件') }
    finally { URL.revokeObjectURL(url) }
  }

  const exportPng = async () => {
    const output = document.createElement('canvas')
    output.width = size
    output.height = size
    const ctx = output.getContext('2d')
    if (!ctx) return
    composite.forEach((pixel, index) => {
      if (!pixel) return
      ctx.fillStyle = pixel
      ctx.fillRect(index % size, Math.floor(index / size), 1, 1)
    })
    const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/png'))
    if (!blob) { setStatus('PNG 导出失败'); return }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cdpc-pixel-skin-' + size + 'x' + size + '.png'
    link.click()
    URL.revokeObjectURL(url)
    setStatus('已导出 ' + size + ' × ' + size + ' PNG')
  }

  const saveCloudDocument = async () => {
    if (cloudConflict) {
      setStatus('检测到云端版本冲突，请先重新载入云端，或另存为新副本')
      return
    }
    if (cloudDocumentLoaded && !cloudDirty) {
      setStatus('云端文档已是最新版本')
      return
    }
    setCloudBusy(true)
    const document = { version: 1 as const, width: size as 64 | 128, height: size as 64 | 128, activeId, layers }
    const savedSnapshot = cloudSnapshot(cloudName, size, activeId, layers)
    try {
      const saved = cloudDocumentId && cloudDocumentLoaded
        ? await cdpcApi.updateEditorDocument(cloudDocumentId, cloudName, document, cloudRevision)
        : await cdpcApi.createEditorDocument(cloudName, document)
      setCloudDocumentId(saved.id)
      setCloudRevision(saved.revision)
      setCloudDocumentLoaded(true)
      setCloudBaseline(savedSnapshot)
      setCloudConflict(false)
      try {
        setCloudDocuments(await cdpcApi.listEditorDocuments())
        setStatus('云端文档已保存，可在其他设备登录后打开')
      } catch {
        setStatus('云端文档已保存，但列表刷新失败；稍后重新打开文档列表即可')
      }
    } catch (error) {
      if (error instanceof CdpcApiError && error.status === 409) setCloudConflict(true)
      setStatus(error instanceof Error ? `云端保存失败：${error.message}` : '云端保存失败')
    } finally {
      setCloudBusy(false)
    }
  }

  const saveCloudCopy = async () => {
    setCloudBusy(true)
    const copyName = `${cloudName.trim() || '未命名作品'}（副本）`.slice(0, 80)
    const document = { version: 1 as const, width: size as 64 | 128, height: size as 64 | 128, activeId, layers }
    const savedSnapshot = cloudSnapshot(copyName, size, activeId, layers)
    try {
      const saved = await cdpcApi.createEditorDocument(copyName, document)
      setCloudName(copyName)
      setCloudDocumentId(saved.id)
      setCloudRevision(saved.revision)
      setCloudDocumentLoaded(true)
      setCloudBaseline(savedSnapshot)
      setCloudConflict(false)
      try {
        setCloudDocuments(await cdpcApi.listEditorDocuments())
        setStatus('本地内容已另存为新的云端副本，原云端版本未被覆盖')
      } catch {
        setStatus('云端副本已保存，但列表刷新失败；稍后重新打开文档列表即可')
      }
    } catch (error) {
      setStatus(error instanceof Error ? `另存副本失败：${error.message}` : '另存副本失败')
    } finally {
      setCloudBusy(false)
    }
  }

  const deleteCloudDocument = async () => {
    if (!cloudDocumentId || !cloudDocumentLoaded) {
      setStatus('请先打开要删除的云端文档')
      return
    }
    if (!window.confirm('确定永久删除这份云端编辑文档吗？此操作无法撤销。')) return
    setCloudBusy(true)
    try {
      await cdpcApi.deleteEditorDocument(cloudDocumentId)
      setCloudDocuments(current => current.filter(item => item.id !== cloudDocumentId))
      setCloudDocumentId('')
      setCloudDocumentLoaded(false)
      setCloudBaseline(null)
      setCloudConflict(false)
      setCloudRevision(0)
      setStatus('云端文档已删除；本地草稿仍保留')
    } catch (error) {
      setStatus(error instanceof Error ? `删除失败：${error.message}` : '云端文档删除失败')
    } finally {
      setCloudBusy(false)
    }
  }

  const openCloudDocument = async () => {
    if (!cloudDocumentId) { setStatus('请先选择一份云端文档'); return }
    if (cloudDirty && !window.confirm('当前有未保存的本地修改。重新载入将放弃这些修改；如需保留，请先另存为云端副本。继续吗？')) return
    setCloudBusy(true)
    try {
      const item = await cdpcApi.getEditorDocument(cloudDocumentId)
      const normalized = normalizePixelEditorDocument(item.document)
      if (!normalized) throw new Error('云端文档尺寸或图层数据无效')
      const nextActiveId = normalized.activeId
      setLayers(normalized.layers)
      setActiveId(nextActiveId)
      setCloudName(item.name)
      setCloudRevision(item.revision)
      setCloudDocumentLoaded(true)
      setCloudBaseline(cloudSnapshot(item.name, normalized.width, nextActiveId, normalized.layers))
      setCloudConflict(false)
      setHistory([])
      setFuture([])
      setStatus('已从云端恢复编辑文档')
    } catch (error) {
      setStatus(error instanceof Error ? `云端打开失败：${error.message}` : '云端打开失败')
    } finally {
      setCloudBusy(false)
    }
  }

  const selectCloudDocument = (nextId: string) => {
    if (cloudDirty && !window.confirm('当前有未保存的本地修改。切换文档将放弃这些修改；如需保留，请先另存为云端副本。继续吗？')) return
    setCloudDocumentId(nextId)
    setCloudDocumentLoaded(false)
    setCloudBaseline(null)
    setCloudConflict(false)
    setCloudRevision(0)
  }

  const saveToWardrobe = async () => {
    workspaceActionStarted.current = true
    setSaving(true)
    try {
      const output = document.createElement('canvas')
      output.width = size
      output.height = size
      const ctx = output.getContext('2d')
      if (!ctx) throw new Error('无法创建画布')
      composite.forEach((pixel, index) => {
        if (!pixel) return
        ctx.fillStyle = pixel
        ctx.fillRect(index % size, Math.floor(index / size), 1, 1)
      })
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('PNG 编码失败')), 'image/png'))
      const file = new File([blob], 'cdpc-pixel-skin-' + size + 'x' + size + '.png', { type: 'image/png' })
      const asset = await cdpcApi.uploadAsset(file, 'SKIN', {
        visibility: 'PRIVATE',
        attribution: 'CDPC Pixel Editor',
      })
      try {
        const workspace = await cdpcApi.getWorkspace()
        await cdpcApi.updateWorkspace({
          projectId: workspace.projectId ?? null,
          activeTool: 'PIXEL_EDITOR',
          activeAssetId: asset.id,
          activeOutfitId: null,
        })
        setStatus('皮肤已保存到衣橱，并已同步为当前工作区素材')
      } catch (error) {
        setStatus(`皮肤已保存到衣橱，但工作区同步失败：${error instanceof Error ? error.message : '请稍后重试'}`)
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : '保存失败') }
    finally { setSaving(false) }
  }

  const active = layers.find(layer => layer.id === activeId)
  return (
    <section className="cdpc-pixel-editor" aria-label={size + '×' + size + ' 像素编辑器'}>
      <header className="cdpc-pixel-header">
        <div><h2>{size} × {size} 像素编辑器</h2><p>原尺寸编辑 · 多图层 · 撤销重做 · PNG 导入导出</p></div>
        <div className="cdpc-pixel-actions">
          <button type="button" onClick={() => fileRef.current?.click()}>导入 PNG</button>
          <input ref={fileRef} hidden type="file" accept="image/png" onChange={event => { void importPng(event.target.files?.[0]); event.currentTarget.value = '' }} />
          <button type="button" onClick={() => void exportPng()}>导出 PNG</button>
          <button type="button" disabled={saving} onClick={() => void saveToWardrobe()}>{saving ? '保存中…' : '保存到衣橱'}</button>
        </div>
      </header>
      <div className="cdpc-pixel-cloudbar">
        <label>云端文档名称
          <input aria-label="云端文档名称" value={cloudName} maxLength={80} onChange={event => setCloudName(event.target.value)} />
        </label>
        <label>已保存文档
          <select aria-label="选择云端文档" value={cloudDocumentId} onChange={event => selectCloudDocument(event.target.value)}>
            <option value="">新建云端文档</option>
            {cloudDocuments.map(item => <option key={item.id} value={item.id}>{item.name} · {new Date(item.updatedAt).toLocaleString()}</option>)}
          </select>
        </label>
        <button type="button" disabled={cloudBusy} onClick={() => void openCloudDocument()}>{cloudDocumentLoaded ? "重新载入云端" : "打开云端"}</button>
        <button type="button" disabled={cloudBusy || cloudConflict} onClick={() => void saveCloudDocument()}>{cloudBusy ? '同步中…' : '保存云端'}</button>
        {cloudConflict && <button type="button" disabled={cloudBusy} onClick={() => void saveCloudCopy()}>另存为云端副本</button>}
        <button type="button" disabled={cloudBusy || !cloudDocumentLoaded} onClick={() => void deleteCloudDocument()}>删除云端</button>
      </div>
      <p className="cdpc-cloud-state" role="status" aria-live="polite">
        {cloudConflict ? '云端版本冲突：本地修改已保留，原文档未被覆盖。请重新载入云端或另存为副本。' : cloudDocumentLoaded ? cloudDirty ? '有未保存的云端修改' : '云端文档已同步' : '当前为本地草稿；可新建或打开云端文档'}
      </p>
      <div className="cdpc-pixel-layout">
        <aside className="cdpc-pixel-tools" aria-label="绘图工具">
          <button type="button" aria-pressed={tool === 'pencil'} onClick={() => setTool('pencil')}>画笔</button>
          <button type="button" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>橡皮</button>
          <button type="button" aria-pressed={tool === 'fill'} onClick={() => setTool('fill')}>油漆桶</button>
          <button type="button" aria-pressed={tool === 'eyedropper'} onClick={() => setTool('eyedropper')}>吸管</button>
          <label>颜色<input aria-label="画笔颜色" type="color" value={color} onChange={event => setColor(event.target.value)} /></label>
          <label>缩放<input aria-label="画布缩放" type="range" min="4" max="12" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
          <button type="button" onClick={undo} disabled={!history.length}>撤销</button>
          <button type="button" onClick={redo} disabled={!future.length}>重做</button>
        </aside>
        <div className="cdpc-pixel-stage">
          <canvas ref={canvasRef} width={size} height={size} aria-label={size + ' 乘 ' + size + ' 像素画布'}
            style={{ width: size * zoom + 'px', height: size * zoom + 'px' }}
            onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} />
          <small>透明背景 · {size} × {size} · {status}</small>
        </div>
        <aside className="cdpc-pixel-layers" aria-label="图层面板">
          <div><strong>图层</strong><button type="button" onClick={addLayer}>＋ 新建</button></div>
          {[...layers].reverse().map(layer => (
            <div key={layer.id} className={layer.id === activeId ? 'cdpc-pixel-layer active' : 'cdpc-pixel-layer'}>
              <button type="button" onClick={() => setActiveId(layer.id)}>{layer.name}</button>
              <button type="button" aria-label={layer.visible ? '隐藏' + layer.name : '显示' + layer.name} onClick={() => { checkpoint(); setLayers(current => current.map(item => item.id === layer.id ? { ...item, visible: !item.visible } : item)) }}>{layer.visible ? '显示' : '隐藏'}</button>
              <button type="button" aria-label={'删除' + layer.name} onClick={() => removeLayer(layer.id)}>×</button>
            </div>
          ))}
          {active && <label>图层不透明度<input type="range" min="0" max="100" value={active.opacity}
            onPointerDown={() => { if (!opacityGesture.current) { checkpoint(); opacityGesture.current = true } }}
            onPointerUp={() => { opacityGesture.current = false }} onPointerCancel={() => { opacityGesture.current = false }} onBlur={() => { opacityGesture.current = false }}
            onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key) && !opacityGesture.current) { checkpoint(); opacityGesture.current = true } }}
            onKeyUp={() => { opacityGesture.current = false }}
            onChange={event => { if (!opacityGesture.current) { checkpoint(); opacityGesture.current = true } setLayers(current => current.map(item => item.id === activeId ? { ...item, opacity: Number(event.target.value) } : item)) }} /></label>}
          <p>草稿自动保存在本机浏览器；保存到衣橱需要登录。</p>
        </aside>
      </div>
    </section>
  )
}
