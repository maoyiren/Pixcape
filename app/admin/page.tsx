import Link from 'next/link'
import { requireRole } from '@/lib/require-role'
import { prisma } from '@/lib/prisma'
import { reviewCreatorApplication, setAdminAccess, setUserRole, setUserStatus } from './actions'

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

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ q?: string; role?: string; status?: string }> }) {
  const admin = await requireRole('ADMIN')
  const params = await searchParams
  const q = (params?.q ?? '').trim().slice(0, 100)
  const role = ['USER', 'CREATOR', 'ADMIN'].includes(params?.role ?? '') ? params?.role : ''
  const status = ['ACTIVE', 'SUSPENDED', 'DELETED'].includes(params?.status ?? '') ? params?.status : ''
  const userWhere = {
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { id: { contains: q } }] } : {}),
    ...(role ? { role: role as 'USER' | 'CREATOR' | 'ADMIN' } : {}),
    ...(status ? { status: status as 'ACTIVE' | 'SUSPENDED' | 'DELETED' } : {}),
  }
  const [healthChecks, adminData, auditLogs, userTotal, creatorTotal, suspendedTotal] = await Promise.all([
    getHealthChecks(),
    Promise.all([
      prisma.creatorProfile.findMany({
        where: { reviewStatus: 'PENDING' },
        include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      prisma.user.findMany({
        where: userWhere,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      }),
    ]).catch(() => null),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { actor: { select: { name: true, email: true } } },
    }).catch(() => []),
    prisma.user.count().catch(() => 0),
    prisma.user.count({ where: { role: 'CREATOR' } }).catch(() => 0),
    prisma.user.count({ where: { status: 'SUSPENDED' } }).catch(() => 0),
  ])
  const pending = adminData?.[0] ?? []
  const users = adminData?.[1] ?? []
  const failed = healthChecks.filter((check) => check.status === 'error').length
  const warnings = healthChecks.filter((check) => check.status === 'warning').length
  const overall = failed ? '异常' : warnings ? '需关注' : '正常'

  return <main className="inventory-shell">
    <header className="topbar"><div><p className="eyebrow">SERVER OPERATIONS</p><h1>管理员后台</h1></div><Link className="pixel-button" href="/">返回</Link></header>
    <nav className="admin-subnav" aria-label="管理后台分区">
      <a href="#overview">总览</a><a href="#health">系统健康</a><a href="#creators">创作者审核</a><a href="#users">用户管理</a><a href="#audit">操作审计</a><a href="#configuration">配置中心</a>
    </nav>
    <section className="admin-overview" id="overview">
      <article><span>用户总数</span><strong>{userTotal}</strong><small>所有注册账户</small></article>
      <article><span>创作者</span><strong>{creatorTotal}</strong><small>已授予创作者角色</small></article>
      <article><span>封禁账户</span><strong>{suspendedTotal}</strong><small>当前不可登录</small></article>
      <article><span>健康检查</span><strong>{failed ? '异常' : warnings ? '关注' : '正常'}</strong><small>{failed + warnings} 项需处理</small></article>
    </section>
    <section className="hero inventory-panel health-panel" id="health">
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
    <section className="hero inventory-panel" id="creators"><h2>创作者申请审核</h2><p>待审核申请：{pending.length}（最多显示 100 条）。每次审核都会记录审计日志。</p>
      {!adminData ? <p role="alert">暂时无法读取审核和用户数据，请检查数据库状态后刷新。</p> : pending.length === 0 ? <p>目前没有待审核申请。</p> : <div className="application-list">{pending.map((profile) => <article className="application-card" key={profile.id}>
        <h3>{profile.displayName}</h3><p>{profile.bio || '未填写简介'}</p><p>申请账号：{profile.user.name ?? profile.user.email ?? profile.user.id}</p><p>提交时间：{profile.createdAt.toISOString().slice(0, 10)}</p>
        <form action={reviewCreatorApplication} className="actions"><input type="hidden" name="profileId" value={profile.id} /><button className="pixel-button primary" type="submit" name="decision" value="approve">通过申请</button><button className="pixel-button" type="submit" name="decision" value="reject">拒绝申请</button></form>
      </article>)}</div>}
    </section>
    <section className="hero inventory-panel" id="users"><h2>用户管理</h2><p>按姓名、邮箱或用户 ID 搜索，并按角色和状态筛选。每次最多显示 50 条结果。</p>
      <form action="/admin" method="get" className="admin-filters">
        <label>搜索用户<input type="search" name="q" defaultValue={q} placeholder="姓名、邮箱或用户 ID" maxLength={100}/></label>
        <label>角色<select name="role" defaultValue={role}><option value="">全部角色</option><option value="USER">普通用户</option><option value="CREATOR">创作者</option><option value="ADMIN">管理员</option></select></label>
        <label>状态<select name="status" defaultValue={status}><option value="">全部状态</option><option value="ACTIVE">正常</option><option value="SUSPENDED">已封禁</option><option value="DELETED">已删除</option></select></label>
        <div className="admin-filter-actions"><button className="pixel-button primary" type="submit">筛选</button><Link className="pixel-button" href="/admin#users">重置</Link></div>
      </form>
      <p>当前结果：{users.length} 条{q || role || status ? '（已应用筛选）' : ''}。为避免误操作，管理员账户不能从此处封禁，也不能封禁当前登录账号。</p>
      {!adminData ? <p>用户列表暂不可用。</p> : <div className="application-list">{users.map((user) => <article className="application-card" key={user.id}>
        <h3>{user.name ?? '未设置名称'}</h3><p>{user.email ?? user.id}</p><p>角色：{user.role} · 状态：{user.status} · 注册：{user.createdAt.toISOString().slice(0, 10)}</p>
        {user.role !== 'ADMIN' && user.status === 'ACTIVE' ? <form action={setUserRole} className="actions"><input type="hidden" name="userId" value={user.id} /><label htmlFor={`role-${user.id}`}>调整角色</label><select id={`role-${user.id}`} name="role" defaultValue={user.role} aria-label={`为 ${user.name ?? user.email ?? user.id} 设置角色`}><option value="USER">普通用户</option><option value="CREATOR">创作者</option></select><button className="pixel-button primary" type="submit">保存角色</button></form> : null}
        {user.role !== 'ADMIN' && user.status !== 'DELETED' ? <form action={setUserStatus} className="actions"><input type="hidden" name="userId" value={user.id} />{user.status === 'SUSPENDED' ? <button className="pixel-button primary" type="submit" name="status" value="ACTIVE">恢复账户</button> : <button className="pixel-button" type="submit" name="status" value="SUSPENDED">封禁账户</button>}</form> : null}
        {user.status === 'ACTIVE' && user.id !== admin.id ? <form action={setAdminAccess} className="actions"><input type="hidden" name="userId" value={user.id} />{user.role === 'ADMIN' ? <button className="pixel-button" type="submit" name="operation" value="revoke">撤销管理员</button> : <button className="pixel-button" type="submit" name="operation" value="grant">授予管理员</button>}</form> : null}
      </article>)}</div>}
    </section>
    <section className="hero inventory-panel" id="audit"><h2>操作审计日志</h2><p>最近 30 条管理操作，用于追踪账号状态、角色调整和创作者审核。敏感凭据不会写入日志。</p>
      {auditLogs.length === 0 ? <p>暂无日志，或日志暂时无法读取。</p> : <div className="application-list">{auditLogs.map((entry) => <article className="application-card" key={entry.id}><h3>{entry.action}</h3><p>操作者：{entry.actor.name ?? entry.actor.email ?? '管理员账号'}</p><p>目标：{entry.targetType} · {entry.targetId}</p><p>时间：{entry.createdAt.toISOString().replace('T', ' ').slice(0, 19)} UTC</p><p>详情：{entry.details ? JSON.stringify(entry.details) : '无附加详情'}</p></article>)}</div>}
    </section>
    <section className="hero inventory-panel" id="configuration"><h2>系统配置中心</h2><p>集中管理登录提供商、邮件发送、AI 服务与安全策略。敏感凭据应加密保存、脱敏展示，并记录配置变更。</p><div className="admin-config-grid"><article><h3>登录与邮箱</h3><p>Google、Microsoft、GitHub、Apple、邮箱魔法链接。</p><span className="config-status">下一阶段：数据库配置存储</span></article><article><h3>AI 服务商</h3><p>模型服务地址、模型选择、API Key 连接测试。</p><span className="config-status">下一阶段：加密密钥管理</span></article><article><h3>安全策略</h3><p>登录限流、会话有效期、注册开关与审计策略。</p><span className="config-status">当前安全策略仍由部署配置控制</span></article></div></section>
  </main>
}
