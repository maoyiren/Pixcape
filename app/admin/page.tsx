import Link from 'next/link'
import { requireRole } from '@/lib/require-role'
import { prisma } from '@/lib/prisma'
import { reviewCreatorApplication, setUserStatus } from './actions'

type HealthCheck = {
  name: string
  status: 'healthy' | 'warning' | 'error'
  detail: string
}

async function getHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []
  const provider = (process.env.DATABASE_PROVIDER || 'postgresql').toLowerCase()

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.push({ name: '数据库连接', status: 'healthy', detail: `${provider} 连接与简单查询正常` })
  } catch {
    checks.push({ name: '数据库连接', status: 'error', detail: '数据库探测失败。请检查数据库服务、连接配置和网络；为保护敏感信息，未显示连接字符串。' })
  }

  const aiUrl = process.env.AI_API_BASE_URL || 'http://127.0.0.1:8787'
  try {
    const response = await fetch(`${aiUrl.replace(/\/$/, '')}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    })
    if (!response.ok) {
      checks.push({ name: 'AI API 服务', status: 'error', detail: `健康端点返回 HTTP ${response.status}` })
    } else {
      let detail = '健康端点响应正常'
      try {
        const payload = await response.json() as { status?: string }
        if (payload.status) detail = `健康端点状态：${payload.status}`
      } catch {
        // A successful non-JSON health response is still considered reachable.
      }
      checks.push({ name: 'AI API 服务', status: 'healthy', detail })
    }
  } catch {
    checks.push({ name: 'AI API 服务', status: 'warning', detail: '无法连接配置的健康端点；若未启用独立 AI API 服务，此项可能不适用。' })
  }

  const authReady = Boolean(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET)
  checks.push({
    name: '认证密钥',
    status: authReady ? 'healthy' : 'error',
    detail: authReady ? '已配置（不会显示密钥内容）' : '缺少 NEXTAUTH_SECRET / AUTH_SECRET',
  })

  const urlReady = Boolean(process.env.NEXTAUTH_URL)
  checks.push({
    name: '认证站点地址',
    status: urlReady ? 'healthy' : 'warning',
    detail: urlReady ? 'NEXTAUTH_URL 已配置' : '未设置 NEXTAUTH_URL；请核对生产环境认证回调配置',
  })

  const configuredProviders = [
    ['Google', process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY],
    ['OpenAI', process.env.OPENAI_API_KEY],
    ['Anthropic', process.env.ANTHROPIC_API_KEY],
  ].filter(([, value]) => Boolean(value)).map(([name]) => name)
  checks.push({
    name: 'AI 模型密钥',
    status: configuredProviders.length ? 'healthy' : 'warning',
    detail: configuredProviders.length ? `检测到 ${configuredProviders.length} 组配置：${configuredProviders.join('、')}（不验证密钥有效性）` : '未检测到常见 AI 服务商密钥；如使用其他服务商，请以其配置为准。',
  })

  checks.push({
    name: '运行环境',
    status: 'healthy',
    detail: `Node.js ${process.version} · ${process.env.NODE_ENV || 'unknown'}`,
  })
  checks.push({
    name: '构建版本',
    status: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA ? 'healthy' : 'warning',
    detail: (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA)
      ? `提交 ${(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA)!.slice(0, 8)}`
      : '未注入 Git commit SHA 环境变量',
  })

  return checks
}

export default async function AdminPage() {
  const admin = await requireRole('ADMIN')
  const [healthChecks, adminData] = await Promise.all([
    getHealthChecks(),
    Promise.all([
      prisma.creatorProfile.findMany({
        where: { reviewStatus: 'PENDING' },
        include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      }),
    ]).catch(() => null),
  ])
  const pending = adminData?.[0] ?? []
  const users = adminData?.[1] ?? []
  const failed = healthChecks.filter((check) => check.status === 'error').length
  const warnings = healthChecks.filter((check) => check.status === 'warning').length
  const overall = failed ? '异常' : warnings ? '需关注' : '正常'

  return <main className="inventory-shell">
    <header className="topbar"><div><p className="eyebrow">SERVER OPERATIONS</p><h1>管理员后台</h1></div><Link className="pixel-button" href="/">返回</Link></header>
    <section className="hero inventory-panel health-panel">
      <div className="health-heading"><div><p className="eyebrow">SYSTEM HEALTH</p><h2>系统健康检查</h2></div><span className={`health-status ${failed ? 'is-error' : warnings ? 'is-warning' : 'is-healthy'}`}>{overall}</span></div>
      <p>检查服务可达性、数据库查询、认证配置与 AI 配置。此页面不显示密钥或数据库连接字符串。</p>
      <div className="health-summary">
        <div><strong>{healthChecks.length}</strong><span>检查项目</span></div>
        <div><strong>{healthChecks.length - failed - warnings}</strong><span>正常</span></div>
        <div><strong>{warnings}</strong><span>需关注</span></div>
        <div><strong>{failed}</strong><span>异常</span></div>
      </div>
      <div className="health-grid">{healthChecks.map((check) => <article className="health-card" key={check.name}>
        <div className="health-card-heading"><h3>{check.name}</h3><span className={`health-dot ${check.status}`}>{check.status === 'healthy' ? '正常' : check.status === 'warning' ? '关注' : '异常'}</span></div>
        <p>{check.detail}</p>
      </article>)}</div>
      <div className="health-footer"><span>管理员：{admin.name ?? admin.email ?? admin.id}</span><Link className="pixel-button primary" href="/admin">刷新检查</Link></div>
      <p className="health-disclaimer">提示：健康状态是应用层的轻量探测，不代表完整压力测试或第三方 API 密钥已通过实际调用验证。若数据库不可用，登录会话验证也可能阻止本页面加载；建议另配外部存活探针。</p>
    </section>
    <section className="hero inventory-panel"><h2>创作者申请审核</h2><p>待审核申请：{pending.length}（最多显示 100 条）。每次审核都会记录审计日志。</p>
      {!adminData ? <p role="alert">暂时无法读取审核和用户数据，请检查数据库状态后刷新。</p> : pending.length === 0 ? <p>目前没有待审核申请。</p> : <div className="application-list">{pending.map((profile) => <article className="application-card" key={profile.id}>
        <h3>{profile.displayName}</h3><p>{profile.bio || '未填写简介'}</p><p>申请账号：{profile.user.name ?? profile.user.email ?? profile.user.id}</p><p>提交时间：{profile.createdAt.toISOString().slice(0, 10)}</p>
        <form action={reviewCreatorApplication} className="actions"><input type="hidden" name="profileId" value={profile.id} /><button className="pixel-button primary" type="submit" name="decision" value="approve">通过申请</button><button className="pixel-button" type="submit" name="decision" value="reject">拒绝申请</button></form>
      </article>)}</div>}
    </section>
    <section className="hero inventory-panel"><h2>用户管理</h2><p>最近注册的 50 个账户。为防止误操作，管理员账户不能从此处封禁，也不能封禁当前登录账号。</p>
      {!adminData ? <p>用户列表暂不可用。</p> : <div className="application-list">{users.map((user) => <article className="application-card" key={user.id}>
        <h3>{user.name ?? '未设置名称'}</h3><p>{user.email ?? user.id}</p><p>角色：{user.role} · 状态：{user.status} · 注册：{user.createdAt.toISOString().slice(0, 10)}</p>
        {user.role !== 'ADMIN' && user.status !== 'DELETED' ? <form action={setUserStatus} className="actions"><input type="hidden" name="userId" value={user.id} />{user.status === 'SUSPENDED' ? <button className="pixel-button primary" type="submit" name="status" value="ACTIVE">恢复账户</button> : <button className="pixel-button" type="submit" name="status" value="SUSPENDED">封禁账户</button>}</form> : null}
      </article>)}</div>}
    </section>
  </main>
}
