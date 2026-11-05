import { prisma } from '@/lib/prisma'
import { saveSecurityConfiguration } from '../actions'
export const metadata = { title: '安全策略配置' }
export default async function AdminSecurityPage({ searchParams }: { searchParams?: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams
  const rows = await prisma.appSetting.findMany({ where: { key: { in: ['SECURITY_LOGIN_RATE_LIMIT_MAX','SECURITY_LOGIN_RATE_LIMIT_WINDOW_SECONDS'] } } })
  const config = Object.fromEntries(rows.map((row) => [row.key,row.value]))
  return <main className="inventory-shell">
    <section className="inventory-panel hero"><p className="eyebrow">SYSTEM / SECURITY</p><h1>安全策略</h1>
      {params?.saved === '1' ? <p role="status">安全策略已保存并由登录限流服务动态读取。</p> : null}
      {params?.error === 'invalid_limits' ? <p role="alert">请求频率范围无效：次数须为 5–100，窗口须为 60–86400 秒。</p> : null}
      <p>调整共享数据库限流阈值。所有登录入口使用持久化限流桶，适用于多实例部署。</p>
    </section>
    <section className="inventory-panel hero"><h2>登录频率限制</h2>
      <form action={saveSecurityConfiguration} className="application-form cdpc-stack">
        <label htmlFor="rate-limit-max">每个 IP 在窗口内允许的请求次数（5–100）</label><input id="rate-limit-max" name="loginRateLimitMax" type="number" min={5} max={100} required defaultValue={config.SECURITY_LOGIN_RATE_LIMIT_MAX ?? process.env.LOGIN_RATE_LIMIT_MAX ?? '10'}/>
        <label htmlFor="rate-limit-window">时间窗口（秒，60–86400）</label><input id="rate-limit-window" name="loginRateLimitWindowSeconds" type="number" min={60} max={86400} required defaultValue={config.SECURITY_LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? '900'}/>
        <button className="pixel-button primary" type="submit">保存安全策略</button>
      </form>
    </section>
    <section className="inventory-panel hero"><h2>基础防护</h2><ul><li>后台每次页面访问都验证当前用户角色与状态。</li><li>敏感 Server Actions 独立重新读取数据库角色，不信任前端隐藏按钮。</li><li>OAuth、SMTP、存储和 Webhook 密钥使用 AES-256-GCM 加密存储。</li><li>旧 /admin 路径由 Proxy 返回 404；自定义路径仅是额外防护，不替代身份认证。</li></ul></section>
  </main>
}