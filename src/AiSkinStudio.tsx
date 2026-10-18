import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, LoaderCircle, Sparkles, WandSparkles } from 'lucide-react'
import { SkinViewer } from 'skinview3d'
import './ai-skin-studio.css'

type ModelOption = { id: string; provider: string; model: string; label: string; textToImage: boolean; imageToImage: boolean }
type ModelResponse = { models: ModelOption[]; providers: { id: string; label: string; configured: boolean }[] }
type GenerationResponse = { imageDataUrl: string; provider: string; model: string; elapsedMs: number; notice: string; outputKind: 'minecraft-skin' | 'concept-image'; validation?: { dimensions: string; baseLayerOpaque: boolean; unusedPixelsTransparent: boolean; uvMapped: boolean }; error?: string }

const API_BASE = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_AI_API_BASE_URL ?? '/api/ai').replace(/\/$/, '')

export default function AiSkinStudio({ onBack }: { onBack: () => void }) {
  const [task, setTask] = useState<'text-to-image' | 'image-to-image'>('text-to-image')
  const [prompt, setPrompt] = useState('Minecraft 皮肤角色概念设计，像素艺术，正面全身，方块人比例，清晰的像素边缘，独立角色，纯色背景，不要文字，不要水印')
  const [model, setModel] = useState('auto')
  const [variant, setVariant] = useState<'classic' | 'slim'>('classic')
  const [models, setModels] = useState<ModelOption[]>([])
  const [providers, setProviders] = useState<ModelResponse['providers']>([])
  const [reference, setReference] = useState<File | null>(null)
  const [referenceUrl, setReferenceUrl] = useState('')
  const [result, setResult] = useState<GenerationResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/models`)
      .then(async response => {
        if (!response.ok) throw new Error('AI 服务暂时不可用')
        return response.json() as Promise<ModelResponse>
      })
      .then(data => {
        if (!active) return
        setModels(data.models || [])
        setProviders(data.providers || [])
      })
      .catch(() => {
        if (active) setError('无法连接 AI 服务。请确认 AI API 已部署，并设置 VITE_AI_API_BASE_URL 或同源 /api 代理。')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!result || result.outputKind !== 'minecraft-skin' || !previewCanvasRef.current) return
    let viewer: SkinViewer | null = null
    try {
      viewer = new SkinViewer({ canvas: previewCanvasRef.current, width: 360, height: 440, skin: result.imageDataUrl })
      viewer.controls.enableRotate = true
      viewer.controls.enableZoom = true
      viewer.controls.enablePan = true
      viewer.animation = null
    } catch (cause) {
      setError(cause instanceof Error ? `3D 预览初始化失败：${cause.message}` : '3D 预览初始化失败')
    }
    return () => { viewer?.dispose() }
  }, [result])

  useEffect(() => {
    if (!reference) {
      setReferenceUrl('')
      return
    }
    const url = URL.createObjectURL(reference)
    setReferenceUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [reference])

  async function generate() {
    setError('')
    setResult(null)
    if (prompt.trim().length < 3) {
      setError('请至少输入 3 个字符的描述。')
      return
    }
    if (task === 'image-to-image' && !reference) {
      setError('请先上传要转换或重新设计的参考图。')
      return
    }
    if (!models.length) {
      setError('当前没有可用模型。请在 AI API 服务端配置至少一个供应商的密钥和图像模型。')
      return
    }
    setBusy(true)
    try {
      const body = new FormData()
      body.set('prompt', prompt.trim())
      body.set('model', model)
      body.set('task', task)
      body.set('variant', variant)
      if (task === 'image-to-image' && reference) body.set('reference', reference)
      const response = await fetch(`${API_BASE}/generate`, { method: 'POST', body })
      const data = await response.json() as GenerationResponse
      if (!response.ok) throw new Error(data.error || '生成失败，请稍后重试')
      setResult(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '生成失败，请检查网络或模型配置')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="ai-studio">
      <header className="ai-studio__topbar">
        <button className="ai-studio__back" onClick={onBack}><ArrowLeft size={17} /> 返回皮肤工作台</button>
        <div className="ai-studio__brand"><span className="ai-studio__brand-icon"><img src="/pixcape-icon.svg" alt="" /></span><div><strong>CDPC AI 工坊</strong><small>多模型图像生成 · 实验功能</small></div></div>
        <span className="ai-studio__pill">预览版</span>
      </header>

      <div className="ai-studio__layout">
        <section className="ai-studio__controls">
          <div className="ai-studio__heading"><span>AI CREATOR / 01</span><h1>设计你的角色</h1><p>生成角色正背面图，自动转换为 64×64 Minecraft UV 皮肤纹理。</p></div>

          <div className="ai-studio__field">
            <label>生成方式</label>
            <div className="ai-studio__segmented">
              <button className={task === 'text-to-image' ? 'active' : ''} onClick={() => setTask('text-to-image')}><WandSparkles size={16} /> 文字生成</button>
              <button className={task === 'image-to-image' ? 'active' : ''} onClick={() => setTask('image-to-image')}><ImagePlus size={16} /> 参考图转换</button>
            </div>
          </div>

          <div className="ai-studio__field">
            <label htmlFor="ai-model">图像模型</label>
            <select id="ai-model" value={model} onChange={event => setModel(event.target.value)} disabled={!models.length}>
              <option value="auto">自动选择可用模型</option>
              {models.map(item => <option key={item.id} value={item.id}>{item.label} · {item.model} · {item.imageToImage ? '支持参考图' : '文字生成'}</option>)}
            </select>
            <small>仅显示服务端已配置的模型。不同模型的费用、速度和图像能力可能不同。</small>
          </div>

          {task === 'image-to-image' && <div className="ai-studio__field">
            <label>参考图</label>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => setReference(event.target.files?.[0] || null)} />
            <button className="ai-studio__upload" onClick={() => fileRef.current?.click()}><ImagePlus size={18} /> {reference ? '更换参考图片' : '选择 PNG / JPG / WebP'}</button>
            {referenceUrl && <img className="ai-studio__reference" src={referenceUrl} alt="参考图片预览" />}
          </div>}

          <div className="ai-studio__field">
            <label htmlFor="ai-variant">皮肤模型</label>
            <select id="ai-variant" value={variant} onChange={event => setVariant(event.target.value as 'classic' | 'slim')}>
              <option value="classic">Classic / Steve（4 像素手臂）</option>
              <option value="slim">Slim / Alex（3 像素手臂）</option>
            </select>
            <small>输出为 64×64 UV 纹理；正背面映射仍需在 3D 预览中检查。</small>
          </div>

          <div className="ai-studio__field">
            <label htmlFor="ai-prompt">角色描述</label>
            <textarea id="ai-prompt" rows={7} maxLength={2000} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="描述服装、配色、风格、披肩或披风细节……" />
            <small>{prompt.length}/2000 · 建议明确描述正面视角、像素风格和服装细节。</small>
          </div>

          {error && <div className="ai-studio__error" role="alert">{error}</div>}
          <button className="ai-studio__generate" onClick={generate} disabled={busy || !models.length}>
            {busy ? <><LoaderCircle className="ai-studio__spinner" size={18} /> 正在生成，请稍候…</> : <><Sparkles size={18} /> 生成皮肤 PNG</>}
          </button>
          {!models.length && <p className="ai-studio__hint">配置状态：{providers.length ? providers.filter(item => item.configured).map(item => item.label).join('、') || '尚无已启用的模型' : '正在连接 AI 服务'}。需要在服务端配置 API Key。</p>}
        </section>

        <section className="ai-studio__preview">
          <div className="ai-studio__preview-head"><div><span>OUTPUT / 02</span><h2>生成结果</h2></div>{result && <span className="ai-studio__time">{(result.elapsedMs / 1000).toFixed(1)} 秒</span>}</div>
          <div className={result ? 'ai-studio__canvas has-result' : 'ai-studio__canvas'}>
            {busy ? <div className="ai-studio__loading"><LoaderCircle className="ai-studio__spinner" size={30} /><strong>正在创作</strong><span>模型正在处理你的描述，通常需要一些时间。</span></div> :
              result ? <img src={result.imageDataUrl} alt="AI 生成并映射的 Minecraft 64×64 皮肤纹理" /> :
              <div className="ai-studio__empty"><div className="ai-studio__empty-art"><Sparkles size={34} /></div><strong>你的角色会出现在这里</strong><span>选择模型、写下想法，然后开始生成。</span></div>}
          </div>
          {result?.outputKind === 'minecraft-skin' && <div className="ai-studio__3d-preview"><div><strong>可交互 3D 预览</strong><small>拖动旋转 · 滚轮缩放 · 右键平移</small></div><canvas ref={previewCanvasRef} aria-label="Minecraft 皮肤 3D 预览" /></div>}
          {result && <div className="ai-studio__result-info"><div><strong>{result.provider} / {result.model}</strong><small>{result.outputKind === 'minecraft-skin' ? `Minecraft 64×64 UV 纹理 · ${variant === 'slim' ? 'Slim' : 'Classic'}` : '概念图'}</small></div><a href={result.imageDataUrl} download="pixcape-ai-skin.png">下载皮肤 PNG</a><p>{result.notice}</p></div>}
          <div className="ai-studio__disclaimer"><strong>生成后请检查 3D 预览</strong><p>服务端会将左右双视图投影到标准 64×64 UV 纹理，并强制基础层不透明、未使用区域透明。图像模型的正背面一致性仍可能有误差；导入游戏前请先检查脸部、服装和 Classic / Slim 手臂效果。</p></div>
        </section>
      </div>
      <footer className="cdpc-site-footer">
        <span>CDPC · 皮肤与像素创作工具</span>
        <span>非官方 Minecraft 项目 · 不隶属于 Mojang 或 Microsoft</span>
      </footer>
    </main>
  )
}
