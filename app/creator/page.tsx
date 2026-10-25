import Link from 'next/link'
import { Alert, Button, Card, Container, Group, Stack, Text, Textarea, TextInput, Title } from '@mantine/core'
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

  return (
    <Container size="md" py={{ base: 'md', sm: 'xl' }} className="cdpc-creator-page">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1.5}>CREATOR STUDIO</Text>
            <Title order={1} size="h2">创作者中心</Title>
          </Stack>
          <Button component={Link} href="/" variant="default" className="cdpc-control">返回首页</Button>
        </Group>

        <Card withBorder radius="md" padding={{ base: 'md', sm: 'xl' }} className="cdpc-creator-card">
          <Stack gap="md">
            <Title order={2} size="h3">你的创作空间</Title>
            <Text c="dimmed" lh={1.7}>注册即拥有创作者身份。你可以完善公开资料并开始创作，无需申请或切换身份。</Text>
            <Text size="sm">账户：{user.name ?? user.email ?? 'CDPC 用户'} · {user.role === 'ADMIN' ? '管理员' : '创作者'}</Text>
            {params?.saved === '1' ? <Alert color="green" variant="light" role="status" title="保存成功">创作者资料已保存。</Alert> : null}
            {params?.error === 'display_name' ? <Alert color="red" variant="light" role="alert" title="请检查资料">公开展示名称至少需要 2 个字符。</Alert> : null}
            <form action={updateCreatorProfile} className="application-form cdpc-stack">
              <Stack gap="md">
                <TextInput
                  id="displayName"
                  name="displayName"
                  label="公开展示名称"
                  className="cdpc-mantine-field"
                  classNames={{ input: 'cdpc-input' }}
                  required
                  minLength={2}
                  maxLength={48}
                  defaultValue={profile?.displayName ?? user.name ?? user.email?.split('@')[0] ?? ''}
                />
                <Textarea
                  id="bio"
                  name="bio"
                  label="创作简介（最多 500 字）"
                  className="cdpc-mantine-field"
                  classNames={{ input: 'cdpc-input' }}
                  rows={4}
                  maxLength={500}
                  defaultValue={profile?.bio ?? ''}
                  placeholder="介绍你擅长的像素创作类型、作品风格或创作方向"
                />
                <Button className="cdpc-control cdpc-control-primary" type="submit">保存创作者资料</Button>
              </Stack>
            </form>
          </Stack>
        </Card>

        <Card withBorder radius="md" padding={{ base: 'md', sm: 'xl' }} className="cdpc-creator-card">
          <Stack gap="sm">
            <Title order={2} size="h3">作品管理</Title>
            <Text c="dimmed" lh={1.7}>草稿管理、公开发布、版本历史和作品数据正在按阶段接入。当前页面不会显示虚构的作品数量或互动统计。</Text>
            <Button component={Link} href="/workbench" variant="light" className="cdpc-control cdpc-control-primary" w="fit-content">前往创作工作台</Button>
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
