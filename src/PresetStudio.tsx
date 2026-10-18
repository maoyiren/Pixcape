import { useEffect, useMemo, useRef, useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Download, Shirt, Upload, RotateCcw, X, ExternalLink } from 'lucide-react'
import ThreeCapePreview from './ThreeCapePreview'
import PresetThumbnail from './PresetThumbnail'
import './preset-studio.css'
import './preview-options.css'
import './minecraft-inventory.css'

type GarmentKind = 'shawl' | 'coat'
type Preset = { id: string; label: string; file: string; slimFile: string; kind: GarmentKind }

const ASSET_ROOT = 'https://raw.githubusercontent.com/lonelyang/CapeSkinImage/master/examples/img/'
const BASE_SKIN = ASSET_ROOT + 'stevea.png'
const PREVIEW_BACKGROUNDS: Record<'day' | 'night' | 'plains' | 'desert' | 'forest' | 'nether' | 'end', string> = {
  day: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/exploration-mindful.jpg',
  plains: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/exploration-mindful.jpg',
  night: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/MCV_holiday_release_Eyeblossom_NightTrail_1280x720_01.jpg',
  desert: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/exploration-structures.jpg',
  forest: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/forest-carousel1.jpg',
  nether: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/waste-carousel1.jpg',
  end: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/highlands-carousel1.jpg',
}
const CAPES = [
  { id: 'none', label: '不使用披风' },
  { id: 'cape_office.png', label: '眼眸花披风' },
  { id: 'cape_MCC.png', label: 'MCC 披风' },
  { id: 'cape_creeper.png', label: '苦力怕披风' },
  { id: 'cape_tiktok.png', label: 'TikTok 披风' },
  { id: 'cape_twitch.png', label: 'Twitch 披风' },
]
const PRESETS: Preset[] = [
  { id: 'office-shawl', label: '眼眸花披肩', file: 'office_shawl_default_64.png', slimFile: 'office_shawl_slim_64.png', kind: 'shawl' },
  { id: 'mcc-shawl', label: 'MCC 披肩', file: 'MCC_shawl_default_64.png', slimFile: 'MCC_shawl_slim_64.png', kind: 'shawl' },
  { id: 'creeper-shawl', label: '苦力怕披肩', file: 'creeper_shawl_default_64.png', slimFile: 'creeper_shawl_slim_64.png', kind: 'shawl' },
  { id: 'tiktok-shawl', label: 'TikTok 披肩', file: 'tiktok_shawl_default_64.png', slimFile: 'tiktok_shawl_slim_64.png', kind: 'shawl' },
  { id: 'twitch-shawl', label: 'Twitch 披肩', file: 'twitch_shawl_default_64.png', slimFile: 'twitch_shawl_slim_64.png', kind: 'shawl' },
  { id: 'creeper-coat', label: '苦力怕外套', file: 'creeper_coat_default_64.png', slimFile: 'creeper_coat_slim_64.png', kind: 'coat' },
  { id: 'tiktok-coat', label: 'TikTok 外套', file: 'tiktok_coat_default_64.png', slimFile: 'tiktok_coat_slim_64.png', kind: 'coat' },
  { id: 'twitch-coat', label: 'Twitch 外套', file: 'twitch_coat_default_64.png', slimFile: 'twitch_coat_slim_64.png', kind: 'coat' },
]

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (/^https?:/.test(src)) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败：' + src))
    image.src = src
  })
}

const CLOTHING_UV_REGIONS = [
  { x: 16, y: 16, width: 24, height: 16 },
  { x: 16, y: 32, width: 24, height: 16 },
  { x: 40, y: 16, width: 16, height: 16 },
  { x: 40, y: 32, width: 16, height: 16 },
  { x: 32, y: 48, width: 16, height: 16 },
  { x: 48, y: 48, width: 16, height: 16 },
]
function drawClothingTemplate(context: CanvasRenderingContext2D, image: HTMLImageElement) {
  context.save()
  context.beginPath()
  CLOTHING_UV_REGIONS.forEach(({ x, y, width, height }) => context.rect(x, y, width, height))
  context.clip()
  context.imageSmoothingEnabled = false
  context.drawImage(image, 0, 0, 64, 64)
  context.restore()
}

