import Link from 'next/link'
import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

const methods = [
  { id: 'google', label: '使用 Google 继续', enabled: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) },
  { id: 'azure-ad', label: '使用 Microsoft 继续', enabled: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) },
  { id: 'github', label: '使用 GitHub 继续', enabled: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) },
  { id: 'apple', label: '使用 Apple 继续', enabled: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) },
  { id: 'email', label: '邮箱', enabled: Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM) },
]

export default function LoginPage() {
  const enabledMethods = methods.filter((method) => method.enabled)
  const adminEnabled = Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_EMAIL)
  return (
    <main className="inventory-shell">
      <header className="topbar">
        <div><p className="eyebrow">CDPC ACCOUNT</p><h1>登录 / 注册</h1></div>
        <Link className="pixel-button" href="/">返回工作台</Link>
      </header>
      <section className="hero inventory-panel">
        <h2>进入你的创作空间</h2>
        <p>选择一种已配置的登录方式。OAuth 或邮箱首次登录会创建普通用户；管理员登录使用单独的环境变量凭据。</p>
        {(enabledMethods.length > 0 || adminEnabled) ? <LoginForm methods={enabledMethods.map(({id,label}) => ({id,label}))} adminEnabled={adminEnabled} /> : (
          <p role="status">目前尚未启用登录方式。请配置 OAuth、SMTP 或管理员环境变量。</p>
        )}
        <p>新账户默认是普通用户；管理员权限不能通过普通注册获得。</p>
      </section>
    </main>
  )
}
