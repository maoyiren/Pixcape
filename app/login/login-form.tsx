'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { signIn } from 'next-auth/react'

type Method = { id: string; label: string }

export default function LoginForm({ methods, adminEnabled, defaultCallbackUrl }: { methods: Method[]; adminEnabled: boolean; defaultCallbackUrl: string }) {
  const [identifier, setIdentifier] = useState('')
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
      const result = await signIn(provider, { callbackUrl: defaultCallbackUrl, redirect: false })
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
    const looksLikeEmail = value.includes('@')

    try {
      // Email addresses use the regular-user provider; non-email identifiers use
      // the environment-configured admin provider. Authorization remains server-side.
      if (looksLikeEmail) {
        const result = await signIn('email-password', {
          email: value.toLowerCase(),
          password,
          callbackUrl: defaultCallbackUrl,
          redirect: false,
        })
        if (!result?.error && result?.url) {
          window.location.assign(result.url)
          return
        }
      } else if (adminEnabled) {
        const result = await signIn('admin-credentials', {
          username: value,
          password,
          callbackUrl: '/admin',
          redirect: false,
        })
        if (!result?.error && result?.url) {
          window.location.assign(result.url)
          return
        }
      }

      setError('用户名/邮箱或密码错误，或该账户当前不可登录。请检查账号后重试。')
    } catch {
      setError('登录请求失败，请稍后重试；如果持续失败，请检查认证服务和数据库配置。')
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
      const result = await signIn('email', { email: magicEmail.trim().toLowerCase(), callbackUrl: '/workbench', redirect: false })
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
        <label htmlFor="login-identifier">用户名或邮箱地址</label>
        <input
          id="login-identifier"
          className="cdpc-input"
          type="text"
          autoComplete="username"
          required
          maxLength={254}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="输入邮箱地址；管理员可输入配置的用户名"
        />
        <label htmlFor="login-password">密码</label>
        <input id="login-password" className="cdpc-input" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="pixel-button primary cdpc-control cdpc-control-primary" disabled={busy} type="submit">{busy ? '正在验证…' : '登录 CDPC'}</button>
        <small>普通账户使用注册邮箱登录；管理员使用运维配置的用户名登录。普通账户暂不支持昵称登录。</small>
      </form>
      {oauthMethods.length > 0 ? (
        <div className="auth-provider-group">
          <p className="auth-divider-label">或使用第三方账号</p>
          {oauthMethods.map((method) => (
            <button className="pixel-button auth-provider-button cdpc-control" type="button" key={method.id} disabled={busy} onClick={() => void oauth(method.id)}>
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
            <input id="magic-email" className="cdpc-input" type="email" autoComplete="email" required maxLength={254} value={magicEmail} onChange={(event) => setMagicEmail(event.target.value)} placeholder="name@example.com" />
            <button className="pixel-button primary" disabled={busy} type="submit">{busy ? '正在发送…' : '发送登录链接'}</button>
          </form>
        </details>
      )}
      {error ? <p role="alert" className="auth-feedback auth-feedback-error">{error}</p> : null}
      {message ? <p role="status" className="auth-feedback auth-feedback-success">{message}</p> : null}
    </div>
  )
}
