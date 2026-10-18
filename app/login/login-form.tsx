'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { signIn } from 'next-auth/react'

type LoginMethod = { id: string; label: string }

const providerMeta: Record<string, { mark: string; className: string }> = {
  github: { mark: 'GH', className: 'github' },
  google: { mark: 'G', className: 'google' },
  'azure-ad': { mark: 'M', className: 'microsoft' },
  apple: { mark: 'A', className: 'apple' },
}

export default function LoginForm({ methods }: { methods: LoginMethod[] }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function startOAuth(provider: string) {
    setBusy(provider)
    setMessage('')
    setError('')
    try {
      await signIn(provider, { callbackUrl: '/account' })
    } catch {
      setError('暂时无法启动登录，请稍后重试。如果问题持续，请联系管理员。')
      setBusy(null)
    }
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('email')
    setMessage('')
    setError('')
    try {
      const result = await signIn('email', {
        email: email.trim(),
        callbackUrl: '/account',
        redirect: false,
      })
      if (result?.error) {
        setError('暂时无法发送登录邮件，请稍后重试或联系管理员。')
      } else {
        setMessage('如果该邮箱可用于登录，登录链接将发送至你的收件箱。请同时检查垃圾邮件。首次使用该邮箱登录会创建普通用户账户。')
      }
    } catch {
      setError('暂时无法发送登录邮件，请检查邮箱地址后重试。')
    } finally {
      setBusy(null)
    }
  }

  const emailEnabled = methods.some((method) => method.id === 'email')
  const oauthMethods = methods.filter((method) => method.id !== 'email')

  return (
    <div className="auth-form">
      {oauthMethods.length > 0 && (
        <div className="auth-provider-list">
          {oauthMethods.map((method) => {
            const meta = providerMeta[method.id] ?? { mark: '↗', className: 'other' }
            return (
              <button
                className="auth-provider-button"
                key={method.id}
                type="button"
                disabled={busy !== null}
                onClick={() => void startOAuth(method.id)}
              >
                <span className={`auth-provider-mark ${meta.className}`} aria-hidden="true">{meta.mark}</span>
                <span>{busy === method.id ? '正在连接…' : `使用 ${method.label} 继续`}</span>
                <span className="auth-provider-arrow" aria-hidden="true">↗</span>
              </button>
            )
          })}
        </div>
      )}
      {emailEnabled && (
        <>
          {oauthMethods.length > 0 && <div className="auth-divider"><span>或者使用邮箱</span></div>}
          <form className="auth-email-form" onSubmit={(event) => void sendMagicLink(event)}>
            <label htmlFor="login-email">邮箱地址</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              disabled={busy !== null}
            />
            <button className="auth-submit-button" type="submit" disabled={busy !== null}>
              {busy === 'email' ? '正在发送登录链接…' : '发送登录链接'}
              {busy !== 'email' && <span aria-hidden="true">→</span>}
            </button>
            <p className="auth-email-hint">无需设置密码。首次使用邮箱登录时会自动创建普通账户。</p>
          </form>
        </>
      )}
      {message && <p role="status" className="auth-feedback auth-feedback-success">{message}</p>}
      {error && <p role="alert" className="auth-feedback auth-feedback-error">{error}</p>}
    </div>
  )
}
