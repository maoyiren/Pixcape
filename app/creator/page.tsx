import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { applyForCreator } from './actions'

export default async function CreatorPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true, status: true } })
  if (!user || user.status !== 'ACTIVE') redirect('/login?error=account_unavailable')
  const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } })

  return <main className="inventory-shell cdpc-page">
    <header className="topbar"><div><p className="eyebrow">CREATOR PROGRAM</p><h1>创作者中心</h1></div><Link className="pixel-button" href="/">返回首页</Link></header>
    {user.role === 'CREATOR' || user.role === 'ADMIN' ? <section className="hero inventory-panel cdpc-panel"><h2>创作者账户已启用</h2><p>当前账户：{user.name ?? user.email ?? user.id}</p><p>你的创作者身份已生效。当前页面支持账户资料与身份状态确认，作品发布功能仍在建设中。</p></section> : <section className="hero inventory-panel cdpc-panel">
      <h2>申请加入创作者计划</h2><p>填写展示名称和创作简介。提交后由管理员审核，审核通过前不会改变你的账户权限。</p>
      {profile?.reviewStatus === 'PENDING' ? <p role="status">申请已收到，正在等待审核。你可以修改资料后再次提交。</p> : null}
      {profile?.reviewStatus === 'REJECTED' ? <p role="status">上次申请未通过。请完善资料后重新提交。</p> : null}
      <form action={applyForCreator} className="application-form">
        <label htmlFor="displayName">展示名称</label><input id="displayName" name="displayName" required minLength={2} maxLength={48} defaultValue={profile?.displayName ?? user.name ?? ''} />
        <label htmlFor="bio">创作简介 <span>（最多 500 字）</span></label><textarea id="bio" name="bio" rows={4} maxLength={500} defaultValue={profile?.bio ?? ''} placeholder="介绍你擅长的像素创作类型或作品方向" />
        <button className="pixel-button primary" type="submit">提交申请 / 更新资料</button>
      </form>
    </section>}
  </main>
}
