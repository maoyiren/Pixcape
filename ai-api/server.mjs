import express from 'express'
import helmet from 'helmet'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { convertPanelToSkin } from './skin/converter.mjs'
import sharp from 'sharp'

const app = express()
const port = Number(process.env.PORT || 8787)
const maxUploadMb = Math.min(10, Math.max(1, Number(process.env.AI_MAX_UPLOAD_MB || 8)))
const rateLimitPerMinute = Math.min(30, Math.max(1, Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 5)))
const requestTimeoutMs = Math.min(180_000, Math.max(10_000, Number(process.env.AI_TIMEOUT_MS || 90_000)))
const allowedOrigins = (process.env.AI_ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const valid = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)
    if (!valid) return callback(new Error('仅支持 PNG、JPEG 或 WebP 图片'))
    callback(null, true)
  },
})

app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(express.json({ limit: '32kb' }))
app.use((req, res, next) => {
  const origin = req.headers.origin
  let sameOrigin = false
  if (origin) {
    try { sameOrigin = new URL(origin).host === req.headers.host } catch { sameOrigin = false }
  }
  const explicitlyAllowed = Boolean(origin && allowedOrigins.includes(origin))
  if (explicitlyAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  }
  if (req.method === 'OPTIONS') return (explicitlyAllowed || sameOrigin) ? res.sendStatus(204) : res.status(403).end()
  if (origin && !explicitlyAllowed && !sameOrigin) return res.status(403).json({ error: '此来源未获允许访问 AI 服务' })
  next()
})

const buckets = new Map()
app.use('/api/ai', (req, res, next) => {
  const now = Date.now()
  const key = req.ip || req.socket.remoteAddress || 'unknown'
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 })
  } else if (current.count >= rateLimitPerMinute) {
    res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)))
    return res.status(429).json({ error: '请求过于频繁，请稍后重试' })
  } else {
    current.count += 1
  }
  if (buckets.size > 5000) {
    for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey)
  }
  next()
})

function modelList(pluralName, singularName, fallback = '') {
  const raw = process.env[pluralName] || process.env[singularName] || fallback
  return [...new Set(raw.split(/[;,]/).map(value => value.trim()).filter(Boolean))]
}
let configured = {}
let openRouterImageToImageModels = []
let seedreamModels = []
let configuredModels = {}
function reloadConfigFromEnv() {
  configured = {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    seedream: Boolean(process.env.ARK_API_KEY || process.env.VOLCENGINE_ARK_API_KEY),
  }
  openRouterImageToImageModels = modelList('OPENROUTER_IMAGE_TO_IMAGE_MODELS', 'OPENROUTER_IMAGE_TO_IMAGE_MODEL')
  seedreamModels = modelList('SEEDREAM_IMAGE_MODELS', 'SEEDREAM_IMAGE_MODEL', 'doubao-seedream-4-0-250828')
  configuredModels = {
    gemini: modelList('GEMINI_IMAGE_MODELS', 'GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image'),
    openai: modelList('OPENAI_IMAGE_MODELS', 'OPENAI_IMAGE_MODEL', 'gpt-image-1'),
    openrouter: modelList('OPENROUTER_IMAGE_MODELS', 'OPENROUTER_IMAGE_MODEL'),
  }
}
reloadConfigFromEnv()

let lastConfigRefresh = 0
let configRefreshPromise = null
async function refreshRemoteConfig(force = false) {
  const configUrl = process.env.AI_CONFIG_URL
  const token = process.env.AI_CONFIG_SYNC_TOKEN
  if (!configUrl || !token) return
  if (!force && Date.now() - lastConfigRefresh < 15000) return
  if (configRefreshPromise) return configRefreshPromise
  configRefreshPromise = (async () => {
    try {
      const response = await fetch(configUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`config endpoint HTTP ${response.status}`)
      const payload = await response.json()
      const values = payload?.env
      if (!values || typeof values !== 'object') throw new Error('invalid config payload')
      const allowed = [
        'AI_DEFAULT_PROVIDER', 'AI_DEFAULT_MODEL', 'GEMINI_IMAGE_MODELS', 'OPENAI_IMAGE_MODELS',
        'OPENROUTER_IMAGE_MODELS', 'SEEDREAM_IMAGE_MODELS', 'ARK_BASE_URL',
        'GEMINI_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'ARK_API_KEY',
      ]
      for (const key of allowed) if (typeof values[key] === 'string') process.env[key] = values[key]
      lastConfigRefresh = Date.now()
      reloadConfigFromEnv()
      console.info('[ai-config] refreshed from CDPC admin settings')
    } catch (error) {
      // Continue using the last known or deployment environment configuration.
      console.warn('[ai-config] refresh failed; retaining current settings', error instanceof Error ? error.message : 'unknown error')
      lastConfigRefresh = Date.now()
    } finally {
      configRefreshPromise = null
    }
  })()
  return configRefreshPromise
}

