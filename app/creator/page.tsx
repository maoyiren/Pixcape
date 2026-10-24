import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { updateCreatorProfile } from './actions'

export default async function CreatorPage({ searchParams }: { searchParams?: Promise<{ saved?: string; error?: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, status: true },
  })
  if (!user || user.status !== 'ACTIVE') redirect('/login?error=account_unavailable')
  const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } })
  const params = await searchParams

  return <main className="inventory-shell cdpc-page">
    <header className="topbar cdpc-panel">
      <div><p className="eyebrow">CREATOR STUDIO</p><h1>创作者中心</h1></div>
      <Link className="pixel-button cdpc-control" href="/">返回首页</Link>
    </header>
    <section className="hero inventory-panel cdpc-panel">
      <h2>你的创作空间</h2>
      <p>注册即拥有创作者身份。你可以完善公开资料并开始创作，无需申请或切换身份。</p>
      <p>账户：{user.name ?? user.email ?? 'CDPC 用户'} · {user.role === 'ADMIN' ? '管理员' : '创作者'}</p>
      {params?.saved === '1' ? <p role="status">资料已保存。</p> : null}
      {params?.error === 'display_name' ? <p role="alert">展示名称至少需要 2 个字符。</p> : null}
      <form action={updateCreatorProfile} className="application-form cdpc-stack">
        <label htmlFor="displayName">公开展示名称</label>
        <input id="displayName" className="cdpc-input" name="displayName" required minLength={2} maxLength={48} defaultValue={profile?.displayName ?? user.name ?? user.email?.split('@')[0] ?? ''} />
        <label htmlFor="bio">创作简介 <span>（最多 500 字）</span></label>
        <textarea id="bio" className="cdpc-input" name="bio" rows={4} maxLength={500} defaultValue={profile?.bio ?? ''} placeholder="介绍你擅长的像素创作类型、作品风格或创作方向" />
        <button className="pixel-button primary cdpc-control cdpc-control-primary" type="submit">保存创作者资料</button>
      </form>
    </section>
    <section className="hero inventory-panel cdpc-panel">
      <h2>作品管理</h2>
      <p>草稿管理、公开发布、版本历史和作品数据正在按阶段接入。当前页面不会显示虚构的作品数量或互动统计。</p>
      <p><Link href="/workbench">前往创作工坊</Link></p>
    </section>
  </main>
}
