import Link from 'next/link'
import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

const methods = [
  { id: 'github', label: 'GitHub', enabled: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) },
  { id: 'google', label: 'Google', enabled: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) },
  { id: 'azure-ad', label: 'Microsoft', enabled: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) },
  { id: 'apple', label: 'Apple', enabled: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) },
  { id: 'email', label: '邮箱', enabled: Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM) },
]

export default function LoginPage() {
  const enabledMethods = methods.filter((method) => method.enabled).map(({ id, label }) => ({ id, label }))
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-intro" aria-labelledby="auth-title">
          <Link className="auth-brand" href="/" aria-label="Pixcape 首页">
            <span className="auth-brand-mark" aria-hidden="true"><span /></span>
            <span>Pixcape</span>
          </Link>
          <div className="auth-intro-copy">
            <p className="auth-kicker">YOUR SKIN · YOUR STYLE</p>
            <h1 id="auth-title">让每一次创作，<br /><span>都有自己的样子。</span></h1>
            <p className="auth-description">登录后继续编辑皮肤、管理收藏的素材，并保存你的创作进度。</p>
          </div>
          <div className="auth-feature-list">
            <div><span className="auth-feature-icon" aria-hidden="true">▦</span><span><strong>素材与作品</strong><small>把喜欢的设计收进自己的工作台</small></span></div>
            <div><span className="auth-feature-icon" aria-hidden="true">✳</span><span><strong>随时继续创作</strong><small>登录后管理你的个人创作内容</small></span></div>
          </div>
          <p className="auth-footnote">独立创作工具 · 与 Minecraft / Mojang 无隶属关系</p>
        </section>

        <section className="auth-card" aria-labelledby="auth-card-title">
          <div className="auth-card-heading">
            <p className="auth-card-eyebrow">PIX CAPE ACCOUNT</p>
            <h2 id="auth-card-title">欢迎回来</h2>
            <p>选择登录方式，开始或继续你的创作。</p>
          </div>
          {enabledMethods.length ? (
            <LoginForm methods={enabledMethods} />
          ) : (
            <div className="auth-unavailable" role="status">
              <span className="auth-unavailable-icon" aria-hidden="true">!</span>
              <div><strong>登录方式暂未启用</strong><p>请管理员配置 GitHub OAuth 或邮箱服务后再试。当前没有可用的登录凭据。</p></div>
            </div>
          )}
          <div className="auth-privacy-note">
            <span aria-hidden="true">⌑</span>
            <p>新账户默认拥有普通用户权限。管理员权限由运维人员单独授予，不会因注册自动获得。</p>
          </div>
          <div className="auth-card-footer">
            <Link href="/">← 返回工作台</Link>
            <span>安全登录 · 不会公开你的邮箱</span>
          </div>
        </section>
      </div>
    </main>
  )
}
