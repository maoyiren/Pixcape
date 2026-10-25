import Link from 'next/link'

const tools = [
  { number: '00', title: '皮肤与配件编辑器', tag: '核心编辑器', description: '在同一工作区导入皮肤，编辑披肩、外套与披风，实时预览角色并导出 PNG。', href: '/bench', action: '打开编辑器', featured: true },
  { number: '01', title: 'AI 生成', tag: 'AI 创作', description: '通过文字描述或参考图片生成 Minecraft 皮肤，并在 3D 预览中检查结果。', href: '/AI', action: '开始 AI 创作', featured: true },
  { number: '02', title: '角色预览与导出', tag: '预览工作流', description: '检查皮肤与配件效果，确认后导出标准 PNG 文件，方便带回游戏使用。', href: '/bench', action: '预览与导出', featured: false },
  { number: '03', title: '创作者中心', tag: '创作者空间', description: '完善公开展示资料，逐步管理你的原创作品与创作内容。', href: '/creator', action: '进入创作者中心', featured: false },
]

const quickLinks = [
  { label: '我的账户', detail: '查看账户状态与个人资料', href: '/workbench', symbol: '◉' },
  { label: '登录 / 注册', detail: '保存账户，管理自己的创作', href: '/login', symbol: '↗' },
]

export default function MigrationHome() {
  return (
    <main className="cdpc-home cdpc-page">
      <section className="cdpc-hero">
        <div className="cdpc-hero-copy">
          <p className="cdpc-kicker"><span className="pixel-live-dot" /> CDPC · 像素角色工具</p>
          <h1>让角色更像<br /><span>你想要的样子。</span></h1>
          <p className="cdpc-hero-description">从 Minecraft 皮肤开始，搭配披肩、外套和披风。导入、预览、调整，再把满意的作品带进游戏。</p>
          <div className="cdpc-hero-actions">
            <Link className="cdpc-button cdpc-button-primary cdpc-control cdpc-control-primary" href="/bench">开始编辑皮肤与配件 <span aria-hidden="true">↗</span></Link>
            <Link className="cdpc-button cdpc-button-quiet cdpc-control" href="/AI">尝试 AI 生成</Link>
          </div>
          <div className="cdpc-hero-footnote"><span className="cdpc-mini-pixel" aria-hidden="true">▦</span> 为皮肤搭配与像素配件设计而做</div>
        </div>
        <div className="cdpc-pixel-scene" aria-label="像素角色与披风的示意图">
          <div className="scene-sun" />
          <div className="scene-grid" />
          <div className="scene-cube cube-back" />
          <div className="scene-cube cube-side" />
          <div className="scene-character">
            <div className="character-hair" />
            <div className="character-face"><i /><i /><b /></div>
            <div className="character-neck" />
            <div className="character-body"><span className="character-cape" /></div>
            <div className="character-arm arm-left" /><div className="character-arm arm-right" />
            <div className="character-leg leg-left" /><div className="character-leg leg-right" />
          </div>
          <div className="scene-label label-top"><span>CDPC WORKSHOP</span><b>角色搭配</b></div>
          <div className="scene-label label-bottom"><span className="scene-status-dot" /> 从一张皮肤开始</div>
        </div>
      </section>

      <section className="cdpc-section-heading">
        <div><p className="cdpc-section-kicker">TOOLS / 01</p><h2>编辑与生成，在同一入口开始</h2></div>
        <p>编辑皮肤与披肩、外套、披风，或使用 AI 辅助生成新设计。</p>
      </section>

      <section className="cdpc-tool-grid" aria-label="工具与功能">
        {tools.map((tool) => (
          <article className={`cdpc-tool-card ${tool.featured ? 'is-featured' : ''}`} key={tool.number}>
            <div className="cdpc-card-top"><span className="cdpc-card-number">{tool.number}</span><span className="cdpc-card-tag">{tool.tag}</span></div>
            <div className={`cdpc-tool-glyph glyph-${tool.number}`} aria-hidden="true"><span>{tool.number === '00' ? '♧' : tool.number === '01' ? '▦' : tool.number === '02' ? '◫' : '✎'}</span></div>
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            <Link href={tool.href} className="cdpc-card-link cdpc-control">{tool.action} <span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </section>

      <section className="cdpc-quick-row" aria-label="账户快捷入口">
        <div className="cdpc-quick-intro"><p className="cdpc-section-kicker">YOUR SPACE / 02</p><h2>你的账户空间</h2><p>登录后进入创作工作台，管理资料并继续创作。</p></div>
        {quickLinks.map((item) => <Link className="cdpc-quick-link cdpc-control" href={item.href} key={item.href}><span className="quick-symbol">{item.symbol}</span><span><b>{item.label}</b><small>{item.detail}</small></span><span className="quick-arrow" aria-hidden="true">↗</span></Link>)}
      </section>

      <p className="cdpc-legal-note">CDPC 为独立社区工具项目，与 Mojang Studios、Microsoft 及 Minecraft 官方无隶属或背书关系。</p>
    </main>
  )
}
