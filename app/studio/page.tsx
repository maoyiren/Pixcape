import { Alert, Badge, Button, Card, Container, Group, Paper, Stack, Text, Title } from '@mantine/core'

export const dynamic = 'force-dynamic'
export const metadata = { title: '创作入口 | CDPC' }

type StudioMode = 'editor' | 'ai' | 'wardrobe'

export default async function StudioHandoffPage({ searchParams }: { searchParams?: Promise<{ mode?: string }> }) {
  const params = await searchParams
  const mode: StudioMode = params?.mode === 'ai' ? 'ai' : params?.mode === 'wardrobe' ? 'wardrobe' : 'editor'
  const copy = {
    editor: { title: '皮肤与配件编辑器', eyebrow: '皮肤 · 披肩 · 外套 · 披风', heading: '继续编辑你的角色', action: '打开编辑器', description: '导入皮肤，编辑披肩、外套与披风，检查角色预览并导出 PNG。' },
    ai: { title: 'AI 生成', eyebrow: 'AI 创作入口', heading: '从描述开始构思角色', action: '打开 AI 创作入口', description: '通过文字描述或参考图片构思皮肤。生成能力取决于已部署的编辑器版本与 AI 服务配置。' },
    wardrobe: { title: '衣橱选装', eyebrow: '皮肤 · 披肩 · 外套 · 披风', heading: '搭配你的角色外观', action: '打开衣橱选装', description: '在统一工作区选择皮肤、披肩、外套或披风相关工具；可用分类以已接入的素材为准。' },
  }[mode]
  const editorUrl = process.env.NEXT_PUBLIC_EDITOR_URL
  const validEditorUrl = (() => {
    if (!editorUrl) return null
    try {
      const url = new URL(editorUrl)
      if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return null
      url.searchParams.set('mode', mode)
      return url.toString()
    } catch {
      return null
    }
  })()

  return (
    <Container size="lg" py={{ base: 'md', sm: 'xl' }} className="cdpc-studio-handoff">
      <Stack gap="xl">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1.4}>CDPC WORKSPACE / HANDOFF</Text>
            <Title order={1} size="h2">{copy.title}</Title>
          </Stack>
          <Group gap="sm" wrap="wrap">
            <Button component="a" href="/workbench" variant="default">创作工作台</Button>
            <Button component="a" href="/" variant="subtle">返回首页</Button>
          </Group>
        </Group>

        <Paper withBorder radius="lg" p={{ base: 'lg', sm: 36 }} className="cdpc-studio-panel">
          <Stack gap="lg" maw={720}>
            <Badge variant="light" color="blue" w="fit-content">{copy.eyebrow}</Badge>
            <Title order={2} size="h1">{validEditorUrl ? copy.heading : '编辑器尚未连接'}</Title>
            <Text c="dimmed" size="md" lh={1.8}>
              {validEditorUrl ? copy.description : '当前尚未配置可访问的编辑器地址。完成部署配置后，这个入口将连接到对应的工作区模式。'}
            </Text>
            {validEditorUrl ? (
              <Group gap="sm" wrap="wrap">
                <Button component="a" href={validEditorUrl} target="_self" size="md">{copy.action} ↗</Button>
                <Button component="a" href="/workbench" variant="default" size="md">选择其他创作工具</Button>
              </Group>
            ) : (
              <Alert color="yellow" title="需要完成部署配置" variant="light">
                请管理员配置 NEXT_PUBLIC_EDITOR_URL，并确认编辑器支持 mode 参数。出于安全考虑，只接受 HTTPS 地址或本机开发地址。
              </Alert>
            )}
          </Stack>
        </Paper>

        <Card withBorder radius="md" padding="lg" className="cdpc-studio-note">
          <Stack gap={6}>
            <Title order={3} size="h4">创作流程</Title>
            <Text c="dimmed" size="sm" lh={1.7}>选择工具 → 导入或生成皮肤 → 预览角色与配件 → 导出作品。AI 生成和素材选装是否可用，以当前部署的服务与素材为准。</Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
