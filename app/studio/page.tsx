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
        ? <><p>先在衣服选装中导出穿搭备份，再打开编辑器并选择“导入穿搭备份 JSON”。目前支持恢复披肩、外套、披风、角色模型、背景及备份内的皮肤 PNG；未包含皮肤图片时将使用默认皮肤。导入后即可继续编辑并导出 PNG。</p><a className="pixel-button primary cdpc-control cdpc-control-primary" href={validEditorUrl} rel="noreferrer">打开编辑器 ↗</a><p className="dressup-preview-note">穿搭交接采用本地 JSON 文件，不会自动上传到账号或服务器。请勿将含私人内容的备份分享给他人。</p></>
        : <><p>创作工坊暂不可用，编辑器地址尚未配置。</p><div className="application-card cdpc-panel cdpc-panel-raised"><h3>需要完成部署配置</h3><p>请联系平台管理员完成编辑器部署配置。配置完成后即可进入创作工坊。</p></div><Link className="pixel-button primary" href="/">返回首页</Link></>}
    </section>
  </main>
}
