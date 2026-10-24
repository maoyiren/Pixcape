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

  return <main className="inventory-shell cdpc-page">
    <header className="topbar cdpc-panel"><div><p className="eyebrow">CDPC WORKSHOP</p><h1>皮肤与配件编辑</h1></div><Link className="pixel-button cdpc-control" href="/">返回首页</Link></header>
    <section className="hero inventory-panel cdpc-panel">
      <p className="eyebrow" style={{ color: '#315a24' }}>皮肤 · 披肩 · 外套 · 披风</p>
      <h2>{validEditorUrl ? '继续编辑你的角色' : '编辑器尚未连接'}</h2>
      {validEditorUrl
        ? <><p>从衣服选装进入时，请先下载穿搭 JSON 备份，再打开编辑器并点击“导入穿搭备份 JSON”；系统会尝试恢复已支持的披肩、外套、披风、角色模型、背景和内嵌皮肤 PNG。若备份未包含自定义皮肤图片，将使用默认皮肤。导入后可继续编辑并导出 PNG。</p><a className="pixel-button primary cdpc-control cdpc-control-primary" href={validEditorUrl} rel="noreferrer">打开编辑器 ↗</a><p className="dressup-preview-note">穿搭交接采用本地 JSON 文件，不会自动上传到账号或服务器。请勿将含私人内容的备份分享给他人。</p></>
        : <><p>此入口负责连接独立的像素编辑工作台，目前没有检测到可用的编辑器地址。</p><div className="application-card cdpc-panel cdpc-panel-raised"><h3>需要完成部署配置</h3><p>请在 Zeabur 的应用环境变量中设置 NEXT_PUBLIC_EDITOR_URL，填写已部署编辑器的 HTTPS 地址，然后重新部署。配置完成后，这里会显示进入编辑器的链接。</p></div><Link className="pixel-button primary" href="/">返回首页</Link></>}
    </section>
  </main>
}
