import { prisma } from '@/lib/prisma'
import { adminUrl } from '@/lib/admin-path'
import { saveSystemConfiguration, setEmailVerificationRequired } from '../actions'

export const metadata = { title: '登录与身份配置' }

export default async function AdminAuthPage({
  searchParams,
}: {
  searchParams?: Promise<{ systemConfigurationSaved?: string; emailVerificationUpdated?: string; error?: string }>
}) {
  const params = await searchParams
  const [callback, returnSetting, verification] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: 'AUTH_DEFAULT_CALLBACK_URL' } }).catch(() => null),
    prisma.appSetting.findUnique({ where: { key: 'AUTH_RETURN_TO_ORIGINAL_PAGE' } }).catch(() => null),
    prisma.appSetting.findUnique({ where: { key: 'EMAIL_VERIFICATION_REQUIRED' } }).catch(() => null),
  ])
  const providers = [
    { name: 'GitHub', ready: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET), keys: 'AUTH_GITHUB_ID / AUTH_GITHUB_SECRET' },
    { name: 'Google', ready: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET), keys: 'AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET' },
    { name: 'Microsoft Entra ID', ready: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET), keys: 'AUTH_MICROSOFT_ENTRA_ID_ID / AUTH_MICROSOFT_ENTRA_ID_SECRET' },
    { name: 'Apple', ready: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET), keys: 'AUTH_APPLE_ID / AUTH_APPLE_SECRET' },
    { name: '邮箱魔法链接', ready: Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM), keys: 'EMAIL_SERVER / EMAIL_FROM' },
    { name: '管理员应急登录', ready: Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_EMAIL), keys: 'ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL' },
  ]
  const returnToOriginal = returnSetting?.value !== 'false'
  const emailVerification = verification?.value === 'true'
  return <main className="inventory-shell">
    <section className="inventory-panel hero">
      <p className="eyebrow">IDENTITY & ACCESS</p><h1>登录与身份配置</h1>
      <p>此页只展示环境变量是否齐全，不会读取或回显 OAuth 密钥。当前 OAuth Provider 在 NextAuth 启动时由环境变量注册；数据库配置暂不支持动态添加 Provider。</p>
      {params?.systemConfigurationSaved === '1' ? <p role="status" className="config-status">登录跳转设置已保存。</p> : null}
      {params?.emailVerificationUpdated === '1' ? <p role="status" className="config-status">邮箱验证设置已更新。</p> : null}
      {params?.error === 'invalid_return_behavior' ? <p role="alert">登录返回选项无效，请重新选择。</p> : null}
      {params?.error === 'invalid_default_callback' ? <p role="alert">默认登录目标无效，请选择站内页面。</p> : null}
      {params?.error === 'invalid_email_verification_setting' ? <p role="alert">邮箱验证开关参数无效，请重试。</p> : null}
      {params?.error === 'email_verification_smtp_missing' ? <p role="alert">请先配置 EMAIL_SERVER、EMAIL_FROM 和 NEXTAUTH_URL，再开启邮箱验证。</p> : null}
      <div className="application-list">{providers.map((provider) => <article className="application-card" key={provider.name}>
        <h3>{provider.name} · {provider.ready ? '已检测到配置' : '未配置完整'}</h3><p>{provider.keys}</p>
      </article>)}</div>
    </section>
    <section className="inventory-panel hero">
      <h2>登录成功后的跳转</h2>
      <form action={saveSystemConfiguration} className="application-form cdpc-stack">
        <label htmlFor="auth-return-original">登录后返回原页面</label>
        <select id="auth-return-original" name="returnToOriginalPage" defaultValue={returnToOriginal ? 'true' : 'false'}>
          <option value="true">优先返回登录前的站内页面</option><option value="false">始终使用指定默认页面</option>
        </select>
        <label htmlFor="auth-default-callback">默认登录目标</label>
        <select id="auth-default-callback" name="defaultCallbackUrl" defaultValue={callback?.value || '/workbench'}>
          <option value="/account">账号页面</option><option value="/workbench">创作工作台</option><option value="/studio">编辑入口</option><option value="/">首页</option>
        </select>
        <button className="pixel-button primary" type="submit">保存登录跳转设置</button>
      </form>
    </section>
    <section className="inventory-panel hero">
      <h2>邮箱验证</h2><p>当前状态：<strong>{emailVerification ? '已开启' : '关闭'}</strong></p>
      <p>开启前必须配置 EMAIL_SERVER、EMAIL_FROM 和 NEXTAUTH_URL。邮箱验证开关由服务端登录逻辑读取。</p>
      <form action={setEmailVerificationRequired} className="actions">
        <button className="pixel-button primary" type="submit" name="required" value={emailVerification ? 'false' : 'true'}>{emailVerification ? '关闭邮箱验证' : '开启邮箱验证'}</button>
      </form>
    </section>
    <section className="inventory-panel hero">
      <h2>OAuth 动态配置待办</h2>
      <p>不能在此直接保存 OAuth Client Secret：目前 NextAuth providers 在模块初始化时构建，贸然把凭据写入 AppSetting 不会使登录按钮或 callback 生效。后续需一并实现服务端加密、Provider 动态解析、登录页 provider 列表、回调校验和多实例缓存失效。</p>
    </section>
  </main>
}
