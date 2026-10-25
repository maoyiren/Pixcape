import { getServerSession } from 'next-auth'
import { Badge, Button, Card, Container, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { authOptions } from '@/auth'

export const dynamic = 'force-dynamic'
export const metadata = { title: '创作工作台 | CDPC' }

const entries = [
  {
    href: '/workbench/ai',
    title: 'AI 生成',
    description: '从文字描述或参考图片开始构思皮肤。',
    action: '开始生成',
    category: '创作',
  },
  {
    href: '/workbench/edit',
    title: '单品编辑器',
    description: '导入皮肤，编辑像素贴图并检查角色预览。',
    action: '打开编辑器',
    category: '编辑',
  },
  {
    href: '/workbench/dress',
    title: '衣橱选装',
    description: '试穿披肩、外套、披风与其他服装，继续调整角色搭配。',
    action: '开始搭配',
    category: '搭配',
  },
]

export default async function WorkbenchPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user

  return (
    <Container size="xl" py={{ base: 'md', sm: 'xl' }} className="cdpc-workbench">
      <Stack gap="xl">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1.5}>CDPC WORKSPACE</Text>
            <Title order={1} size="h2">创作工作台</Title>
          </Stack>
          <Group gap="sm" wrap="wrap">
            <Button component="a" href="/" variant="default" className="cdpc-control">返回首页</Button>
            <Button component="a" href="/creator" variant="default" className="cdpc-control">创作者中心</Button>
          </Group>
        </Group>

        <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }} className="cdpc-workbench-welcome">
          <Stack gap="sm" maw={760}>
            <Badge variant="light" color="blue" w="fit-content">CREATE · EDIT · STYLE</Badge>
            <Title order={2} size="h3">
              {user ? `欢迎回来，${user.name || user.email || '创作者'}` : '从这里开始创作'}
            </Title>
            <Text c="dimmed" lh={1.7}>
              创作工作台负责进入 AI 生成、像素编辑和衣橱选装流程；创作者中心用于管理公开展示资料。两者分开，方便你直接开始创作。
            </Text>
            {!user ? (
              <Text size="sm">
                <Link href="/login">登录</Link> 后可继续使用账户相关功能，也可以先浏览创作入口。
              </Text>
            ) : null}
          </Stack>
        </Paper>

        <section aria-label="创作入口">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {entries.map((entry) => (
              <Card withBorder radius="md" padding="lg" key={entry.href} className="cdpc-workbench-card">
                <Stack gap="md" h="100%">
                  <Badge variant="light" color="gray" w="fit-content">{entry.category}</Badge>
                  <Stack gap={6} style={{ flex: 1 }}>
                    <Title order={2} size="h4">{entry.title}</Title>
                    <Text c="dimmed" size="sm" lh={1.7}>{entry.description}</Text>
                  </Stack>
                  <Button
                    component="a"
                    href={entry.href}
                    variant="filled"
                    fullWidth
                    className="cdpc-control cdpc-control-primary"
                  >
                    {entry.action} ↗
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </section>
      </Stack>
    </Container>
  )
}
