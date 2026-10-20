import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function StudioHandoffPage() {
  const editorUrl = process.env.NEXT_PUBLIC_EDITOR_URL
  const validEditorUrl = (() => {
    if (!editorUrl) return null
    try {
      const url = new URL(editorUrl)
      return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1' ? url.toString() : null
    } catch {
      return null
    }
  })()

  return <main className="inventory-shell">
    <header className="topbar"><div><p className="eyebrow">CREATION TOOLS</p><h1>创作工具</h1></div><Link className="pixel-button" href="/">返回首页</Link></header>
    <section className="hero inventory-panel">
      <p className="eyebrow" style={{ color: '#315a24' }}>皮肤 · 披肩 · 外套 · 披风</p>
      <h2>{validEditorUrl ? '打开像素编辑器' : '连接你的像素编辑器'}</h2>
      {validEditorUrl
        ? <><p>导入 Minecraft 皮肤，搭配像素配件，并在角色预览中检查效果。准备好后，打开编辑器继续创作。</p><a className="pixel-button primary" href={validEditorUrl} rel="noreferrer">进入编辑器 ↗</a></>
        : <><p>编辑器目前由独立工作台提供。连接完成后，你可以从这里进入皮肤与配件编辑器；此处不会显示无效的跳转按钮。</p><div className="application-card"><h3>部署连接状态</h3><p>尚未检测到有效的编辑器地址。请在 Zeabur 服务环境变量中将 NEXT_PUBLIC_EDITOR_URL 设置为已部署的编辑器 HTTPS 地址，然后重新部署。</p></div><Link className="pixel-button primary" href="/">返回创作首页</Link></>}
    </section>
  </main>
}
