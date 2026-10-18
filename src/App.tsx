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
      <div className={editorOpen ? 'cdpc-studio-hidden' : undefined}>
        <PresetStudio onOpenAI={() => setAiOpen(true)} onOpenEditor={(payload) => {
          setPendingPayload(payload)
          setEditorOpen(true)
        }} />
      </div>
      {editorOpen && (
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
          <iframe
            ref={iframeRef}
            title="CDPC 内置 Blockbench 完整模型编辑器"
            src={BLOCKBENCH_PATH}
            onLoad={handleEditorLoad}
            allow="clipboard-read; clipboard-write; fullscreen"
            className="cdpc-editor-frame"
          />
        </div>
      )}
      </>
      )}
    </>
  )
}
