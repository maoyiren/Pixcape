'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import type { ComponentType } from 'react'
import '../../src/styles.css'

type StudioMode = 'editor' | 'ai' | 'wardrobe'
type WorkspacePointer = {
  projectId: string | null
  activeTool: 'WARDROBE' | 'PIXEL_EDITOR' | 'AI_GENERATOR'
  activeAssetId: string | null
  activeOutfitId: string | null
}

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

function usePersistEditorHandoff(mode: StudioMode) {
  useEffect(() => {
    if (mode !== 'editor') return
    const controller = new AbortController()

    const persist = async () => {
      try {
        const current = await fetch('/api/workspace', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        })
        // Guests can still use the editor; workspace persistence is account-scoped.
        if (!current.ok) return
        const payload = await current.json() as { item?: Partial<WorkspacePointer> }
        const item = payload.item
        if (!item) return

        const pointer: WorkspacePointer = {
          projectId: item.projectId ?? null,
          activeTool: 'PIXEL_EDITOR',
          activeAssetId: item.activeAssetId ?? null,
          activeOutfitId: item.activeOutfitId ?? null,
        }
        await fetch('/api/workspace', {
          method: 'PUT',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pointer),
          signal: controller.signal,
        })
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        // Persistence is an enhancement: never block the editor on a transient API failure.
      }
    }

    void persist()
    return () => controller.abort()
  }, [mode])
}

export default function NextStudio({ mode }: { mode: StudioMode }) {
  usePersistEditorHandoff(mode)

  return (
    <div className="cdpc-next-studio" data-studio-mode={mode}>
      <StudioApp mode={mode} />
    </div>
  )
}
