import { requireUserSpaceOwner } from '@/lib/user-space'
import UsernameSettingsForm from './username-settings-form'

export default async function PersonalSettingsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const user = await requireUserSpaceOwner(username, '/settings')
  return <section><h1>个人空间设置</h1>
    <p>用户名会用于你的个人主页地址。修改后，旧地址会永久重定向到新地址，且旧用户名不会分配给其他账户。</p>
    <UsernameSettingsForm currentUsername={user.username || ''} />
  </section>
}
