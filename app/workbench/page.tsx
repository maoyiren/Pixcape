import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

export const dynamic = 'force-dynamic'
export const metadata = { title: '创作工作台 | CDPC' }

const entries = [
  {
    href: '/AI',
    title: 'AI 生成',
    description: '从文字描述或参考图片开始构思皮肤。',
    action: '开始生成',
  },
  {
    href: '/bench',
    title: '编辑器',
    description: '导入皮肤，编辑像素贴图并检查角色预览。',
    action: '打开编辑器',
  },
  {
    href: '/wardrobe',
    title: '衣服选装',
    description: '进入服装搭配入口，预览角色外观。',
    action: '开始搭配',
  },
]

export default async function WorkbenchPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user

  return (
    <main className="inventory-shell cdpc-page">
      <header className="topbar cdpc-panel">
        <div>
          <p className="eyebrow">CDPC WORKSPACE</p>
          <h1>创作工作台</h1>
        </div>
        <div className="actions">
          <Link className="pixel-button cdpc-control" href="/">返回首页</Link>
          <Link className="pixel-button cdpc-control" href="/creator">创作者中心</Link>
        </div>
      </header>
      <section className="hero inventory-panel cdpc-panel">
        <p className="eyebrow" style={{ color: '#315a24' }}>CREATE · EDIT · STYLE</p>
        <h2>{user ? `欢迎回来，${user.name || user.email || '创作者'}` : '从这里开始创作'}</h2>
        <p>创作工作台负责进入 AI 生成、像素编辑和衣服选装流程；创作者中心则用于管理公开展示资料。两者分开，避免入口混用。</p>
        {!user ? (
          <p><Link href="/login">登录</Link> 后可继续使用账户相关功能；也可以先浏览创作入口。</p>
        ) : null}
      </section>
      <section className="cdpc-tool-grid" aria-label="创作入口">
        {entries.map((entry) => (
          <article className="application-card cdpc-panel" key={entry.href}>
            <h2>{entry.title}</h2>
            <p>{entry.description}</p>
            <Link className="pixel-button primary cdpc-control cdpc-control-primary" href={entry.href}>{entry.action} ↗</Link>
          </article>
        ))}
      </section>
    </main>
  )
}
