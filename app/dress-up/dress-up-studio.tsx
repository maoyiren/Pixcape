'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

const categories = ['全部', '上衣', '外套', '裤子', '鞋子', '帽子', '披肩', '披风'] as const
type Category = typeof categories[number]
type CatalogItem = { id: string; name: string; category: Exclude<Category, '全部'>; mark: string; note: string }

const catalog: CatalogItem[] = [
  { id: 'shirt-basic', name: '基础上衣', category: '上衣', mark: '▤', note: '上身服装' },
  { id: 'coat-creeper', name: '苦力怕外套', category: '外套', mark: '▥', note: '外层服装' },
  { id: 'coat-tiktok', name: '街头外套', category: '外套', mark: '▥', note: '外层服装' },
  { id: 'pants-basic', name: '基础长裤', category: '裤子', mark: '▥', note: '腿部服装' },
  { id: 'shoes-basic', name: '像素运动鞋', category: '鞋子', mark: '▰', note: '脚部服装' },
  { id: 'hat-basic', name: '方块帽', category: '帽子', mark: '▰', note: '头部配饰' },
  { id: 'shawl-creeper', name: '苦力怕披肩', category: '披肩', mark: '▧', note: '肩颈装饰' },
  { id: 'shawl-office', name: '眼眸花披肩', category: '披肩', mark: '▧', note: '肩颈装饰' },
  { id: 'cape-creeper', name: '苦力怕披风', category: '披风', mark: '▥', note: '背部配饰' },
]

export default function DressUpStudio() {
  const [category, setCategory] = useState<Category>('全部')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<string, CatalogItem>>({})
  const filtered = useMemo(() => catalog.filter((item) =>
    (category === '全部' || item.category === category) &&
    (item.name.toLowerCase().includes(query.trim().toLowerCase()) || item.category.includes(query.trim())),
  ), [category, query])
  const selectedItems = Object.values(selected)

  function toggleItem(item: CatalogItem) {
    setSelected((current) => {
      const next = { ...current }
      if (next[item.category]?.id === item.id) delete next[item.category]
      else next[item.category] = item
      return next
    })
  }

  function clearSelection() {
    setSelected({})
  }

  return (
    <main className="dressup-page">
      <header className="dressup-heading">
        <div>
          <div className="dressup-eyebrow">CDPC / OUTFIT BUILDER</div>
          <h1>衣服选装</h1>
          <p>按分类逐件搭配角色。披肩、外套和披风分别管理；选装与像素编辑分开，让搭配更直观。</p>
        </div>
        <Link className="cdpc-button cdpc-button-quiet" href="/studio">进入创作工坊 ↗</Link>
      </header>

      <div className="dressup-layout">
        <section className="dressup-panel" aria-label="服装素材">
          <h2>选择服装</h2>
          <input className="dressup-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索服装名称…" aria-label="搜索服装" />
          <div className="dressup-categories" aria-label="服装分类">
            {categories.map((item) => <button type="button" className="dressup-category" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          <div className="dressup-items">
            {filtered.map((item) => <button type="button" key={item.id} className="dressup-item" aria-pressed={selected[item.category]?.id === item.id} onClick={() => toggleItem(item)}>
              <span className="dressup-item-mark" aria-hidden="true">{item.mark}</span>
              <strong>{item.name}</strong>
              <small>{item.category} · {item.note}</small>
            </button>)}
          </div>
          {filtered.length === 0 && <p className="dressup-empty">没有找到匹配的素材。试试其他关键词或分类。</p>}
        </section>

        <section className="dressup-panel dressup-preview" aria-label="角色搭配预览">
          <h2>搭配预览 <span style={{ color: '#a4adba', fontWeight: 400 }}>· 页面布局示意</span></h2>
          <div className="dressup-preview-stage">
            <div className="dressup-avatar" aria-label="示意角色">
              {selected['披风'] && <span className="dressup-cape" />}
              <span className="dressup-avatar-head" />
              <span className="dressup-avatar-body" />
              <span className="dressup-avatar-legs"><span /><span /></span>
            </div>
          </div>
          <p className="dressup-preview-note">当前阶段是选装交互与页面框架。此处角色为布局示意，尚未连接真实 3D 贴图预览；下一步将接入现有皮肤与配件预览数据。</p>
        </section>

        <aside className="dressup-panel" aria-label="当前穿搭">
          <h2>当前穿搭 <span style={{ color: '#a4adba', fontWeight: 400 }}>({selectedItems.length})</span></h2>
          {selectedItems.length ? <div className="dressup-selected-list">
            {selectedItems.map((item) => <div className="dressup-selected-row" key={item.id}><span>{item.category} · {item.name}</span><button type="button" onClick={() => toggleItem(item)}>移除</button></div>)}
          </div> : <p className="dressup-empty">还没有选择服装。点击左侧素材即可加入穿搭，同一分类只保留一件。</p>}
          <div className="dressup-actions">
            <button type="button" onClick={clearSelection}>清空当前选择</button>
            <Link className="primary" href="/studio">继续到创作工坊</Link>
          </div>
          <p className="dressup-preview-note">保存穿搭、随机搭配、真实 3D 叠加和导出能力将在接入现有素材模型后启用，不在此阶段显示为可用按钮。</p>
        </aside>
      </div>
    </main>
  )
}
