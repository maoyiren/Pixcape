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
    <main className="inventory-shell">
      <header className="topbar">
        <div><p className="eyebrow">CDPC ACCOUNT</p><h1>登录 CDPC</h1></div>
        <Link className="pixel-button" href="/">返回首页</Link>
      </header>
      <section className="hero inventory-panel">
        <h2>回来继续你的创作</h2>
        {verificationMessage ? <p role="status">{verificationMessage}</p> : null}
        <p>选择当前可用的登录方式。首次使用第三方账号登录时，系统可能会为你创建普通账户。</p>
        <LoginForm methods={enabledMethods.map(({id,label}) => ({id,label}))} adminEnabled={adminEnabled} />
        {enabledMethods.length === 0 && !adminEnabled ? <p>目前还没有启用登录方式。请管理员在部署设置中配置登录服务后重试。</p> : null}
        <p>第一次来？<Link href="/register">创建账户</Link>。注册不会自动获得创作者或管理员权限。</p>
      </section>
    </main>
  )
}
