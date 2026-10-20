import Link from 'next/link'
import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

const methods = [
  { id: 'google', label: '使用 Google 继续', enabled: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) },
  { id: 'azure-ad', label: '使用 Microsoft 继续', enabled: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) },
  { id: 'github', label: '使用 GitHub 继续', enabled: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) },
  { id: 'apple', label: '使用 Apple 继续', enabled: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) },
  { id: 'email', label: '邮箱魔法链接', enabled: Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM) },
]

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ verification?: string }> }) {
  const params = await searchParams
  const verificationMessage = params?.verification === 'success' ? '邮箱验证成功，现在可以登录。' : params?.verification === 'expired' ? '登录链接已过期，请重新获取。' : params?.verification === 'invalid' ? '这个登录链接无效，请重新获取。' : params?.verification === 'error' ? '验证没有完成，请稍后重试。' : ''
  const enabledMethods = methods.filter((method) => method.enabled)
  const adminEnabled = Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_EMAIL)
  return (
    <main className="inventory-shell">
      <header className="topbar">
        <div><p className="eyebrow">YOUR CDPC ACCOUNT</p><h1>登录你的账户</h1></div>
        <Link className="pixel-button" href="/">返回首页</Link>
      </header>
      <section className="hero inventory-panel">
        <h2>接着创作，不用从头开始</h2>
        {verificationMessage ? <p role="status">{verificationMessage}</p> : null}
        <p>选择下方已启用的登录方式。首次登录会创建普通账户；管理员权限需要单独配置，不会通过普通注册自动获得。</p>
        <LoginForm methods={enabledMethods.map(({id,label}) => ({id,label}))} adminEnabled={adminEnabled} />
        {enabledMethods.length === 0 && !adminEnabled ? <p>当前尚未启用第三方登录或邮箱登录。请管理员在部署环境完成对应配置后重新部署。</p> : null}
        <p>还没有账户？<Link href="/register">创建一个账户</Link>。</p>
      </section>
    </main>
  )
}