function getModels() {
  const models = []
  if (configured.gemini) for (const model of configuredModels.gemini) models.push({ id: `gemini:${model}`, provider: 'gemini', model, label: 'Google Gemini', textToImage: true, imageToImage: true })
  if (configured.openai) for (const model of configuredModels.openai) models.push({ id: `openai:${model}`, provider: 'openai', model, label: 'OpenAI Images', textToImage: true, imageToImage: true })
  if (configured.openrouter) for (const model of configuredModels.openrouter) models.push({ id: `openrouter:${model}`, provider: 'openrouter', model, label: 'OpenRouter', textToImage: true, imageToImage: openRouterImageToImageModels.includes(model) })
  if (configured.seedream) for (const model of seedreamModels) models.push({ id: `seedream:${model}`, provider: 'seedream', model, label: 'Doubao Seedream', textToImage: true, imageToImage: true })
  return models
}

function parseModel(modelId) {
  if (!modelId || modelId === 'auto') {
    const available = getModels()
    if (!available.length) throw new Error('AI_PROVIDER_NOT_CONFIGURED')
    const defaultModelId = process.env.AI_DEFAULT_MODEL
    const explicitDefault = defaultModelId ? available.find(item => item.id === defaultModelId || item.model === defaultModelId) : null
    const preferred = process.env.AI_DEFAULT_PROVIDER
    return explicitDefault || (preferred && preferred !== 'auto' ? available.find(item => item.provider === preferred) : null) || available[0]
  }
  const model = getModels().find(item => item.id === modelId)
  if (!model) throw new Error('所选模型未配置或不可用，请检查服务端 API Key 与模型 ID')
  return model
}

function timeoutSignal() {
  return AbortSignal.timeout(requestTimeoutMs)
}

async function responseError(response, provider) {
  // Avoid logging provider response bodies: they may echo prompts or other user-supplied data.
  console.error('[ai-provider-error]', { provider, status: response.status, requestId: randomUUID() })
  if (response.status === 401 || response.status === 403) throw new Error(`${provider} API 认证失败，请检查服务端密钥与权限`)
  if (response.status === 429) throw new Error(`${provider} 当前请求受限或额度不足，请稍后重试`)
  throw new Error(`${provider} 生成失败（HTTP ${response.status}）`)
}

function imageFromParts(parts = []) {
  for (const part of parts) {
    const data = part.inlineData?.data || part.inline_data?.data
    const mime = part.inlineData?.mimeType || part.inline_data?.mime_type || 'image/png'
    if (data && mime.startsWith('image/')) return { mime, data }
  }
  return null
}

async function generateGemini(model, prompt, image) {
  const parts = [{ text: prompt }]
  if (image) parts.push({ inlineData: { mimeType: image.mimetype, data: image.buffer.toString('base64') } })
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
    signal: timeoutSignal(),
  })
  if (!response.ok) await responseError(response, 'Gemini')
  const body = await response.json()
  const result = imageFromParts(body.candidates?.flatMap(candidate => candidate.content?.parts || []) || [])
  if (!result) throw new Error('Gemini 没有返回图像。请尝试更明确的提示词或更换模型。')
  return { mimeType: result.mime, imageDataUrl: `data:${result.mime};base64,${result.data}` }
}

async function generateOpenAI(model, prompt, image) {
  const endpoint = image ? 'https://api.openai.com/v1/images/edits' : 'https://api.openai.com/v1/images/generations'
  const headers = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
  let body
  if (image) {
    body = new FormData()
    body.set('model', model.model)
    body.set('prompt', prompt)
    body.append('image[]', new Blob([image.buffer], { type: image.mimetype }), image.originalname || 'reference.png')
    body.set('size', '1024x1024')
  } else {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify({ model: model.model, prompt, size: '1024x1024' })
  }
  const response = await fetch(endpoint, { method: 'POST', headers, body, signal: timeoutSignal() })
  if (!response.ok) await responseError(response, 'OpenAI')
  const payload = await response.json()
  const data = payload.data?.[0]?.b64_json
  if (!data) throw new Error('OpenAI 没有返回可读取的图像数据')
  return { mimeType: 'image/png', imageDataUrl: `data:image/png;base64,${data}` }
}

