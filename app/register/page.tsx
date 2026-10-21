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
      if (!response.ok) setError(data.error || '暂时无法创建账户，请检查填写内容后重试。')
      else setMessage(data.message || '账户已创建，可以前往登录。')
    } catch { setError('暂时无法连接服务，请稍后重试。') }
    finally { setBusy(false) }
  }

  return <main className="inventory-shell">
    <header className="topbar"><div><p className="eyebrow">JOIN CDPC</p><h1>创建账户</h1></div><Link className="pixel-button" href="/login">已有账户？登录</Link></header>
    <section className="hero inventory-panel">
      <h2>创建你的 CDPC 账户</h2>
      <p>用你长期可以访问的邮箱注册。账户可用于管理个人资料与创作者申请；密码至少需要 10 位。</p>
      <form className="auth-email-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="register-name">昵称 <span>（选填）</span></label><input id="register-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="nickname" placeholder="你希望显示的名称" />
        <label htmlFor="register-email">邮箱地址</label><input id="register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required autoComplete="email" placeholder="name@example.com" />
        <label htmlFor="register-password">设置密码</label><input id="register-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={256} required autoComplete="new-password" placeholder="至少 10 位字符" />
        <button className="pixel-button primary" disabled={busy} type="submit">{busy ? '正在创建账户…' : '创建账户'}</button>
      </form>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message} <Link href="/login">前往登录</Link></p>}
      <p>注册后默认是普通账户。创作者身份需审核，管理员权限由管理员单独授予。</p>
    </section>
  </main>
}
