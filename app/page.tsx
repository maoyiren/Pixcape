import Link from 'next/link'

const tools = [
  { number: '00', title: '创作工坊', tag: '统一工作台', description: '从编辑、AI 生成到衣服选装，在同一个入口开始创作并继续已有流程。', href: '/workbench', action: '进入创作工坊', featured: true },
  { number: '01', title: 'AI 创作', tag: '文字 / 图片', description: '通过文字描述或参考图片构思 Minecraft 皮肤；可用能力取决于已配置的 AI 服务。', href: '/ai', action: '开始 AI 创作', featured: true },
  { number: '02', title: '衣服选装', tag: '角色搭配', description: '浏览已接入的服装素材并预览搭配；披肩、外套与披风保持独立分类。', href: '/wardrobe', action: '开始搭配', featured: false },
  { number: '03', title: '单品编辑器', tag: '像素 / 3D', description: '导入皮肤，编辑像素贴图与配件，在角色预览中检查效果并继续导出流程。', href: '/editor', action: '打开编辑器', featured: false },
  { number: '04', title: '创作者中心', tag: '公开资料', description: '完善创作者展示资料，为发布原创作品与社区功能做好准备。', href: '/creator', action: '进入创作者中心', featured: false },
]

const quickLinks = [
  { label: '创作工坊', detail: '进入生成、编辑与衣服选装流程', href: '/workbench', symbol: '◉' },
  { label: '我的账户', detail: '查看账户资料与安全状态', href: '/account', symbol: '↗' },
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
            <Link className="cdpc-button cdpc-button-primary cdpc-control cdpc-control-primary" href="/workbench">进入创作工坊 <span aria-hidden="true">↗</span></Link>
            <Link className="cdpc-button cdpc-button-quiet cdpc-control" href="/wardrobe">试试衣服选装</Link>
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
        <div><p className="cdpc-section-kicker">TOOLS / 01</p><h2>创作入口，清晰分工</h2></div>
        <p>先进入创作工坊，再按需要选择 AI、像素编辑或衣服搭配。</p>
      </section>

      <section className="cdpc-tool-grid" aria-label="工具与功能">
        {tools.map((tool) => (
          <article className={`cdpc-tool-card ${tool.featured ? 'is-featured' : ''}`} key={tool.number}>
            <div className="cdpc-card-top"><span className="cdpc-card-number">{tool.number}</span><span className="cdpc-card-tag">{tool.tag}</span></div>
            <div className={`cdpc-tool-glyph glyph-${tool.number}`} aria-hidden="true"><span>{tool.number === '00' ? '◉' : tool.number === '01' ? '▦' : tool.number === '02' ? '◫' : tool.number === '03' ? '♧' : '✎'}</span></div>
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            <Link href={tool.href} className="cdpc-card-link cdpc-control">{tool.action} <span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </section>

      <section className="cdpc-quick-row" aria-label="账户快捷入口">
        <div className="cdpc-quick-intro"><p className="cdpc-section-kicker">YOUR SPACE / 02</p><h2>你的创作空间</h2><p>创作工坊负责进入创作流程；账户页面管理登录资料，创作者中心管理公开展示资料。</p></div>
        {quickLinks.map((item) => <Link className="cdpc-quick-link cdpc-control" href={item.href} key={item.href}><span className="quick-symbol">{item.symbol}</span><span><b>{item.label}</b><small>{item.detail}</small></span><span className="quick-arrow" aria-hidden="true">↗</span></Link>)}
      </section>

      <p className="cdpc-legal-note">CDPC 为独立社区工具项目，与 Mojang Studios、Microsoft 及 Minecraft 官方无隶属或背书关系。</p>
    </main>
  )
}
