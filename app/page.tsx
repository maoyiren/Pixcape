import Link from 'next/link'

const tools = [
  { number: '01', title: '皮肤与配件编辑', tag: '编辑器', description: '导入皮肤，搭配披肩、披风与服饰配件，实时查看角色效果。', href: '/studio', action: '进入编辑器', featured: true },
  { number: '02', title: 'AI 皮肤工坊', tag: 'AI 创作', description: '从文字想法或参考图开始，探索角色皮肤的创作方向。', href: '/studio', action: '查看创作入口', featured: false },
  { number: '03', title: '创作者中心', tag: '作品发布', description: '申请创作者身份，整理个人资料，为作品发布做好准备。', href: '/creator', action: '进入创作者中心', featured: false },
]

const quickLinks = [
  { label: '个人账户', detail: '管理登录状态与账户资料', href: '/account', symbol: '◉' },
  { label: '登录 / 注册', detail: '保存你的创作身份', href: '/login', symbol: '↗' },
]

export default function MigrationHome() {
  return (
    <main className="cdpc-home">
      <section className="cdpc-hero">
        <div className="cdpc-hero-copy">
          <p className="cdpc-kicker"><span className="pixel-live-dot" /> 像素角色创作平台</p>
          <h1>把你的想法，<br /><span>做成角色的一部分。</span></h1>
          <p className="cdpc-hero-description">从 Minecraft 皮肤到披肩、披风与服饰配件，在这里搭配、预览并继续创作。工具优先，作品说话。</p>
          <div className="cdpc-hero-actions">
            <Link className="cdpc-button cdpc-button-primary" href="/studio">开始创作 <span aria-hidden="true">↗</span></Link>
            <Link className="cdpc-button cdpc-button-quiet" href="/creator">创作者入口</Link>
          </div>
          <div className="cdpc-hero-footnote"><span className="cdpc-mini-pixel" aria-hidden="true">▦</span> 面向像素创作与角色搭配的工具集合</div>
        </div>
        <div className="cdpc-pixel-scene" aria-label="像素色块构成的角色创作视觉">
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
          <div className="scene-label label-top"><span>PIXEL LAB</span><b>角色预览</b></div>
          <div className="scene-label label-bottom"><span className="scene-status-dot" /> 创作，从这里开始</div>
        </div>
      </section>

      <section className="cdpc-section-heading">
        <div><p className="cdpc-section-kicker">TOOLS / 01</p><h2>先做作品，再谈灵感</h2></div>
        <p>常用入口放在前面，少一点介绍，多一点可操作的功能。</p>
      </section>

      <section className="cdpc-tool-grid" aria-label="创作工具">
        {tools.map((tool) => (
          <article className={`cdpc-tool-card ${tool.featured ? 'is-featured' : ''}`} key={tool.number}>
            <div className="cdpc-card-top"><span className="cdpc-card-number">{tool.number}</span><span className="cdpc-card-tag">{tool.tag}</span></div>
            <div className={`cdpc-tool-glyph glyph-${tool.number}`} aria-hidden="true"><span>{tool.number === '01' ? '▦' : tool.number === '02' ? '✳' : '✎'}</span></div>
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            <Link href={tool.href} className="cdpc-card-link">{tool.action} <span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </section>

      <section className="cdpc-quick-row" aria-label="账户快捷入口">
        <div className="cdpc-quick-intro"><p className="cdpc-section-kicker">YOUR SPACE / 02</p><h2>你的创作空间</h2><p>登录后继续管理自己的账户与创作者资料。</p></div>
        {quickLinks.map((item) => <Link className="cdpc-quick-link" href={item.href} key={item.href}><span className="quick-symbol">{item.symbol}</span><span><b>{item.label}</b><small>{item.detail}</small></span><span className="quick-arrow" aria-hidden="true">↗</span></Link>)}
      </section>

      <p className="cdpc-legal-note">CDPC 是独立的像素创作工具项目，与 Mojang、Microsoft 及 Minecraft 官方无隶属或背书关系。</p>
    </main>
  )
}
