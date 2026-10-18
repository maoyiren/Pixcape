import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import PresetStudio, { type PresetEditorPayload } from './PresetStudio'
import AiSkinStudio from './AiSkinStudio'

const BLOCKBENCH_PATH = '/blockbench/'

export default function App() {
  const [editorOpen, setEditorOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<PresetEditorPayload | null>(null)
  const [importFeedback, setImportFeedback] = useState<string>('')
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

    // Blockbench's page load event can fire before all editor modules and
    // the Undo API are initialized. Importing at that point can throw
    // "Cannot read properties of undefined (reading 'initEdit')".
    target.postMessage(
      { type: 'pixcape:set-language', language: pendingPayload.language || 'zh-CN' },
      window.location.origin,
    )
    if (importTimerRef.current !== null) window.clearTimeout(importTimerRef.current)
    importAttemptRef.current = 0
    const sendImportWhenReady = () => {
      if (!editorOpen || !pendingPayload || iframeRef.current?.contentWindow !== target) return
      importAttemptRef.current += 1
      target.postMessage(
        { type: 'pixcape:import-preset', payload: pendingPayload },
        window.location.origin,
      )
    }
    // Give Blockbench time to finish initializing its editor modules.
    importTimerRef.current = window.setTimeout(sendImportWhenReady, 1200)
  }

  return (
    <>
      {!editorOpen && aiOpen ? <AiSkinStudio onBack={() => setAiOpen(false)} /> : (
      <>
      <div style={{ display: editorOpen ? 'none' : 'block' }}>
        <PresetStudio onOpenAI={() => setAiOpen(true)} onOpenEditor={(payload) => {
          setPendingPayload(payload)
          setEditorOpen(true)
        }} />
      </div>
      {editorOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#111318', color: '#f5f5f5' }}>
          <div style={{ height: 48, minHeight: 48, display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', borderBottom: '1px solid #30333b', background: '#17191f' }}>
            <button onClick={() => setEditorOpen(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #454955', borderRadius: 8, padding: '7px 12px', color: 'inherit', background: '#252832', cursor: 'pointer' }}>
              <ArrowLeft size={16} /> {pendingPayload?.language === 'en-US' ? 'Back to Studio' : '返回皮肤工作台'}
            </button>
            <span style={{ fontSize: 13, color: '#b7bbc6' }}>{pendingPayload?.language === 'en-US' ? 'Pixcape Studio · Blockbench (GPL-3.0-or-later)' : 'Pixcape Studio · Blockbench（GPL-3.0-or-later）'}</span>
            <a href={BLOCKBENCH_PATH} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#c8c9ff', fontSize: 13 }}>
              {pendingPayload?.language === 'en-US' ? 'Open in new tab' : '在新标签页打开'} <ExternalLink size={14} />
            </a>
          </div>
          <div role="note" aria-label="Project disclaimer and asset credits" style={{ padding: '6px 14px', borderBottom: '1px solid #65552d', background: '#28251b', color: '#f2e4b7', fontSize: 11, lineHeight: 1.4 }}>
            {pendingPayload?.language === 'en-US' ? 'Unofficial Minecraft project · Coat & shawl assets: 邹陈云飞, Th千' : '非官方 Minecraft 项目 · 外套与披肩素材：邹陈云飞、Th千'}
          </div>
          {importFeedback && <div role="status" aria-live="polite" style={{ padding: '6px 14px', borderBottom: '1px solid #30333b', background: '#1d2028', color: importFeedback.includes('失败') || importFeedback.includes('failed') ? '#ffb4ab' : '#b8e7c1', fontSize: 12 }}>{importFeedback}</div>}
          <iframe
            ref={iframeRef}
            title="Pixcape 内置 Blockbench 完整模型编辑器"
            src={BLOCKBENCH_PATH}
            onLoad={handleEditorLoad}
            allow="clipboard-read; clipboard-write; fullscreen"
            style={{ border: 0, width: '100%', flex: 1, minHeight: 0, background: '#111318' }}
          />
        </div>
      )}
      </>
      )}
    </>
  )
}
