'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import '../../src/styles.css'
import './components/preset-studio.css'
import './components/preview-options.css'
import './components/navigation-refresh.css'
import type { PresetEditorPayload } from './components/PresetStudio'

const BLOCKBENCH_PATH = '/blockbench/'
const PresetStudio = dynamic(
  () => import('./components/PresetStudio') as Promise<{ default: ComponentType<{
    initialMode?: 'editor' | 'ai' | 'wardrobe'
    onOpenEditor: (payload: PresetEditorPayload) => void
    onOpenAI: () => void
  }> }>,
  {
    ssr: false,
    loading: () => <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24 }}><p role="status">正在加载单品编辑器…</p></main>,
  },
)


type WorkspacePointer = {
  projectId: string | null
  activeTool: 'WARDROBE' | 'PIXEL_EDITOR' | 'AI_GENERATOR'
  activeAssetId: string | null
  activeOutfitId: string | null
}

function usePersistEditorHandoff() {
  useEffect(() => {
    const controller = new AbortController()
    const persist = async () => {
      try {
        const current = await fetch('/api/workspace', {
          method: 'GET', cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        })
        // Workspace persistence is account-scoped; anonymous editing remains available.
        if (!current.ok) return
        const payload = await current.json() as { item?: Partial<WorkspacePointer> }
        if (!payload.item) return
        const pointer: WorkspacePointer = {
          projectId: payload.item.projectId ?? null,
          activeTool: 'PIXEL_EDITOR',
          activeAssetId: payload.item.activeAssetId ?? null,
          activeOutfitId: payload.item.activeOutfitId ?? null,
        }
        await fetch('/api/workspace', {
          method: 'PUT', cache: 'no-store', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pointer), signal: controller.signal,
        })
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        // A transient persistence error must not prevent access to the editor.
      }
    }
    void persist()
    return () => controller.abort()
  }, [])
}

export default function EditorStudio() {
  usePersistEditorHandoff()
  const router = useRouter()
  const [editorOpen, setEditorOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<PresetEditorPayload | null>(null)
  const [importFeedback, setImportFeedback] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const importTimerRef = useRef<number | null>(null)
  const importAttemptRef = useRef(0)

  useEffect(() => {
    const handleImportResult = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      const message = event.data
      if (!message || message.type !== 'pixcape:import-complete') return
      if (message.ok) {
        setImportFeedback(pendingPayload?.language === 'en-US'
          ? `Imported ${message.count} texture(s): ${(message.names || []).join(', ')}`
          : `已导入 ${message.count} 个纹理：${(message.names || []).join('、')}`)
      } else {
        setImportFeedback(pendingPayload?.language === 'en-US'
          ? `Import failed: ${message.error || 'Unknown error'}`
          : `导入失败：${message.error || '未知错误'}`)
      }
    }
    window.addEventListener('message', handleImportResult)
    return () => {
      window.removeEventListener('message', handleImportResult)
      if (importTimerRef.current !== null) window.clearTimeout(importTimerRef.current)
    }
  }, [pendingPayload])

  const handleEditorLoad = () => {
    if (!pendingPayload) return
    const target = iframeRef.current?.contentWindow
    if (!target) return
    target.postMessage({ type: 'pixcape:set-language', language: pendingPayload.language || 'zh-CN' }, window.location.origin)
    if (importTimerRef.current !== null) window.clearTimeout(importTimerRef.current)
    importAttemptRef.current = 0
    const sendImportWhenReady = () => {
      if (!editorOpen || !pendingPayload || iframeRef.current?.contentWindow !== target) return
      importAttemptRef.current += 1
      target.postMessage({ type: 'pixcape:import-preset', payload: pendingPayload }, window.location.origin)
    }
    importTimerRef.current = window.setTimeout(sendImportWhenReady, 1200)
  }

  return (
    <div data-studio-mode="editor">
      {!editorOpen ? (
        <PresetStudio initialMode="editor" onOpenAI={() => router.push('/ai')} onOpenEditor={payload => {
          setPendingPayload(payload)
          setImportFeedback('')
          setEditorOpen(true)
        }} />
      ) : (
        <div className="cdpc-editor-overlay">
          <div className="cdpc-editor-toolbar">
            <button className="cdpc-editor-back" onClick={() => setEditorOpen(false)}>
              <ArrowLeft size={16} /> {pendingPayload?.language === 'en-US' ? 'Back to Studio' : '返回皮肤工作台'}
            </button>
            <span className="cdpc-editor-title">{pendingPayload?.language === 'en-US' ? 'CDPC Studio · Blockbench (GPL-3.0-or-later)' : 'CDPC Studio · Blockbench（GPL-3.0-or-later）'}</span>
            <a className="cdpc-editor-new-tab" href={BLOCKBENCH_PATH} target="_blank" rel="noreferrer">
              {pendingPayload?.language === 'en-US' ? 'Open in new tab' : '在新标签页打开'} <ExternalLink size={14} />
            </a>
          </div>
          <div className="cdpc-editor-disclaimer" role="note" aria-label="Project disclaimer and asset credits">
            {pendingPayload?.language === 'en-US' ? 'Unofficial Minecraft project · Coat & shawl assets: 邹陈云飞, Th千' : '非官方 Minecraft 项目 · 外套与披肩素材：邹陈云飞、Th千'}
          </div>
          {importFeedback && <div className="cdpc-editor-feedback" role="status" aria-live="polite">{importFeedback}</div>}
          <iframe ref={iframeRef} title="CDPC 内置 Blockbench 完整模型编辑器" src={BLOCKBENCH_PATH}
            onLoad={handleEditorLoad} allow="clipboard-read; clipboard-write; fullscreen" className="cdpc-editor-frame" />
        </div>
      )}
    </div>
  )
}
