import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { redirect } from 'next/navigation'
import { Badge, Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core'
import { SignOutButton } from './sign-out-button'

const roleLabels: Record<string, string> = { USER: '普通账户', CREATOR: '创作者', ADMIN: '管理员' }
const statusLabels: Record<string, string> = { ACTIVE: '正常', SUSPENDED: '已暂停登录', DELETED: '已停用' }

export default async function AccountPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const role = roleLabels[session.user.role] ?? '普通账户'
  const status = statusLabels[session.user.status] ?? '待确认'
  const displayName = session.user.name ?? session.user.email ?? session.user.id

  return (
    <Container size="md" py={{ base: 'md', sm: 'xl' }} className="cdpc-account-page">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1.5}>YOUR CDPC ACCOUNT</Text>
            <Title order={1} size="h2">我的账户</Title>
            <Text c="dimmed">查看账户资料、账户类型与当前状态。</Text>
          </Stack>
          <Button component={Link} href="/" variant="default" className="cdpc-control">返回首页</Button>
        </Group>

        <Card withBorder radius="md" padding={{ base: "md", sm: "xl" }} className="cdpc-account-card">
          <Stack gap="lg">
            <Title order={2} size="h3">账户资料</Title>
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Text c="dimmed" size="sm">登录账户</Text>
                <Text fw={600} maw="100%" style={{ overflowWrap: 'anywhere' }}>{displayName}</Text>
              </Group>
              <Group justify="space-between" align="center" wrap="wrap">
                <Text c="dimmed" size="sm">账户类型</Text>
                <Badge variant="light" color={session.user.role === 'ADMIN' ? 'violet' : 'green'}>{role}</Badge>
              </Group>
              <Group justify="space-between" align="center" wrap="wrap">
                <Text c="dimmed" size="sm">账户状态</Text>
                <Badge variant="light" color={session.user.status === 'ACTIVE' ? 'green' : 'red'}>{status}</Badge>
              </Group>
            </Stack>
            <Group gap="sm" wrap="wrap">
              <Button component={Link} href="/creator" className="cdpc-control cdpc-control-primary">查看创作者中心</Button>
              <SignOutButton />
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
