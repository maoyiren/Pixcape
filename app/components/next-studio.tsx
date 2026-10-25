'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import '../../src/styles.css'

type StudioMode = 'editor' | 'ai' | 'wardrobe'
const StudioApp = dynamic(
  () => import('../../src/App') as Promise<{ default: ComponentType<{ mode?: StudioMode }> }>,
  {
    ssr: false,
    loading: () => (
      <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <p role="status">正在加载 CDPC 创作工具…</p>
      </main>
    ),
  },
)

export default function NextStudio({ mode }: { mode: StudioMode }) {
  return (
    <div className="cdpc-next-studio" data-studio-mode={mode}>
      <StudioApp mode={mode} />
    </div>
  )
}
