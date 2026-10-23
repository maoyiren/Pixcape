'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { signIn } from 'next-auth/react'

type Method = { id: string; label: string }

export default function LoginForm({ methods, adminEnabled }: { methods: Method[]; adminEnabled: boolean }) {
  const [identifier, setIdentifier] = useState('')
  const [accountType, setAccountType] = useState<'user' | 'admin'>('user')
  const [password, setPassword] = useState('')
  const [magicEmail, setMagicEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function oauth(provider: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await signIn(provider, { callbackUrl: '/account', redirect: false })
      if (result?.error) {
        setError('第三方登录启动失败，请检查认证服务配置、回调地址和密钥后重试。')
        setBusy(false)
        return
      }
      if (result?.url) {
        window.location.assign(result.url)
        return
      }
      setError('认证服务没有返回登录地址，请稍后重试。')
      setBusy(false)
    } catch {
      setError('无法连接认证服务，请稍后重试。')
      setBusy(false)
    }
  }

  async function credentialLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const value = identifier.trim()
    const isAdmin = accountType === 'admin'
    if (isAdmin && !adminEnabled) {
      setError('管理员登录当前未启用，请检查部署环境变量。')
      setBusy(false)
      return
    }
    try {
      const provider = isAdmin ? 'admin-credentials' : 'email-password'
      const callbackUrl = isAdmin ? '/admin' : '/account'
      const credentials = isAdmin
        ? { username: value, password, callbackUrl, redirect: false as const }
        : { email: value.toLowerCase(), password, callbackUrl, redirect: false as const }
      const result = await signIn(provider, credentials)
      if (result?.error) {
        setError(isAdmin ? '管理员用户名或密码错误，或管理员账号未启用。' : '邮箱或密码错误，或账户当前不可登录。')
      } else if (result?.url) {
        window.location.assign(result.url)
        return
      } else {
        setError('登录失败，请检查账号、认证密钥和数据库配置。')
      }
    } catch {
      setError('登录请求失败，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  async function emailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await signIn('email', { email: magicEmail.trim().toLowerCase(), callbackUrl: '/account', redirect: false })
      if (result?.error) setError('邮件发送失败，请检查 SMTP 配置。')
      else setMessage('如果邮箱服务配置正确，请检查收件箱和垃圾邮件。')
    } catch {
      setError('邮件发送失败，请检查 SMTP 配置。')
    } finally {
      setBusy(false)
    }
  }

  const emailEnabled = methods.some((method) => method.id === 'email')
  const oauthMethods = methods.filter((method) => method.id !== 'email')
  return (
    <div className="auth-form">
      <form onSubmit={(event) => void credentialLogin(event)} className="auth-email-form auth-unified-credentials">
        {adminEnabled ? <div className="auth-account-type" role="group" aria-label="账户类型">
          <button type="button" className={accountType === 'user' ? 'is-selected' : ''} aria-pressed={accountType === 'user'} onClick={() => setAccountType('user')} disabled={busy}>普通用户</button>
          <button type="button" className={accountType === 'admin' ? 'is-selected' : ''} aria-pressed={accountType === 'admin'} onClick={() => setAccountType('admin')} disabled={busy}>管理员</button>
        </div> : null}
        <label htmlFor="login-identifier">{accountType === 'admin' ? '管理员用户名' : '邮箱地址'}</label>
        <input
          id="login-identifier"
          type={accountType === 'admin' ? 'text' : 'email'}
          autoComplete="username"
          required
          maxLength={254}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder={accountType === 'admin' ? '管理员用户名' : 'name@example.com'}
        />
        <label htmlFor="login-password">密码</label>
        <input id="login-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="pixel-button primary" disabled={busy} type="submit">{busy ? '正在验证…' : '登录 CDPC'}</button>
        <small>普通用户使用注册邮箱；管理员选择管理员身份后使用配置的用户名。系统仍会在服务端校验账号权限。</small>
      </form>
      {oauthMethods.length > 0 ? (
        <div className="auth-provider-group">
          <p className="auth-divider-label">或使用第三方账号</p>
          {oauthMethods.map((method) => (
            <button className="pixel-button auth-provider-button" type="button" key={method.id} disabled={busy} onClick={() => void oauth(method.id)}>
              {busy ? '正在连接…' : method.label}
            </button>
          ))}
        </div>
      ) : null}
      {emailEnabled && (
        <details className="auth-magic-link">
          <summary>改用邮箱登录链接</summary>
          <form onSubmit={(event) => void emailLogin(event)} className="auth-email-form">
            <label htmlFor="magic-email">邮箱地址</label>
            <input id="magic-email" type="email" autoComplete="email" required maxLength={254} value={magicEmail} onChange={(event) => setMagicEmail(event.target.value)} placeholder="name@example.com" />
            <button className="pixel-button primary" disabled={busy} type="submit">{busy ? '正在发送…' : '发送登录链接'}</button>
          </form>
        </details>
      )}
      {error ? <p role="alert" className="auth-feedback auth-feedback-error">{error}</p> : null}
      {message ? <p role="status" className="auth-feedback auth-feedback-success">{message}</p> : null}
    </div>
  )
}