async function generateOpenRouter(model, prompt, image) {
  if (!configuredModels.openrouter.includes(model.model)) throw new Error('请在服务端设置 OPENROUTER_IMAGE_MODELS 中的有效模型 ID')
  const userContent = [{ type: 'text', text: prompt }]
  if (image) userContent.push({ type: 'image_url', image_url: { url: `data:${image.mimetype};base64,${image.buffer.toString('base64')}` } })
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://pixcape.app',
      'X-Title': 'Pixcape AI Skin Studio',
    },
    body: JSON.stringify({ model: model.model, modalities: ['image', 'text'], messages: [{ role: 'user', content: userContent }] }),
    signal: timeoutSignal(),
  })
  if (!response.ok) await responseError(response, 'OpenRouter')
  const payload = await response.json()
  const message = payload.choices?.[0]?.message
  const imageUrl = message?.images?.[0]?.image_url?.url || message?.images?.[0]?.url
  if (imageUrl?.startsWith('data:image/')) return { mimeType: imageUrl.slice(5, imageUrl.indexOf(';')), imageDataUrl: imageUrl }
  const text = typeof message?.content === 'string' ? message.content : ''
  const match = text.match(/data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)/)
  if (match) return { mimeType: `image/${match[1]}`, imageDataUrl: `data:image/${match[1]};base64,${match[2]}` }
  throw new Error('此 OpenRouter 模型没有返回图像。请在服务端选择支持图像输出的模型 ID。')
}

async function generateSeedream(model, prompt, image) {
  const apiKey = process.env.ARK_API_KEY || process.env.VOLCENGINE_ARK_API_KEY
  const baseUrl = (process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '')
  const payload = {
    model: model.model,
    prompt,
    size: process.env.SEEDREAM_IMAGE_SIZE || '2K',
    output_format: 'png',
    response_format: 'url',
    watermark: false,
  }
  if (image) payload.image = `data:${image.mimetype};base64,${image.buffer.toString('base64')}`
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: timeoutSignal(),
  })
  if (!response.ok) await responseError(response, 'Doubao Seedream')
  const result = await response.json()
  const item = result.data?.[0]
  if (item?.b64_json) return { mimeType: 'image/png', imageDataUrl: `data:image/png;base64,${item.b64_json}` }
  if (!item?.url) throw new Error('Doubao Seedream 没有返回图像。请检查模型 ID、模型权限与账户额度。')
  let imageUrl
  try { imageUrl = new URL(item.url) } catch { throw new Error('Doubao Seedream 返回了无效的图像地址') }
  if (imageUrl.protocol !== 'https:' || !/(^|\.)volces\.com$|(^|\.)volcengine\.com$/.test(imageUrl.hostname)) {
    throw new Error('Doubao Seedream 返回的图像地址域名不在允许范围内')
  }
  const imageResponse = await fetch(imageUrl, { signal: timeoutSignal(), redirect: 'error' })
  if (!imageResponse.ok) throw new Error('无法读取 Doubao Seedream 生成的图像')
  const bytes = Buffer.from(await imageResponse.arrayBuffer())
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('Doubao Seedream 图像为空或超过 20 MB')
  const metadata = await sharp(bytes, { limitInputPixels: 16_777_216 }).metadata()
  if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || !metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096) {
    throw new Error('Doubao Seedream 返回的图像格式或尺寸无效')
  }
  return { mimeType: 'image/png', imageDataUrl: `data:image/png;base64,${(await sharp(bytes).png().toBuffer()).toString('base64')}` }
}

async function runProvider(model, prompt, image) {
  if (model.provider === 'gemini') return generateGemini(model, prompt, image)
  if (model.provider === 'openai') return generateOpenAI(model, prompt, image)
  if (model.provider === 'openrouter') return generateOpenRouter(model, prompt, image)
  if (model.provider === 'seedream') return generateSeedream(model, prompt, image)
  throw new Error('不支持的模型供应商')
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }))
app.get('/api/ai/models', (_req, res) => {
  const models = getModels()
  res.json({
    models,
    providers: [
      { id: 'gemini', label: 'Google Gemini', configured: configured.gemini },
      { id: 'openai', label: 'OpenAI Images', configured: configured.openai },
      { id: 'openrouter', label: 'OpenRouter', configured: configured.openrouter && configuredModels.openrouter.length > 0 },
      { id: 'seedream', label: 'Doubao Seedream', configured: configured.seedream && seedreamModels.length > 0 },
    ],
  })
})

