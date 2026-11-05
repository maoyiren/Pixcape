'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UsernameSettingsForm({ currentUsername }: { currentUsername: string }) {
  const router = useRouter()
  const [username, setUsername] = useState(currentUsername)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/users/me/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || '用户名更新失败')
      setUsername(payload.username)
      setMessage('用户名已更新，旧主页地址将自动跳转。')
      router.replace(`/u/${payload.username}/settings`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '用户名更新失败')
    } finally {
      setBusy(false)
    }
  }

  return <div style={{ display: 'grid', gap: 10, maxWidth: 480 }}>
    <label htmlFor="username">用户名</label>
    <input id="username" value={username} onChange={event => setUsername(event.target.value)} minLength={3} maxLength={24} autoComplete="off" />
    <small>3–24 位，仅支持英文字母、数字、下划线和连字符。</small>
    <button type="button" disabled={busy || username.trim().toLowerCase() === currentUsername} onClick={() => void save()}>{busy ? '保存中…' : '保存用户名'}</button>
    {message ? <p role="status">{message}</p> : null}
  </div>
}
