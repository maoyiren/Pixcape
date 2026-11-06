'use client'

import { useState } from 'react'

export default function PublishButton({ kind, id, title }: { kind: 'asset' | 'outfit'; id: string; title: string }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function publish() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ [kind === 'asset' ? 'assetId' : 'outfitId']: id, title }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || '发布失败')
      const url = new URL(payload.shareUrl, window.location.origin).toString()
      await navigator.clipboard?.writeText(url).catch(() => undefined)
      setMessage('已公开发布：' + payload.shareUrl)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发布失败')
    } finally {
      setBusy(false)
    }
  }
  return <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
    <button type="button" disabled={busy} onClick={() => void publish()}>{busy ? '发布中…' : '公开分享'}</button>
    {message ? <small role="status">{message}</small> : null}
  </span>
}