app.post('/api/ai/generate', upload.single('reference'), async (req, res) => {
  const startedAt = Date.now()
  const requestId = randomUUID()
  try {
    const prompt = String(req.body?.prompt || '').trim()
    if (prompt.length < 3 || prompt.length > 2000) return res.status(400).json({ error: '提示词长度需为 3–2000 个字符' })
    const variant = req.body?.variant === 'slim' ? 'slim' : 'classic'
    const skinPrompt = `${prompt}\n\n输出格式硬性要求：生成一张正方形图片，纯白背景，左右两半各有一个完整的 Minecraft 方块角色。左半必须是严格正面正交视图，右半必须是严格背面正交视图；两个人物尺寸、站立高度、比例完全一致，头顶到脚底占画面高度约 90%，手臂自然垂下，双腿分开少许。采用清晰的低分辨率像素艺术，禁止斜视、三分之四视角、文字、水印、阴影、道具、背景场景。模型手臂宽度：${variant === 'slim' ? '3 像素（Slim/Alex）' : '4 像素（Classic/Steve）'}。这张图将自动投影为 Minecraft 64×64 UV 皮肤纹理，请让正背面服装细节对齐。`
    const task = req.body?.task === 'image-to-image' ? 'image-to-image' : 'text-to-image'
    if (task === 'image-to-image' && !req.file) return res.status(400).json({ error: '参考图转换模式需要上传一张图片' })
    if (req.file) {
      const metadata = await sharp(req.file.buffer, { limitInputPixels: 16_777_216 }).metadata()
      if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || !metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096 || metadata.width * metadata.height > 16_777_216) return res.status(400).json({ error: '参考图必须是有效的 PNG/JPEG/WebP，且宽高不超过 4096 像素' })
    }
    if (task === 'text-to-image' && req.file) return res.status(400).json({ error: '文字生成模式不接受参考图，请切换到参考图转换模式' })
    const model = parseModel(String(req.body?.model || 'auto'))
    if (task === 'image-to-image' && !model.imageToImage) return res.status(400).json({ error: '所选模型未配置或不支持参考图输入，请选择支持参考图的模型。' })
    const started = Date.now()
    const generated = await runProvider(model, skinPrompt, req.file || null)
    const skinPng = await convertPanelToSkin(Buffer.from(generated.imageDataUrl.split(',')[1], 'base64'), variant)
    console.info('[ai-generation]', { requestId, provider: model.provider, model: model.model, task, variant, elapsedMs: Date.now() - started })
    res.json({ requestId, provider: model.provider, model: model.model, task, variant, elapsedMs: Date.now() - startedAt, imageDataUrl: `data:image/png;base64,${skinPng.toString('base64')}`, mimeType: 'image/png', outputKind: 'minecraft-skin', validation: { dimensions: '64x64', baseLayerOpaque: true, unusedPixelsTransparent: true, uvMapped: true }, notice: '已生成 64×64 UV 纹理并进行基础结构校验。请在 3D 预览中检查面部、衣物和手臂模型后再使用。' })
  } catch (error) {
    if (error instanceof multer.MulterError) return res.status(413).json({ error: '参考图过大或上传数量不正确' })
    const message = error instanceof Error ? error.message : 'AI 生成失败，请稍后重试'
    const status = message === 'AI_PROVIDER_NOT_CONFIGURED' ? 503 : 502
    if (message === 'AI_PROVIDER_NOT_CONFIGURED') return res.status(503).json({ error: '尚未配置 AI 模型。请在服务端设置至少一个供应商的 API Key。' })
    console.error('[ai-generation-failed]', { requestId, elapsedMs: Date.now() - startedAt, error: message })
    res.status(status).json({ error: message })
  }
})

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(413).json({ error: '上传文件过大或格式不正确' })
  if (error instanceof SyntaxError) return res.status(400).json({ error: '请求格式无效' })
  res.status(400).json({ error: error instanceof Error ? error.message : '请求无效' })
})

app.listen(port, '0.0.0.0', () => console.info(`Pixcape AI API listening on :${port}`))
