import Link from 'next/link'
import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

const methods = [
  { id: 'google', label: '使用 Google 账号登录', enabled: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) },
  { id: 'azure-ad', label: '使用 Microsoft 账号登录', enabled: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) },
  { id: 'github', label: '使用 GitHub 账号登录', enabled: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) },
  { id: 'apple', label: '使用 Apple 账号登录', enabled: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) },
  { id: 'email', label: '通过邮箱链接登录', enabled: Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM) },
]

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ verification?: string }> }) {
  const params = await searchParams
  const verificationMessage = params?.verification === 'success' ? '邮箱验证成功，可以继续登录。' : params?.verification === 'expired' ? '这条登录链接已过期，请重新获取。' : params?.verification === 'invalid' ? '这条登录链接无效，请重新获取。' : params?.verification === 'error' ? '暂时无法完成验证，请稍后重试。' : ''
  const enabledMethods = methods.filter((method) => method.enabled)
  const adminEnabled = Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_EMAIL)
  return (
    <main className="inventory-shell auth-page-shell cdpc-page">
      <header className="topbar">
        <div><p className="eyebrow">CDPC ACCOUNT</p><h1>登录 / 创建账户</h1></div>
        <Link className="pixel-button" href="/">返回首页</Link>
      </header>
      <section className="hero inventory-panel auth-panel cdpc-panel">
        <h2>一个入口，继续你的创作</h2>
        {verificationMessage ? <p role="status">{verificationMessage}</p> : null}
        <p>使用邮箱和密码、管理员账号，或已启用的第三方平台登录。系统会根据账号权限决定可访问的区域。</p>
        <LoginForm methods={enabledMethods.map(({id,label}) => ({id,label}))} adminEnabled={adminEnabled} />
        {enabledMethods.length === 0 && !adminEnabled ? <p>目前还没有启用第三方或管理员登录方式；邮箱密码登录仍可用于已有账户。请检查部署配置。</p> : null}
        <p className="auth-switch-copy">还没有账户？<Link href="/register">创建账户</Link>。新注册账号默认不会获得管理员权限。</p>
      </section>
    </main>
  )
}
