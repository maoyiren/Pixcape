'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { signIn } from 'next-auth/react'

type Method = { id: string; label: string }

export default function LoginForm({ methods, adminEnabled }: { methods: Method[]; adminEnabled: boolean }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function oauth(provider: string) {
    setBusy(true); setError('')
    try { await signIn(provider, { callbackUrl: '/account' }) }
    catch { setError('无法启动登录，请检查服务配置后重试。'); setBusy(false) }
  }

  async function adminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError('')
    const result = await signIn('admin-credentials', { username, password, callbackUrl: '/admin', redirect: false })
    setBusy(false)
    if (result?.error) setError('管理员用户名或密码错误，或管理员账号未启用。')
    else if (result?.url) window.location.assign(result.url)
    else setError('登录失败，请检查认证密钥和数据库配置。')
  }

  async function emailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await signIn('email', { email: email.trim(), callbackUrl: '/account', redirect: false })
      if (result?.error) setError('邮件发送失败，请检查 SMTP 配置。')
      else setMessage('如邮箱服务已正确配置，请检查收件箱及垃圾邮件。')
    } catch { setError('邮件发送失败，请检查 SMTP 配置。') }
    finally { setBusy(false) }
  }

  const emailEnabled = methods.some((method) => method.id === 'email')
  return <div className="auth-form">
    {methods.filter((method) => method.id !== 'email').map((method) =>
      <button className="pixel-button" type="button" key={method.id} disabled={busy} onClick={() => void oauth(method.id)}>{method.label}</button>
    )}
    {emailEnabled && <form onSubmit={(e) => void emailLogin(e)} className="auth-email-form">
      <label htmlFor="auth-email">邮箱登录</label>
      <input id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      <button className="pixel-button primary" disabled={busy} type="submit">发送邮箱登录链接</button>
    </form>}
    {adminEnabled && <details className="admin-login-details">
      <summary>管理员登录</summary>
      <form onSubmit={(e) => void adminLogin(e)} className="auth-email-form">
        <label htmlFor="admin-username">管理员用户名</label>
        <input id="admin-username" autoComplete="username" required maxLength={100} value={username} onChange={(e) => setUsername(e.target.value)} />
        <label htmlFor="admin-password">管理员密码</label>
        <input id="admin-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="pixel-button primary" disabled={busy} type="submit">{busy ? '正在登录…' : '登录管理后台'}</button>
      </form>
    </details>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </div>
}
