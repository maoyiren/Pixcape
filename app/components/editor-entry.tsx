'use client'

import Link from 'next/link'
import { Alert, Badge, Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core'

export type EditorMode = 'editor' | 'ai' | 'wardrobe'

const copy = {
  editor: {
    title: '单品编辑器',
    eyebrow: '皮肤 · 披肩 · 外套 · 披风',
    heading: '继续编辑你的角色',
    description: '进入皮肤与配件工作台，导入贴图、选择素材，再打开 Blockbench 继续编辑并检查导出。',
    action: '打开编辑器 ↗',
  },
  ai: {
    title: 'AI 生成',
    eyebrow: 'AI 创作入口',
    heading: '从描述开始构思角色',
    description: '通过文字描述或参考图片构思皮肤。生成能力取决于已部署的 AI 服务与可用模型。',
    action: '打开 AI 创作入口 ↗',
  },
  wardrobe: {
    title: '衣橱选装',
    eyebrow: '皮肤 · 披肩 · 外套 · 披风',
    heading: '搭配你的角色外观',
    description: '在工作台选择皮肤、披肩、外套或披风素材，预览角色搭配；当前可用素材以实际接入为准。',
    action: '打开衣橱选装 ↗',
  },
} satisfies Record<EditorMode, { title: string; eyebrow: string; heading: string; description: string; action: string }>

function resolveEditorUrl(configuredUrl: string | undefined, mode: EditorMode): string | null {
  // The production image bundles the Vite studio under /studio/.
  if (!configuredUrl?.trim()) return `/studio/?mode=${mode}`

  try {
    const url = new URL(configuredUrl)
    const isLocalDevelopment = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (url.protocol !== 'https:' && !isLocalDevelopment) return null
    url.searchParams.set('mode', mode)
    return url.toString()
  } catch {
    return null
  }
}

export default function EditorEntry({ mode }: { mode: EditorMode }) {
  const validEditorUrl = resolveEditorUrl(process.env.NEXT_PUBLIC_EDITOR_URL, mode)
  const content = copy[mode]

  return (
    <Container size="xl" py={{ base: 'md', sm: 'xl' }} className="cdpc-editor-entry">
      <Stack gap="xl">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1.5}>CDPC WORKSPACE</Text>
            <Title order={1} size="h2">{content.title}</Title>
          </Stack>
          <Group gap="sm" wrap="wrap">
            <Button component={Link} className="cdpc-control" variant="default" href="/workbench">创作工作台</Button>
            <Button component={Link} className="cdpc-control" variant="default" href="/">返回首页</Button>
          </Group>
        </Group>

        <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }} className="cdpc-editor-entry-panel">
          <Stack gap="md" align="flex-start" maw={780}>
            <Badge variant="light" color="blue">{content.eyebrow}</Badge>
            <Title order={2} size="h3">{content.heading}</Title>
            <Text c="dimmed" lh={1.8}>{content.description}</Text>
            {validEditorUrl ? (
              <Button
                component="a"
                className="cdpc-control cdpc-control-primary"
                href={validEditorUrl}
                target={validEditorUrl.startsWith('/studio/') ? undefined : '_blank'}
                rel="noreferrer"
                variant="filled"
              >
                {content.action}
              </Button>
            ) : (
              <Stack gap="sm" w="100%">
                <Text>配置的编辑器地址无效，已阻止跳转以避免不安全的连接。</Text>
                <Alert color="red" variant="light" title="编辑器地址配置有误">
                  请管理员将 NEXT_PUBLIC_EDITOR_URL 设置为 HTTPS 地址，或留空使用同一部署内置的工作台。
                </Alert>
                <Button component={Link} href="/workbench" variant="default">返回创作工作台</Button>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  )
}
