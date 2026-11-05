import { prisma } from '@/lib/prisma'
import { adminUrl } from '@/lib/admin-path'
import { saveOAuthConfiguration, saveSystemConfiguration, setEmailVerificationRequired } from '../actions'

export const metadata = { title: '登录与身份配置' }

const providers = [
  { id: 'GITHUB', name: 'GitHub', envId: 'AUTH_GITHUB_ID', envSecret: 'AUTH_GITHUB_SECRET' },
  { id: 'GOOGLE', name: 'Google', envId: 'AUTH_GOOGLE_ID', envSecret: 'AUTH_GOOGLE_SECRET' },
  { id: 'MICROSOFT', name: 'Microsoft Entra ID', envId: 'AUTH_MICROSOFT_ENTRA_ID_ID', envSecret: 'AUTH_MICROSOFT_ENTRA_ID_SECRET' },
  { id: 'APPLE', name: 'Apple', envId: 'AUTH_APPLE_ID', envSecret: 'AUTH_APPLE_SECRET' },
] as const

export default async function AdminAuthPage({
  searchParams,
}: {
  searchParams?: Promise<{ systemConfigurationSaved?: string; emailVerificationUpdated?: string; oauthSaved?: string; error?: string }>
}) {
  const params = await searchParams
  const keys = [
    'AUTH_DEFAULT_CALLBACK_URL','AUTH_RETURN_TO_ORIGINAL_PAGE','EMAIL_VERIFICATION_REQUIRED',
    ...providers.flatMap((provider) => [
      'AUTH_OAUTH_' + provider.id + '_CLIENT_ID',
      'AUTH_SECRET_OAUTH_' + provider.id + '_CLIENT_SECRET',
      'AUTH_OAUTH_' + provider.id + '_DISABLED',
    ]),
    'AUTH_OAUTH_MICROSOFT_TENANT_ID',
  ]
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } })
  const config = Object.fromEntries(rows.map((item) => [item.key,item.value]))
  const returnToOriginal = config.AUTH_RETURN_TO_ORIGINAL_PAGE !== 'false'
  const emailVerification = config.EMAIL_VERIFICATION_REQUIRED === 'true'
  const configured = providers.map((provider) => {
    const prefix = 'AUTH_OAUTH_' + provider.id
    const id = config[prefix + '_CLIENT_ID'] || process.env[provider.envId]
    const secret = config['AUTH_SECRET_OAUTH_' + provider.id + '_CLIENT_SECRET'] || process.env[provider.envSecret]
    const disabled = config[prefix + '_DISABLED'] === 'true'
    return { ...provider, enabled: !disabled && Boolean(id && secret), hasId: Boolean(id), hasSecret: Boolean(secret), disabled }
  })

  return <main className="inventory-shell">
    <section className="inventory-panel hero">
      <p className="eyebrow">IDENTITY & ACCESS</p><h1>登录与身份配置</h1>
      <p>OAuth Client ID 可读，Client Secret 采用 AES-256-GCM 加密保存在数据库。每次 NextAuth 请求都会从数据库读取当前配置并重新构建 Provider，无需重启应用；环境变量仍作为未设置数据库值时的回退。</p>
      {params?.systemConfigurationSaved === '1' ? <p role="status" className="config-status">登录跳转设置已保存。</p> : null}
      {params?.emailVerificationUpdated === '1' ? <p role="status" className="config-status">邮箱验证设置已更新。</p> : null}
      {params?.oauthSaved ? <p role="status" className="config-status">{params.oauthSaved.toUpperCase()} Provider 配置已保存。</p> : null}
      {params?.error ? <p role="alert">配置未保存：{params.error}</p> : null}
    </section>
    <section className="inventory-panel hero">
      <h2>第三方 OAuth Provider</h2>
      <div className="application-list">
        {configured.map((provider) => <article className="application-card" key={provider.id}>
          <h3>{provider.name} · {provider.enabled ? '已启用' : provider.disabled ? '已禁用' : '未完整配置'}</h3>
          <p>Client ID：{provider.hasId ? '已配置' : '未配置'} · Client Secret：{provider.hasSecret ? '已配置' : '未配置'}</p>
          <form action={saveOAuthConfiguration} className="application-form cdpc-stack">
            <input type="hidden" name="provider" value={provider.id}/>
            <label><input type="checkbox" name="enabled" defaultChecked={provider.enabled}/> 启用此登录方式</label>
            <label htmlFor={provider.id + '-client-id'}>Client ID</label>
            <input id={provider.id + '-client-id'} name="clientId" maxLength={512} defaultValue={config['AUTH_OAUTH_' + provider.id + '_CLIENT_ID'] ?? ''} placeholder={provider.hasId ? '留空保留现有配置' : '填写 OAuth Client ID'}/>
            <label htmlFor={provider.id + '-client-secret'}>Client Secret（留空保留已保存密钥）</label>
            <input id={provider.id + '-client-secret'} name="clientSecret" type="password" autoComplete="new-password" maxLength={2048} placeholder="仅在新增或更换时填写"/>
            {provider.id === 'MICROSOFT' ? <><label htmlFor="microsoft-tenant">Microsoft Tenant ID</label><input id="microsoft-tenant" name="tenantId" defaultValue={config.AUTH_OAUTH_MICROSOFT_TENANT_ID ?? 'common'} maxLength={128}/></> : null}
            <button className="pixel-button primary" type="submit">保存 {provider.name} 配置</button>
          </form>
        </article>)}
      </div>
    </section>
    <section className="inventory-panel hero">
      <h2>登录成功后的跳转</h2>
      <form action={saveSystemConfiguration} className="application-form cdpc-stack">
        <label htmlFor="auth-return-original">登录后返回原页面</label>
        <select id="auth-return-original" name="returnToOriginalPage" defaultValue={returnToOriginal ? 'true' : 'false'}>
          <option value="true">优先返回登录前的站内页面</option><option value="false">始终使用指定默认页面</option>
        </select>
        <label htmlFor="auth-default-callback">默认登录目标</label>
        <select id="auth-default-callback" name="defaultCallbackUrl" defaultValue={config.AUTH_DEFAULT_CALLBACK_URL || '/workbench'}>
          <option value="/account">账号页面</option><option value="/workbench">创作工作台</option><option value="/studio">编辑入口</option><option value="/">首页</option>
        </select>
        <button className="pixel-button primary" type="submit">保存登录跳转设置</button>
      </form>
    </section>
    <section className="inventory-panel hero">
      <h2>邮箱验证</h2><p>当前状态：<strong>{emailVerification ? '已开启' : '关闭'}</strong></p>
      <p>需先在邮件服务模块配置 SMTP 主机、发件人和密码，或在部署环境设置 EMAIL_SERVER、EMAIL_FROM。</p>
      <form action={setEmailVerificationRequired} className="actions">
        <button className="pixel-button primary" type="submit" name="required" value={emailVerification ? 'false' : 'true'}>{emailVerification ? '关闭邮箱验证' : '开启邮箱验证'}</button>
      </form>
    </section>
  </main>
}
