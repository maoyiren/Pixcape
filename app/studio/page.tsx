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
    <header className="topbar"><div><p className="eyebrow">CDPC WORKSHOP</p><h1>皮肤与配件编辑</h1></div><Link className="pixel-button" href="/">返回首页</Link></header>
    <section className="hero inventory-panel">
      <p className="eyebrow" style={{ color: '#315a24' }}>皮肤 · 披肩 · 外套 · 披风</p>
      <h2>{validEditorUrl ? '继续编辑你的角色' : '编辑器尚未连接'}</h2>
      {validEditorUrl
        ? <><p>打开编辑器后，导入皮肤并选择配件分类。完成搭配后，可在角色预览中检查效果并导出 PNG。</p><a className="pixel-button primary" href={validEditorUrl} rel="noreferrer">打开编辑器 ↗</a></>
        : <><p>此入口负责连接独立的像素编辑工作台，目前没有检测到可用的编辑器地址。</p><div className="application-card"><h3>需要完成部署配置</h3><p>请在 Zeabur 的应用环境变量中设置 NEXT_PUBLIC_EDITOR_URL，填写已部署编辑器的 HTTPS 地址，然后重新部署。配置完成后，这里会显示进入编辑器的链接。</p></div><Link className="pixel-button primary" href="/">返回首页</Link></>}
    </section>
  </main>
}
