import Link from 'next/link'
import { Alert, Button } from '@mantine/core'

export type EditorMode = 'editor' | 'ai' | 'wardrobe'

const copy = {
  editor: { title: '单品编辑器', eyebrow: '皮肤 · 披肩 · 外套 · 披风', heading: '继续编辑你的角色', action: '打开编辑器 ↗' },
  ai: { title: 'AI 生成', eyebrow: 'AI 创作入口', heading: '从描述开始构思角色', action: '打开 AI 创作入口 ↗' },
  wardrobe: { title: '衣橱选装', eyebrow: '皮肤 · 披肩 · 外套 · 披风', heading: '搭配你的角色外观', action: '打开衣橱选装 ↗' },
} satisfies Record<EditorMode, { title: string; eyebrow: string; heading: string; action: string }>

export default function EditorEntry({ mode }: { mode: EditorMode }) {
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
  const content = copy[mode]

  return <main className="inventory-shell cdpc-page">
    <header className="topbar cdpc-panel"><div><p className="eyebrow">CDPC WORKSPACE</p><h1>{content.title}</h1></div><div className="actions"><Button component={Link} className="cdpc-control" variant="default" href="/workbench">创作工作台</Button><Button component={Link} className="cdpc-control" variant="default" href="/">返回首页</Button></div></header>
    <section className="hero inventory-panel cdpc-panel">
      <p className="eyebrow" style={{ color: '#315a24' }}>{content.eyebrow}</p>
      <h2>{validEditorUrl ? content.heading : '编辑器尚未连接'}</h2>
      {validEditorUrl
        ? <><p>{mode === 'ai'
          ? '通过文字描述或参考图片构思皮肤。生成能力是否可用取决于已部署的编辑器版本与 AI 服务配置。'
          : mode === 'wardrobe'
            ? '在统一工作区选择皮肤、披肩、外套或披风相关工具。实际可用分类以已接入的素材为准。'
            : '在统一工作区导入皮肤，编辑披肩、外套与披风，检查角色预览并导出 PNG。'}</p><Button component="a" className="cdpc-control cdpc-control-primary" href={validEditorUrl} target="_blank" rel="noreferrer" variant="filled">{content.action}</Button></>
        : <><p>当前尚未配置可访问的编辑器地址。完成部署配置后，这个入口将连接到对应的工作区模式。</p><Alert color="yellow" variant="light" title="需要完成部署配置">请管理员配置 NEXT_PUBLIC_EDITOR_URL，并确认编辑器支持 mode 参数。</Alert><Button component={Link} href="/" variant="default">返回首页</Button></>}
    </section>
  </main>
}