function canvasPixels(canvas: HTMLCanvasElement): string[] {
  const context = canvas.getContext('2d')
  if (!context) return Array(4096).fill('')
  const data = context.getImageData(0, 0, 64, 64).data
  return Array.from({ length: 4096 }, (_, index) => {
    const offset = index * 4
    const alpha = data[offset + 3]
    if (alpha < 24) return ''
    const [red, green, blue] = [data[offset], data[offset + 1], data[offset + 2]]
    return `rgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(3)})`
  })
}

export type PresetEditorPayload = {
  skinDataUrl: string
  skinName: string
  modelType: 'steve' | 'alex'
  shawlName: string
  coatName: string
  capeName?: string
  capeDataUrl?: string
  language?: 'zh-CN' | 'en-US'
}

type StudioLanguage = 'zh-CN' | 'en-US'
type Props = { onOpenEditor: (payload: PresetEditorPayload) => void }
const EN: Record<string, string> = {
'Minecraft 皮肤与服装工作台':'Minecraft Skin & Outfit Studio','当前皮肤':'Current Skin','已就绪':'Ready','正在加载':'Loading','导入皮肤':'Import Skin','导出合成皮肤 PNG':'Export Combined Skin PNG','发送到 Blockbench 编辑':'Send to Blockbench','预制服装':'Presets','披肩':'Shawl','外套':'Jacket','披风':'Cape','角色预览':'Character Preview','Steve 粗臂':'Steve · Classic','Alex 细臂':'Alex · Slim','正面':'Front','背面':'Back','切换为披风':'Switch to Cape','切换为鞘翅':'Switch to Elytra','白天':'Day','夜晚':'Night','平原':'Plains','沙漠':'Desert','森林':'Forest','下界':'Nether','末地':'The End','自定义':'Custom','背景调色':'Background Color','恢复天空蓝':'Reset Sky Blue','站立':'Idle','挥手':'Wave','行走':'Walk','飞行':'Fly','切换动作':'Switch action','缩放':'Zoom','X 轴':'X axis','Y 轴':'Y axis','Z 轴':'Z axis','重置视角':'Reset View','重置':'Reset','选择语言':'Language','拖动旋转 · 上下拖动俯仰 · 滚轮缩放 · 正面 / 背面':'Drag to rotate · vertical drag to tilt · wheel to zoom · front / back','正在加载模板…':'Loading presets…','模板已应用，可旋转预览或导出 PNG':'Preset applied. Rotate preview or export PNG.','备用皮肤已就绪':'Fallback skin ready','已导入皮肤，正在应用模板…':'Skin imported. Applying presets…','皮肤仍在加载，请稍后再打开编辑器。':'Skin is loading. Please wait before opening the editor.','已将当前预制皮肤发送到 Blockbench':'Current preset skin sent to Blockbench','已导出合成皮肤 PNG':'Combined skin PNG exported','请导入 PNG 格式的 Minecraft 皮肤。':'Please import a Minecraft skin in PNG format.','皮肤尺寸必须是标准的 64 × 64 PNG，未修改当前皮肤。':'Skin must be a standard 64 × 64 PNG. Current skin was not changed.','无法读取这张 PNG 图片，请选择有效的皮肤文件。':'Could not read this PNG. Choose a valid skin file.','部分远程模板素材加载失败，已显示备用皮肤；可继续编辑或重新导入 PNG。':'Some remote assets failed. A fallback skin is shown; continue editing or import a PNG.','披肩 / 外套模板 · 实时 3D 预览':'Shawl / jacket presets · live 3D preview'
}
function tr(text: string, language: StudioLanguage): string { return language === 'en-US' ? (EN[text] || text) : text }

