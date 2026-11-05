import { prisma } from '@/lib/prisma'

export const metadata = { title: '系统健康' }

type Check = { name: string; status: 'healthy' | 'warning' | 'error'; detail: string }

async function checks(): Promise<Check[]> {
  const result: Check[] = []
  try {
    await prisma.$queryRaw`SELECT 1`
    result.push({ name: '数据库', status: 'healthy', detail: '连接和简单查询正常' })
  } catch {
    result.push({ name: '数据库', status: 'error', detail: '数据库探测失败；未显示连接字符串' })
  }
  const secretReady = Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
  result.push({ name: '认证密钥', status: secretReady ? 'healthy' : 'error', detail: secretReady ? '已配置（不显示密钥）' : '缺少 AUTH_SECRET / NEXTAUTH_SECRET' })
  const urlReady = Boolean(process.env.NEXTAUTH_URL)
  result.push({ name: '认证站点地址', status: urlReady ? 'healthy' : 'warning', detail: urlReady ? 'NEXTAUTH_URL 已配置' : '未设置 NEXTAUTH_URL' })
  const aiUrl = process.env.AI_API_BASE_URL || 'http://127.0.0.1:8787'
  try {
    const response = await fetch(`${aiUrl.replace(/\/$/, '')}/health`, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
    result.push({ name: 'AI API', status: response.ok ? 'healthy' : 'error', detail: response.ok ? '健康端点响应正常' : `健康端点返回 HTTP ${response.status}` })
  } catch {
    result.push({ name: 'AI API', status: 'warning', detail: '无法连接健康端点；若未启用独立 AI API 服务，此项可能不适用' })
  }
  result.push({ name: '运行环境', status: 'healthy', detail: `Node.js ${process.version} · ${process.env.NODE_ENV || 'unknown'}` })
  return result
}

export default async function AdminHealthPage() {
  const items = await checks()
  const errors = items.filter((item) => item.status === 'error').length
  const warnings = items.filter((item) => item.status === 'warning').length
  return <main className="inventory-shell">
    <section className="inventory-panel hero"><p className="eyebrow">SYSTEM HEALTH</p><h1>系统健康检查</h1>
      <p>轻量应用层探测，不代表压力测试，也不代表第三方 API Key 已通过真实业务调用。</p>
      <div className="admin-overview">
        <article><span>检查项目</span><strong>{items.length}</strong></article>
        <article><span>正常</span><strong>{items.length - errors - warnings}</strong></article>
        <article><span>需关注</span><strong>{warnings}</strong></article>
        <article><span>异常</span><strong>{errors}</strong></article>
      </div>
      <div className="health-grid">{items.map((item) => <article className="health-card" key={item.name}>
        <div className="health-card-heading"><h2>{item.name}</h2><span className={`health-dot ${item.status}`}>{item.status === 'healthy' ? '正常' : item.status === 'warning' ? '关注' : '异常'}</span></div>
        <p>{item.detail}</p>
      </article>)}</div>
    </section>
  </main>
}
