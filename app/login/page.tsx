import Link from 'next/link'
import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

const methods = [
  { id: 'google', label: '使用 Google 继续', enabled: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) },
  { id: 'azure-ad', label: '使用 Microsoft 继续', enabled: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) },
  { id: 'github', label: '使用 GitHub 继续', enabled: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) },
  { id: 'apple', label: '使用 Apple 继续', enabled: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) },
  { id: 'email', label: '使用邮箱登录', enabled: Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM) },
]

export default function LoginPage() {
  const enabledMethods = methods.filter((method) => method.enabled).map(({ id, label }) => ({ id, label }))
  return (
    <main className="inventory-shell">
      <header className="topbar">
        <div><p className="eyebrow">PIX CAPE ACCOUNT</p><h1>登录 / 注册</h1></div>
        <Link className="pixel-button" href="/">返回工作台</Link>
      </header>
      <section className="hero inventory-panel">
        <h2>进入你的创作空间</h2>
        {enabledMethods.length ? (
          <>
            <p>选择一种已配置的登录方式。首次使用邮箱魔法链接登录时，会自动创建普通用户账户。</p>
            <LoginForm methods={enabledMethods} />
          </>
        ) : (
          <>
            <p>目前还没有启用登录方式。请配置 GitHub OAuth 的 AUTH_GITHUB_ID / AUTH_GITHUB_SECRET，或配置 EMAIL_SERVER / EMAIL_FROM 启用邮箱魔法链接。</p>
            <p>未配置认证凭据时不会创建假会话，也不会显示登录成功。</p>
          </>
        )}
        <p>新账户默认是普通用户。管理员使用同样的登录方式进入账户；首次管理员需要通过受控的一次性初始化流程授予 ADMIN 角色。</p>
      </section>
    </main>
  )
}
