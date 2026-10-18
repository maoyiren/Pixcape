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
    <header className="topbar"><div><p className="eyebrow">PIX CAPE STUDIO</p><h1>像素编辑工作台</h1></div><Link className="pixel-button" href="/">返回首页</Link></header>
    <section className="hero inventory-panel">
      <h2>{validEditorUrl ? '打开 Pixcape 编辑器' : '编辑器地址尚未配置'}</h2>
      {validEditorUrl
        ? <><p>编辑器由独立的 Vite 工作台提供。点击下方按钮打开工作台，Next.js 负责账户与管理功能。</p><a className="pixel-button primary" href={validEditorUrl} rel="noreferrer">打开像素编辑器 ↗</a></>
        : <><p>当前 Next.js 服务没有检测到有效的 Vite 编辑器地址，因此不会展示一个失效的编辑器入口。</p><p>在部署配置中设置 NEXT_PUBLIC_EDITOR_URL 为实际编辑器地址后，此入口会自动启用。</p><Link className="pixel-button primary" href="/">返回创作中心</Link></>}
    </section>
  </main>
}
