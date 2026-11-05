import { prisma } from '@/lib/prisma'
import { saveAIConfiguration } from '../actions'

export const metadata = { title: 'AI 服务与模型配置' }

const settingKeys = [
  'AI_DEFAULT_PROVIDER', 'AI_DEFAULT_MODEL', 'GEMINI_IMAGE_MODELS',
  'OPENAI_IMAGE_MODELS', 'OPENROUTER_IMAGE_MODELS', 'SEEDREAM_IMAGE_MODELS',
  'ARK_BASE_URL', 'DEEPSEEK_TEXT_MODEL',
  'AI_SECRET_GEMINI_API_KEY', 'AI_SECRET_OPENAI_API_KEY',
  'AI_SECRET_OPENROUTER_API_KEY', 'AI_SECRET_ARK_API_KEY',
  'AI_SECRET_DEEPSEEK_API_KEY',
]

export default async function AdminAIPage({
  searchParams,
}: {
  searchParams?: Promise<{ aiConfigurationSaved?: string; error?: string }>
}) {
  const params = await searchParams
  const settings = await prisma.appSetting.findMany({ where: { key: { in: settingKeys } } })
  const config = Object.fromEntries(settings.map((item) => [item.key, item.value]))
  const configured = {
    gemini: Boolean(config.AI_SECRET_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY),
    openai: Boolean(config.AI_SECRET_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
    openrouter: Boolean(config.AI_SECRET_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY),
    seedream: Boolean(config.AI_SECRET_ARK_API_KEY || process.env.ARK_API_KEY || process.env.VOLCENGINE_ARK_API_KEY),
    deepseek: Boolean(config.AI_SECRET_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY),
  }
  const configuredCount = Object.values(configured).filter(Boolean).length

  return <main className="inventory-shell">
    <header className="topbar">
      <div><p className="eyebrow">AI PLATFORM</p><h1>AI 服务与模型</h1></div>
      <a className="pixel-button" href="/admin">返回总览</a>
    </header>
    {params?.aiConfigurationSaved === '1' ? <p role="status" className="config-status">AI 配置已加密保存。是否已同步到 AI API 服务，取决于服务间同步令牌是否正确配置。</p> : null}
    {params?.error === 'invalid_ai_provider' ? <p role="alert">AI 供应商选项无效，请重新选择。</p> : null}
    {params?.error === 'invalid_ark_url' ? <p role="alert">Ark 地址必须使用火山引擎官方 HTTPS 域名。</p> : null}
    {params?.error === 'ai_key_too_long' ? <p role="alert">API Key 长度超出限制。</p> : null}

    <section className="hero inventory-panel">
      <h2>服务商连接状态</h2>
      <p>当前检测到 {configuredCount}/5 组服务商密钥配置。此处只检查是否存在配置，不会调用第三方接口验证密钥有效性。</p>
      <div className="admin-overview">
        {Object.entries(configured).map(([provider, isConfigured]) => <article key={provider}>
          <span>{({ gemini: 'Google Gemini', openai: 'OpenAI', openrouter: 'OpenRouter', seedream: '豆包 Seedream', deepseek: 'DeepSeek' } as Record<string, string>)[provider]}</span>
          <strong>{isConfigured ? '已配置' : '未配置'}</strong>
          <small>密钥仅在服务端加密保存</small>
        </article>)}
      </div>
    </section>

    <section className="hero inventory-panel">
      <h2>默认供应商与模型</h2>
      <p>更改默认供应商、模型清单及 API 凭据。留空表示保留原密钥；勾选清除才会删除数据库中保存的密钥。</p>
      <form action={saveAIConfiguration} className="application-form cdpc-stack">
        <label htmlFor="ai-provider">默认供应商</label>
        <select id="ai-provider" name="provider" defaultValue={config.AI_DEFAULT_PROVIDER ?? 'auto'}>
          <option value="auto">自动选择</option><option value="gemini">Google Gemini</option>
          <option value="openai">OpenAI Images</option><option value="openrouter">OpenRouter</option>
          <option value="seedream">豆包 Seedream</option>
        </select>
        <label htmlFor="ai-model">默认模型 ID（可留空自动选择）</label>
        <input id="ai-model" name="model" className="cdpc-input" maxLength={160} defaultValue={config.AI_DEFAULT_MODEL ?? ''} placeholder="例如 gemini-2.5-flash-image"/>
        <label htmlFor="gemini-models">Gemini 图像模型列表（逗号分隔）</label>
        <input id="gemini-models" name="geminiModels" className="cdpc-input" defaultValue={config.GEMINI_IMAGE_MODELS ?? 'gemini-2.5-flash-image'} maxLength={500}/>
        <label htmlFor="openai-models">OpenAI 图像模型列表（逗号分隔）</label>
        <input id="openai-models" name="openaiModels" className="cdpc-input" defaultValue={config.OPENAI_IMAGE_MODELS ?? 'gpt-image-1'} maxLength={500}/>
        <label htmlFor="openrouter-models">OpenRouter 模型列表（逗号分隔）</label>
        <input id="openrouter-models" name="openrouterModels" className="cdpc-input" defaultValue={config.OPENROUTER_IMAGE_MODELS ?? ''} maxLength={1000}/>
        <label htmlFor="deepseek-text-model">DeepSeek 文本模型</label>
        <input id="deepseek-text-model" name="deepseekTextModel" className="cdpc-input" defaultValue={config.DEEPSEEK_TEXT_MODEL ?? 'deepseek-chat'} maxLength={160}/>
        <label htmlFor="seedream-models">Seedream 模型列表（逗号分隔）</label>
        <input id="seedream-models" name="seedreamModels" className="cdpc-input" defaultValue={config.SEEDREAM_IMAGE_MODELS ?? 'doubao-seedream-5-0-lite-260128'} maxLength={500}/>
        <label htmlFor="ark-base-url">火山引擎 Ark API 地址（仅允许官方 HTTPS 域名）</label>
        <input id="ark-base-url" name="arkBaseUrl" className="cdpc-input" defaultValue={config.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3'} maxLength={300}/>

        <h3>API 凭据</h3>
        <p>密钥使用服务端认证密钥派生的 AES-256-GCM 加密保存，不会回显已保存内容。</p>
        <label htmlFor="gemini-key">Gemini API Key（留空保留现有值）</label>
        <input id="gemini-key" name="geminiApiKey" className="cdpc-input" type="password" autoComplete="new-password" maxLength={2048} placeholder="仅在新增或更换时填写"/>
        <label><input type="checkbox" name="clearGeminiApiKey"/> 清除 Gemini API Key</label>
        <label htmlFor="openai-key">OpenAI API Key（留空保留现有值）</label>
        <input id="openai-key" name="openaiApiKey" className="cdpc-input" type="password" autoComplete="new-password" maxLength={2048} placeholder="仅在新增或更换时填写"/>
        <label><input type="checkbox" name="clearOpenaiApiKey"/> 清除 OpenAI API Key</label>
        <label htmlFor="openrouter-key">OpenRouter API Key（留空保留现有值）</label>
        <input id="openrouter-key" name="openrouterApiKey" className="cdpc-input" type="password" autoComplete="new-password" maxLength={2048} placeholder="仅在新增或更换时填写"/>
        <label><input type="checkbox" name="clearOpenrouterApiKey"/> 清除 OpenRouter API Key</label>
        <label htmlFor="seedream-key">豆包 Ark API Key（留空保留现有值）</label>
        <input id="seedream-key" name="seedreamApiKey" className="cdpc-input" type="password" autoComplete="new-password" maxLength={2048} placeholder="仅在新增或更换时填写"/>
        <label><input type="checkbox" name="clearSeedreamApiKey"/> 清除 Seedream API Key</label>
        <label htmlFor="deepseek-key">DeepSeek API Key（留空保留现有值）</label>
        <input id="deepseek-key" name="deepseekApiKey" className="cdpc-input" type="password" autoComplete="new-password" maxLength={2048} placeholder="仅在新增或更换时填写"/>
        <label><input type="checkbox" name="clearDeepseekApiKey"/> 清除 DeepSeek API Key</label>
        <button className="pixel-button primary cdpc-control cdpc-control-primary" type="submit">保存 AI 配置</button>
      </form>
    </section>
    <section className="hero inventory-panel">
      <h2>配置生效说明</h2>
      <ul>
        <li>密钥保存在 CDPC 数据库的加密值中；读取页面不会显示明文。</li>
        <li>独立 AI API 服务需配置与 CDPC 一致的 AI_CONFIG_SYNC_TOKEN，才能同步读取数据库配置。</li>
        <li>若未配置服务间同步，AI API 仍可能使用自身环境变量；保存成功不等于第三方模型调用已验证。</li>
      </ul>
    </section>
  </main>
}
