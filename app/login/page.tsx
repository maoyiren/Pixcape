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
      <header className="topbar cdpc-panel">
        <div><p className="eyebrow">CDPC ACCOUNT</p><h1>登录 / 创建账户</h1></div>
        <Link className="pixel-button cdpc-control" href="/">返回首页</Link>
      </header>
      <section className="hero inventory-panel auth-panel cdpc-panel cdpc-stack">
        <h2>一个入口，继续你的创作</h2>
        {verificationMessage ? <p role="status">{verificationMessage}</p> : null}
        <p>使用邮箱或用户名与密码登录，也可选择已启用的第三方登录方式。系统会根据账户权限开放相应功能。</p>
        <LoginForm methods={enabledMethods.map(({id,label}) => ({id,label}))} adminEnabled={adminEnabled} />
        {enabledMethods.length === 0 && !adminEnabled ? <p>暂未启用第三方登录方式。你仍可使用已开通的邮箱与密码登录。</p> : null}
        <p className="auth-switch-copy">还没有账户？<Link href="/register">创建账户</Link>。新注册账号默认不会获得管理员权限。</p>
      </section>
    </main>
  )
}