export default function PresetStudio({ onOpenEditor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const skinInputRef = useRef<HTMLInputElement>(null)
  const [language, setLanguage] = useState<StudioLanguage>(() => localStorage.getItem('pixcape-language') === 'en-US' ? 'en-US' : 'zh-CN')
  const [skinUrl, setSkinUrl] = useState(BASE_SKIN)
  const [skinName, setSkinName] = useState('Steve 默认皮肤')
  const [shawlId, setShawlId] = useState('office-shawl')
  const [coatId, setCoatId] = useState('none')
  const [capeId, setCapeId] = useState('cape_office.png')
  const [activeCategory, setActiveCategory] = useState<'shawl' | 'coat' | 'cape'>('shawl')
  const [elytraVisible, setElytraVisible] = useState(false)
  const [modelType, setModelType] = useState<'steve' | 'alex'>('steve')
  const [viewSide, setViewSide] = useState<'front' | 'back'>('front')
  const [rotation, setRotation] = useState(-13)
  const [backgroundTheme, setBackgroundTheme] = useState<'day' | 'night' | 'plains' | 'desert' | 'forest' | 'nether' | 'end' | 'custom'>('day')
  const [customBackground, setCustomBackground] = useState('#76b9ee')
  const [tilt, setTilt] = useState(0)
  const [roll, setRoll] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pose, setPose] = useState<'idle' | 'wave' | 'walk' | 'fly'>('idle')
  const [pixels, setPixels] = useState<string[]>(Array(4096).fill(''))
  const [status, setStatus] = useState('正在加载模板…')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  const shawls = useMemo(() => PRESETS.filter(item => item.kind === 'shawl'), [])
  const coats = useMemo(() => PRESETS.filter(item => item.kind === 'coat'), [])
  const layers = useMemo(() => [{ pixels, visible: true, opacity: 100 }], [pixels])

  useEffect(() => () => {
    if (skinUrl.startsWith('blob:')) URL.revokeObjectURL(skinUrl)
  }, [skinUrl])

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) return
      setReady(false)
      setError('')
      let baseImage: HTMLImageElement | null = null
      try {
        baseImage = await loadImage(skinUrl)
        const selected = [PRESETS.find(item => item.id === coatId), PRESETS.find(item => item.id === shawlId)].filter((item): item is Preset => Boolean(item))
        const overlays = await Promise.all(selected.map(item => loadImage(ASSET_ROOT + (modelType === 'alex' ? item.slimFile : item.file))))
        if (cancelled) return
        context.clearRect(0, 0, 64, 64)
        context.imageSmoothingEnabled = false
        context.drawImage(baseImage, 0, 0, 64, 64)
        overlays.forEach(image => drawClothingTemplate(context, image))
        setPixels(canvasPixels(canvas))
        setReady(true)
        setStatus('模板已应用，可旋转预览或导出 PNG')
      } catch {
        if (!cancelled) {
          // Keep the editor usable if the third-party asset host is blocked or offline.
          context.clearRect(0, 0, 64, 64)
          context.imageSmoothingEnabled = false
          if (baseImage) {
            context.drawImage(baseImage, 0, 0, 64, 64)
          } else {
            const pixel = (x: number, y: number, w: number, h: number, color: string) => {
              context.fillStyle = color
              context.fillRect(x, y, w, h)
            }
            context.fillStyle = '#b98a62'; context.fillRect(0, 0, 64, 64)
            pixel(8, 0, 8, 8, '#513322'); pixel(16, 0, 8, 8, '#513322')
            pixel(8, 8, 8, 8, '#d9a477'); pixel(16, 8, 8, 8, '#d9a477')
            pixel(10, 10, 2, 2, '#3b3026'); pixel(18, 10, 2, 2, '#3b3026')
            pixel(12, 14, 8, 2, '#8d453a')
            pixel(20, 20, 8, 12, '#3768a5'); pixel(28, 20, 8, 12, '#3768a5')
            pixel(44, 20, 4, 12, '#d9a477'); pixel(48, 20, 4, 12, '#d9a477')
            pixel(4, 20, 4, 12, '#d9a477'); pixel(8, 20, 4, 12, '#d9a477')
            pixel(20, 36, 8, 12, '#3768a5'); pixel(28, 36, 8, 12, '#3768a5')
            pixel(4, 36, 4, 12, '#303f73'); pixel(8, 36, 4, 12, '#303f73')
            pixel(12, 36, 4, 12, '#303f73'); pixel(16, 36, 4, 12, '#303f73')
          }
          setPixels(canvasPixels(canvas))
          setReady(true)
          setError('部分远程模板素材加载失败，已显示备用皮肤；可继续编辑或重新导入 PNG。')
          setStatus('备用皮肤已就绪')
        }
      }
    }
    void render()
    return () => { cancelled = true }
  }, [skinUrl, shawlId, coatId, modelType])

  const openEditorWithPreset = () => {
    const canvas = canvasRef.current
    if (!canvas || !ready) {
      setError('皮肤仍在加载，请稍后再打开编辑器。')
      return
    }

    // Opening Blockbench must not wait for remote cape/template hosts.
    // The visible canvas is already the successfully composed 64x64 skin.
    let skinDataUrl: string
    try {
      skinDataUrl = canvas.toDataURL('image/png')
    } catch {
      setError('无法导出当前皮肤，请重新导入 PNG 后再试。')
      return
    }

    onOpenEditor({
      skinDataUrl,
      skinName: (skinName.replace(/\.png$/i, '') || 'pixcape-skin') + '-pixcape.png',
      modelType,
      shawlName: PRESETS.find(item => item.id === shawlId)?.label || '不使用披肩',
      coatName: PRESETS.find(item => item.id === coatId)?.label || '不使用外套',
      capeName: capeId === 'none' ? undefined : (CAPES.find(item => item.id === capeId)?.label || capeId) + '.png',
      // Cape texture loading is intentionally optional: a slow third-party
      // asset host must never prevent the full editor from opening.
      capeDataUrl: undefined,
      language,
    })
    setStatus('已将当前预制皮肤发送到 Blockbench')
  }

  const exportCape = async () => {
    if (capeId === 'none') return
    try {
      const image = await loadImage(ASSET_ROOT + capeId)
      const output = document.createElement('canvas')
      output.width = image.naturalWidth || 64
      output.height = image.naturalHeight || 32
      const context = output.getContext('2d')
      if (!context) throw new Error('canvas unavailable')
      context.drawImage(image, 0, 0)
      const link = document.createElement('a')
      link.download = capeId
      link.href = output.toDataURL('image/png')
      link.click()
      setStatus('已单独导出披风纹理 PNG')
    } catch { setError('披风纹理加载失败，暂时无法导出。请检查网络连接。') }
  }

  const exportPng = () => {
    const canvas = canvasRef.current
    if (!canvas || !ready) return
    const link = document.createElement('a')
    link.download = 'pixcape-preset-skin.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
    setStatus('已导出合成皮肤 PNG')
  }

  const importSkin = (file?: File) => {
    if (!file) return
    if (file.type !== 'image/png') {
      setError('请导入 PNG 格式的 Minecraft 皮肤。')
      return
    }
    const url = URL.createObjectURL(file)
    const probe = new Image()
    probe.onload = () => {
      if (probe.naturalWidth !== 64 || probe.naturalHeight !== 64) {
        URL.revokeObjectURL(url)
        setError('皮肤尺寸必须是标准的 64 × 64 PNG，未修改当前皮肤。')
        return
      }
      setSkinUrl(previous => {
        if (previous.startsWith('blob:')) URL.revokeObjectURL(previous)
        return url
      })
      setSkinName(file.name)
      setError('')
      setStatus('已导入皮肤，正在应用模板…')
    }
    probe.onerror = () => {
      URL.revokeObjectURL(url)
      setError('无法读取这张 PNG 图片，请选择有效的皮肤文件。')
    }
    probe.src = url
  }

  const reset = () => {
    setSkinUrl(BASE_SKIN)
    setSkinName('Steve 默认皮肤')
    setShawlId('office-shawl')
    setCoatId('none')
    setCapeId('cape_office.png')
    setElytraVisible(false)
    setModelType('steve')
    setViewSide('front')
    setRotation(-13)
    setTilt(0)
    setZoom(1)
    setBackgroundTheme('day')
    setCustomBackground('#76b9ee')
    setPose('idle')
    setError('')
    setStatus('已恢复默认模板')
  }

  return <div className="preset-shell">
    <header className="preset-topbar">
      <a className="preset-brand" href="#" onClick={event => event.preventDefault()}><span>✦</span> Pixcape <small>PRESET STUDIO</small></a>
      <div className="preset-top-actions"><span className="preset-workspace-label">{tr('Minecraft 皮肤与服装工作台', language)}</span><label className="preset-language-switch">{tr('选择语言', language)} <select aria-label="Language" value={language} onChange={event => { const next = event.target.value as StudioLanguage; setLanguage(next); localStorage.setItem('pixcape-language', next); document.documentElement.lang = next }}><option value="zh-CN">简体中文</option><option value="en-US">English</option></select></label></div>
    </header>
    <aside role="note" aria-label="项目声明与素材署名" style={{ padding: '6px 16px', borderBottom: '1px solid #65552d', background: '#28251b', color: '#f2e4b7', fontSize: 11, lineHeight: 1.4 }}>
      {language === 'en-US' ? 'Unofficial Minecraft project · Coat & shawl assets: 邹陈云飞, Th千' : '非官方 Minecraft 项目 · 外套与披肩素材：邹陈云飞、Th千'}
    </aside>
    <section className="preset-current-skin">
      <div className="preset-current-skin-title"><div><small>YOUR SKIN</small><h2>{tr('当前皮肤', language)}</h2></div><span className={ready ? 'preset-current-ready' : ''}><i/> {tr(ready ? '已就绪' : '正在加载', language)}</span></div>
      <div className="preset-skin-card"><div className="preset-skin-thumb"><canvas ref={canvasRef} width={64} height={64}/></div><div className="preset-skin-meta"><strong>{skinName}</strong><small>64 × 64 · PNG · 已应用所选披肩 / 外套</small></div></div>
      <div className="preset-current-actions">
        <button className="preset-import" onClick={() => skinInputRef.current?.click()}><Upload size={16}/> {tr('导入皮肤', language)}</button>
        <Tooltip.Provider delayDuration={300}><Tooltip.Root><Tooltip.Trigger asChild><button className="preset-export-skin" onClick={exportPng} disabled={!ready}><Download size={16}/> {tr('导出合成皮肤 PNG', language)}</button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="preset-tooltip" side="bottom" sideOffset={6}>将当前皮肤与所选披肩、外套合成为 64 × 64 PNG。<Tooltip.Arrow className="preset-tooltip-arrow"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>
        <button className="preset-open-blockbench" onClick={openEditorWithPreset} disabled={!ready}><ExternalLink size={15}/> {tr('发送到 Blockbench 编辑', language)}</button>
      </div>
      <input ref={skinInputRef} hidden type="file" accept="image/png" onChange={event => { importSkin(event.target.files?.[0]); event.currentTarget.value = '' }}/>
      {error && <div className="preset-error">{tr(error, language)}</div>}
    </section>
    <main className="preset-layout">
      <aside className="preset-library">
        <div className="preset-heading"><div><small>LIBRARY</small><h1>{tr('预制服装', language)}</h1></div><Shirt size={22}/></div>
        <p className="preset-description">披肩、外套、披风分栏展示。披肩与外套可合成到皮肤；披风作为独立纹理选择与导出。完整模型、纹理和动画编辑请打开 Blockbench。</p>
        <Tabs.Root className="preset-tabs-root" value={activeCategory} onValueChange={value => setActiveCategory(value as 'shawl' | 'coat' | 'cape')}>
          <Tabs.List className="preset-category-tabs" aria-label="预制服装分类">
            <Tabs.Trigger value="shawl" className="preset-category-tab">披肩 <small>SHAWL</small></Tabs.Trigger>
            <Tabs.Trigger value="coat" className="preset-category-tab">外套 <small>COAT</small></Tabs.Trigger>
            <Tabs.Trigger value="cape" className="preset-category-tab">披风 <small>CAPE</small></Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="shawl" className="preset-tab-panel">
            <section className="preset-section">
              <div className="preset-section-title">选择披肩 <span>{shawls.length} 款</span></div>
              <div className="preset-options">
                <button className={'preset-option ' + (shawlId === 'none' ? 'chosen' : '')} onClick={() => setShawlId('none')}><span className="preset-swatch no-swatch"><X size={18}/></span><span>不使用披肩</span></button>
                {shawls.map(item => <button key={item.id} className={'preset-option ' + (shawlId === item.id ? 'chosen' : '')} onClick={() => setShawlId(item.id)}><PresetThumbnail kind="skin" imageUrl={ASSET_ROOT + item.file} slimImageUrl={ASSET_ROOT + item.slimFile} modelType={modelType}/><span>{item.label}</span></button>)}
              </div>
            </section>
          </Tabs.Content>
          <Tabs.Content value="coat" className="preset-tab-panel">
            <section className="preset-section">
              <div className="preset-section-title">选择外套 <span>{coats.length} 款</span></div>
              <div className="preset-options">
                <button className={'preset-option ' + (coatId === 'none' ? 'chosen' : '')} onClick={() => setCoatId('none')}><span className="preset-swatch no-swatch"><X size={18}/></span><span>不使用外套</span></button>
                {coats.map(item => <button key={item.id} className={'preset-option ' + (coatId === item.id ? 'chosen' : '')} onClick={() => setCoatId(item.id)}><PresetThumbnail kind="skin" imageUrl={ASSET_ROOT + item.file} slimImageUrl={ASSET_ROOT + item.slimFile} modelType={modelType}/><span>{item.label}</span></button>)}
              </div>
            </section>
          </Tabs.Content>
          <Tabs.Content value="cape" className="preset-tab-panel">
            <section className="preset-section">
              <div className="preset-section-title">选择披风 <span>独立纹理</span></div>
              <div className="preset-options">
                {CAPES.map(item => <button key={item.id} className={'preset-option ' + (capeId === item.id ? 'chosen' : '')} onClick={() => setCapeId(item.id)}>{item.id === 'none' ? <span className="preset-swatch no-swatch"><X size={18}/></span> : <PresetThumbnail kind="cape" imageUrl={ASSET_ROOT + item.id} showAuthor={false}/>}<span>{item.label}</span></button>)}
              </div>
              <button className="preset-import" onClick={exportCape} disabled={capeId === 'none'}><Download size={15}/> 单独导出披风 PNG</button>
            </section>
          </Tabs.Content>
        </Tabs.Root>
        <div className="preset-attribution">模板素材来源：<a href="https://github.com/lonelyang/CapeSkinImage" target="_blank" rel="noreferrer">CapeSkinImage</a>。披肩和外套使用角色 3D 渲染图；作者仅标注在披肩、外套预览图下方；披风不显示作者。</div>
      </aside>
      <section className="preset-preview-column">
        <div className="preset-preview-heading"><div><small>LIVE PREVIEW</small><h2>{tr('角色预览', language)}</h2></div><div className="preset-preview-controls"><div className="preset-model-switch"><button className={modelType === 'steve' ? 'active' : ''} onClick={() => setModelType('steve')}>{tr('Steve 粗臂', language)}</button><button className={modelType === 'alex' ? 'active' : ''} onClick={() => setModelType('alex')}>{tr('Alex 细臂', language)}</button></div><div className="preset-model-switch"><button className={viewSide === 'front' ? 'active' : ''} onClick={() => setViewSide('front')}>{tr('正面', language)}</button><button className={viewSide === 'back' ? 'active' : ''} onClick={() => setViewSide('back')}>{tr('背面', language)}</button></div><div className="preset-model-switch"><button className={elytraVisible ? 'active' : ''} onClick={() => setElytraVisible(value => !value)}>{tr(elytraVisible ? '切换为披风' : '切换为鞘翅', language)}</button></div><div className="preset-model-switch preset-scene-switch preset-biome-switch" aria-label="Minecraft 背景区域"><button className={backgroundTheme === 'day' ? 'active' : ''} onClick={() => setBackgroundTheme('day')}>{tr('白天', language)}</button><button className={backgroundTheme === 'night' ? 'active' : ''} onClick={() => setBackgroundTheme('night')}>{tr('夜晚', language)}</button><button className={backgroundTheme === 'plains' ? 'active' : ''} onClick={() => setBackgroundTheme('plains')}>{tr('平原', language)}</button><button className={backgroundTheme === 'desert' ? 'active' : ''} onClick={() => setBackgroundTheme('desert')}>{tr('沙漠', language)}</button><button className={backgroundTheme === 'forest' ? 'active' : ''} onClick={() => setBackgroundTheme('forest')}>{tr('森林', language)}</button><button className={backgroundTheme === 'nether' ? 'active' : ''} onClick={() => setBackgroundTheme('nether')}>{tr('下界', language)}</button><button className={backgroundTheme === 'end' ? 'active' : ''} onClick={() => setBackgroundTheme('end')}>{tr('末地', language)}</button><button className={backgroundTheme === 'custom' ? 'active' : ''} onClick={() => setBackgroundTheme('custom')}>{tr('自定义', language)}</button></div>
          {backgroundTheme === 'custom' && <label className="preset-color-picker"><span>{tr('背景调色', language)}</span><input type="color" value={customBackground} onChange={event => setCustomBackground(event.target.value)}/><code>{customBackground.toUpperCase()}</code><button type="button" onClick={() => setCustomBackground('#76b9ee')}>{tr('恢复天空蓝', language)}</button></label>}<div className="preset-model-switch preset-scene-switch preset-action-switch" aria-label="角色动作"><button type="button" onClick={() => setPose(current => ({ idle: 'wave', wave: 'walk', walk: 'fly', fly: 'idle' } as const)[current])} aria-label="切换角色动作"><span>{tr(({ idle: '站立', wave: '挥手', walk: '行走', fly: '飞行' })[pose], language)}</span><span aria-hidden="true"> ↻ </span><small>{tr('切换动作', language)}</small></button></div></div></div>
        <div className={'preset-model-stage scene-' + backgroundTheme} style={backgroundTheme === 'custom' ? { background: customBackground } : undefined}><ThreeCapePreview backgroundImageUrl={backgroundTheme === 'custom' ? undefined : PREVIEW_BACKGROUNDS[backgroundTheme]} backgroundColor={backgroundTheme === 'custom' ? customBackground : '#76b9ee'} layers={layers} side={viewSide} rotation={rotation} tilt={tilt} roll={roll} zoom={zoom} modelType={modelType} onRotationChange={setRotation} onTiltChange={setTilt} onRollChange={setRoll} onZoomChange={setZoom} capeTextureUrl={capeId === 'none' ? undefined : ASSET_ROOT + capeId} capeVisible={capeId !== 'none'} elytraVisible={elytraVisible} pose={pose}/><div className="preset-model-caption">拖动旋转视角 · 停止拖动即停止 · 滚轮或双指缩放</div></div>
        <div className="preset-view-adjust"><label>{tr('缩放', language)} <input aria-label="预览缩放" type="range" min="0.65" max="1.8" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))}/><span>{Math.round(zoom * 100)}%</span></label><button type="button" onClick={() => { setRotation(-13); setTilt(0); setRoll(0); setZoom(1) }}>{tr('重置视角', language)}</button></div>
        {error && <div className="preset-error">{error}</div>}
        <div className="preset-preview-footer"><span className={ready ? 'preset-status-ready' : ''}><i/> {tr(status, language)}</span><button onClick={reset}><RotateCcw size={14}/> {tr('重置', language)}</button></div>
      </section>

    </main>
    <footer className="preset-footer"><span>Pixcape · 预制服装工作台</span><span>外套与披肩素材：邹陈云飞、Th千</span></footer>
  </div>
}
