'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { bresenhamLine } from '@/src/domain/skin-paint'

type Layer = { id: string; name: string; visible: boolean; opacity: number; pixels: string[] }
type Tool = 'pencil' | 'eraser' | 'fill' | 'eyedropper'
const SIZE = 64
const blank = () => Array<string>(SIZE * SIZE).fill('')
const newLayer = (name: string): Layer => ({ id: crypto.randomUUID(), name, visible: true, opacity: 100, pixels: blank() })

function floodFill(source: string[], start: number, replacement: string) {
  const target = source[start]
  if (target === replacement) return source
  const result = [...source]
  const queue = [start]
  const visited = new Uint8Array(SIZE * SIZE)
  visited[start] = 1
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor]
    if (result[index] !== target) continue
    result[index] = replacement
    const x = index % SIZE
    const y = Math.floor(index / SIZE)
    const neighbors = [x ? index - 1 : -1, x < SIZE - 1 ? index + 1 : -1, y ? index - SIZE : -1, y < SIZE - 1 ? index + SIZE : -1]
    for (const next of neighbors) if (next >= 0 && !visited[next] && result[next] === target) {
      visited[next] = 1
      queue.push(next)
    }
  }
  return result
}

export default function PixelCanvasEditor() {
  const [layers, setLayers] = useState<Layer[]>(() => [newLayer('基础图层')])
  const [activeId, setActiveId] = useState('')
  const [tool, setTool] = useState<Tool>('pencil')
  const [color, setColor] = useState('#263b56')
  const [zoom, setZoom] = useState(8)
  const [status, setStatus] = useState('64 × 64 画布已就绪')
  const [history, setHistory] = useState<Array<{ layers: Layer[]; activeId: string }>>([])
  const [future, setFuture] = useState<Array<{ layers: Layer[]; activeId: string }>>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drawing = useRef(false)
  const lastIndex = useRef(-1)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cdpc-pixel-editor-v1')
      if (raw) {
        const value = JSON.parse(raw)
        if (Array.isArray(value.layers) && value.layers.length && value.layers.every((layer: Layer) => Array.isArray(layer.pixels) && layer.pixels.length === SIZE * SIZE)) {
          setLayers(value.layers)
          setActiveId(value.activeId || value.layers[0].id)
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
    if (loaded) {
      try { localStorage.setItem('cdpc-pixel-editor-v1', JSON.stringify({ layers, activeId })) }
      catch { setStatus('本地空间不足，请及时导出 PNG') }
    }
  }, [layers, activeId, loaded])

  const composite = useMemo(() => {
    const result = blank()
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
  }, [layers])

  const render = useCallback((pixels: string[]) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, SIZE, SIZE)
    pixels.forEach((pixel, index) => {
      if (!pixel) return
      ctx.fillStyle = pixel
      ctx.fillRect(index % SIZE, Math.floor(index / SIZE), 1, 1)
    })
  }, [])
  useEffect(() => render(composite), [composite, render])

  const checkpoint = () => {
    setHistory(current => [...current.slice(-39), { layers: JSON.parse(JSON.stringify(layers)), activeId }])
    setFuture([])
  }

  const paint = (index: number) => {
    if (index < 0 || index >= SIZE * SIZE || index === lastIndex.current) return
    lastIndex.current = index
    if (tool === 'eyedropper') {
      const pixel = composite[index]
      const rgba = /^rgba\\((\\d+), (\\d+), (\\d+), ([0-9.]+)\\)$/.exec(pixel)
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
      if (tool === 'fill') return { ...layer, pixels: floodFill(layer.pixels, index, color) }
      const pixels = [...layer.pixels]
      pixels[index] = tool === 'eraser' ? '' : color
      return { ...layer, pixels }
    }))
    if (tool === 'fill') drawing.current = false
  }

  const getIndex = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(63, Math.floor((event.clientX - rect.left) / rect.width * SIZE)))
    const y = Math.max(0, Math.min(63, Math.floor((event.clientY - rect.top) / rect.height * SIZE)))
    return y * SIZE + x
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
    for (const point of bresenhamLine(from % SIZE, Math.floor(from / SIZE), next % SIZE, Math.floor(next / SIZE))) {
      paint(point.y * SIZE + point.x)
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
    const layer = newLayer('图层 ' + (layers.length + 1))
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
      if (image.width !== SIZE || image.height !== SIZE) { setStatus('PNG 必须为 64 × 64 像素'); return }
      const temp = document.createElement('canvas')
      temp.width = SIZE
      temp.height = SIZE
      const ctx = temp.getContext('2d')
      if (!ctx) return
      ctx.drawImage(image, 0, 0)
      const data = ctx.getImageData(0, 0, SIZE, SIZE).data
      const pixels = Array.from({ length: SIZE * SIZE }, (_, index) => {
        const offset = index * 4
        if (data[offset + 3] < 8) return ''
        return '#' + [data[offset], data[offset + 1], data[offset + 2]].map(value => value.toString(16).padStart(2, '0')).join('')
      })
      checkpoint()
      const layer = { ...newLayer(file.name.replace(/\.png$/i, '') || '导入皮肤'), pixels }
      setLayers(current => [...current, layer])
      setActiveId(layer.id)
      setStatus('已导入 PNG，新图层可独立编辑')
    } catch { setStatus('无法读取 PNG 文件') }
    finally { URL.revokeObjectURL(url) }
  }

  const exportPng = async () => {
    const output = document.createElement('canvas')
    output.width = SIZE
    output.height = SIZE
    const ctx = output.getContext('2d')
    if (!ctx) return
    composite.forEach((pixel, index) => {
      if (!pixel) return
      ctx.fillStyle = pixel
      ctx.fillRect(index % SIZE, Math.floor(index / SIZE), 1, 1)
    })
    const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/png'))
    if (!blob) { setStatus('PNG 导出失败'); return }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cdpc-pixel-skin-64x64.png'
    link.click()
    URL.revokeObjectURL(url)
    setStatus('已导出 64 × 64 PNG')
  }

  const saveToWardrobe = async () => {
    setSaving(true)
    try {
      const output = document.createElement('canvas')
      output.width = SIZE
      output.height = SIZE
      const ctx = output.getContext('2d')
      if (!ctx) throw new Error('无法创建画布')
      composite.forEach((pixel, index) => {
        if (!pixel) return
        ctx.fillStyle = pixel
        ctx.fillRect(index % SIZE, Math.floor(index / SIZE), 1, 1)
      })
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('PNG 编码失败')), 'image/png'))
      const form = new FormData()
      form.append('file', blob, 'cdpc-pixel-skin-64x64.png')
      form.append('category', 'SKIN')
      form.append('visibility', 'PRIVATE')
      form.append('attribution', 'CDPC Pixel Editor')
      const response = await fetch('/api/assets', { method: 'POST', body: form, credentials: 'same-origin' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || '保存失败')
      setStatus('已保存到个人衣橱素材')
    } catch (error) { setStatus(error instanceof Error ? error.message : '保存失败') }
    finally { setSaving(false) }
  }

  const active = layers.find(layer => layer.id === activeId)
  return (
    <section className="cdpc-pixel-editor" aria-label="64×64 像素编辑器">
      <header className="cdpc-pixel-header">
        <div><h2>64 × 64 像素编辑器</h2><p>原尺寸编辑 · 多图层 · 撤销重做 · PNG 导入导出</p></div>
        <div className="cdpc-pixel-actions">
          <button type="button" onClick={() => fileRef.current?.click()}>导入 PNG</button>
          <input ref={fileRef} hidden type="file" accept="image/png" onChange={event => { void importPng(event.target.files?.[0]); event.currentTarget.value = '' }} />
          <button type="button" onClick={() => void exportPng()}>导出 PNG</button>
          <button type="button" disabled={saving} onClick={() => void saveToWardrobe()}>{saving ? '保存中…' : '保存到衣橱'}</button>
        </div>
      </header>
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
          <canvas ref={canvasRef} width={SIZE} height={SIZE} aria-label="64 乘 64 像素画布"
            style={{ width: SIZE * zoom + 'px', height: SIZE * zoom + 'px' }}
            onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} />
          <small>透明背景 · 64 × 64 · {status}</small>
        </div>
        <aside className="cdpc-pixel-layers" aria-label="图层面板">
          <div><strong>图层</strong><button type="button" onClick={addLayer}>＋ 新建</button></div>
          {[...layers].reverse().map(layer => (
            <div key={layer.id} className={layer.id === activeId ? 'cdpc-pixel-layer active' : 'cdpc-pixel-layer'}>
              <button type="button" onClick={() => setActiveId(layer.id)}>{layer.name}</button>
              <button type="button" aria-label={layer.visible ? '隐藏' + layer.name : '显示' + layer.name} onClick={() => setLayers(current => current.map(item => item.id === layer.id ? { ...item, visible: !item.visible } : item))}>{layer.visible ? '显示' : '隐藏'}</button>
              <button type="button" aria-label={'删除' + layer.name} onClick={() => removeLayer(layer.id)}>×</button>
            </div>
          ))}
          {active && <label>图层不透明度<input type="range" min="0" max="100" value={active.opacity} onChange={event => setLayers(current => current.map(item => item.id === activeId ? { ...item, opacity: Number(event.target.value) } : item))} /></label>}
          <p>草稿自动保存在本机浏览器；保存到衣橱需要登录。</p>
        </aside>
      </div>
    </section>
  )
}
