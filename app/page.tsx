import Link from 'next/link'

const tools = [
  { number: '01', title: '皮肤与配件编辑', tag: '编辑器', description: '导入现有皮肤，分别选择披肩、外套或披风素材，搭配后查看角色效果。', href: '/studio', action: '打开编辑器', featured: true },
  { number: '02', title: '角色预览与导出', tag: '预览工作流', description: '在编辑器中检查搭配结果，确认后导出皮肤 PNG，方便带回游戏使用。', href: '/studio', action: '开始搭配', featured: false },
  { number: '03', title: '创作者中心', tag: '创作者计划', description: '提交创作者申请，完善展示名称与简介；通过审核后再逐步开放创作者功能。', href: '/creator', action: '了解创作者入口', featured: false },
]

const quickLinks = [
  { label: '我的账户', detail: '查看账户状态与个人资料', href: '/account', symbol: '◉' },
  { label: '登录 / 注册', detail: '保存账户，管理自己的创作', href: '/login', symbol: '↗' },
]

export default function MigrationHome() {
  return (
    <main className="cdpc-home">
      <section className="cdpc-hero">
        <div className="cdpc-hero-copy">
          <p className="cdpc-kicker"><span className="pixel-live-dot" /> CDPC · 像素角色工具</p>
          <h1>让角色更像<br /><span>你想要的样子。</span></h1>
          <p className="cdpc-hero-description">从 Minecraft 皮肤开始，搭配披肩、外套和披风。导入、预览、调整，再把满意的作品带进游戏。</p>
          <div className="cdpc-hero-actions">
            <Link className="cdpc-button cdpc-button-primary" href="/studio">开始编辑 <span aria-hidden="true">↗</span></Link>
            <Link className="cdpc-button cdpc-button-quiet" href="/creator">创作者中心</Link>
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
        <div><p className="cdpc-section-kicker">TOOLS / 01</p><h2>需要什么，就从这里开始</h2></div>
        <p>把常用功能放在前面。先完成搭配，再考虑下一步。</p>
      </section>

      <section className="cdpc-tool-grid" aria-label="工具与功能">
        {tools.map((tool) => (
          <article className={`cdpc-tool-card ${tool.featured ? 'is-featured' : ''}`} key={tool.number}>
            <div className="cdpc-card-top"><span className="cdpc-card-number">{tool.number}</span><span className="cdpc-card-tag">{tool.tag}</span></div>
            <div className={`cdpc-tool-glyph glyph-${tool.number}`} aria-hidden="true"><span>{tool.number === '01' ? '▦' : tool.number === '02' ? '◫' : '✎'}</span></div>
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            <Link href={tool.href} className="cdpc-card-link">{tool.action} <span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </section>

      <section className="cdpc-quick-row" aria-label="账户快捷入口">
        <div className="cdpc-quick-intro"><p className="cdpc-section-kicker">YOUR SPACE / 02</p><h2>你的账户空间</h2><p>登录后查看账户资料，并管理创作者申请。</p></div>
        {quickLinks.map((item) => <Link className="cdpc-quick-link" href={item.href} key={item.href}><span className="quick-symbol">{item.symbol}</span><span><b>{item.label}</b><small>{item.detail}</small></span><span className="quick-arrow" aria-hidden="true">↗</span></Link>)}
      </section>

      <p className="cdpc-legal-note">CDPC 为独立社区工具项目，与 Mojang Studios、Microsoft 及 Minecraft 官方无隶属或背书关系。</p>
    </main>
  )
}
