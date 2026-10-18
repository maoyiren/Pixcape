import Link from 'next/link'

export const dynamic = 'force-dynamic'

const methods = [
  { id: 'google', label: '使用 Google 继续', enabled: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) },
  { id: 'azure-ad', label: '使用 Microsoft 继续', enabled: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) },
  { id: 'github', label: '使用 GitHub 继续', enabled: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) },
  { id: 'apple', label: '使用 Apple 继续', enabled: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) },
  { id: 'email', label: '使用邮箱发送登录链接', enabled: Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM) },
]

export default function LoginPage() {
  const enabledMethods = methods.filter((method) => method.enabled)
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
            <p>选择一种已配置的登录方式。首次登录将创建普通用户账户。</p>
            <div className="login-methods">
              {enabledMethods.map((method) => (
                <a className="pixel-button primary" key={method.id} href={method.id === 'email' ? '/api/auth/signin/email?callbackUrl=%2Faccount' : `/api/auth/signin/${method.id}?callbackUrl=%2Faccount`}>
                  {method.label}
                </a>
              ))}
            </div>
          </>
        ) : (
          <>
            <p>目前还没有启用登录方式。请在部署环境配置至少一种 OAuth 凭据，或配置 EMAIL_SERVER 与 EMAIL_FROM 启用邮箱魔法链接。</p>
            <p>未配置认证凭据时不会创建假会话，也不会显示登录成功。</p>
          </>
        )}
        <p>新账户默认是普通用户；创作者需审核，管理员权限只能由受保护的管理流程授予。</p>
      </section>
    </main>
  )
}
