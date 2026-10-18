'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { FormEvent } from 'react'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await response.json()
      if (!response.ok) setError(data.error || '注册失败，请重试。')
      else setMessage(data.message || '注册成功，请登录。')
    } catch { setError('网络错误，请稍后重试。') }
    finally { setBusy(false) }
  }

  return <main className="inventory-shell">
    <header className="topbar"><div><p className="eyebrow">CDPC ACCOUNT</p><h1>创建账户</h1></div><Link className="pixel-button" href="/login">返回登录</Link></header>
    <section className="hero inventory-panel">
      <h2>邮箱注册</h2>
      <p>默认无需邮箱验证码。请设置至少 10 位密码；新账户将以普通用户权限创建。</p>
      <form className="auth-email-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="register-name">昵称（可选）</label><input id="register-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="nickname" />
        <label htmlFor="register-email">邮箱地址</label><input id="register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required autoComplete="email" />
        <label htmlFor="register-password">密码</label><input id="register-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={256} required autoComplete="new-password" />
        <button className="pixel-button primary" disabled={busy} type="submit">{busy ? '正在创建账户…' : '注册账户'}</button>
      </form>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message} <Link href="/login">前往登录</Link></p>}
    </section>
  </main>
}
