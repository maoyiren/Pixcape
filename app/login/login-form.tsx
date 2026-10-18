'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { signIn } from 'next-auth/react'

type LoginMethod = { id: string; label: string }

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
      // NextAuth provider sign-in must use its client helper (POST + CSRF),
      // rather than navigating directly to /api/auth/signin/:provider.
      await signIn(provider, { callbackUrl: '/account' })
    } catch {
      setError('无法启动登录，请刷新页面后重试。若仍失败，请检查部署日志和 OAuth 回调配置。')
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
        setError('登录邮件发送失败，请检查 SMTP 配置后重试。')
      } else {
        setMessage('如果该邮箱可用于登录，系统将发送一封登录链接。请检查收件箱和垃圾邮件；链接有效期为 15 分钟。首次使用该邮箱登录会创建普通用户账户。')
      }
    } catch {
      setError('登录邮件发送失败，请检查 SMTP 主机、端口、发件人和应用日志。')
    } finally {
      setBusy(null)
    }
  }

  const emailEnabled = methods.some((method) => method.id === 'email')

  return (
    <div className="login-flow">
      <div className="login-methods">
        {methods.filter((method) => method.id !== 'email').map((method) => (
          <button
            className="pixel-button primary"
            key={method.id}
            type="button"
            disabled={busy !== null}
            onClick={() => void startOAuth(method.id)}
          >
            {busy === method.id ? '正在跳转…' : method.label}
          </button>
        ))}
      </div>
      {emailEnabled && (
        <form className="login-email-form" onSubmit={(event) => void sendMagicLink(event)}>
          <label htmlFor="login-email">邮箱地址</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            disabled={busy !== null}
          />
          <button className="pixel-button primary" type="submit" disabled={busy !== null}>
            {busy === 'email' ? '正在发送…' : '发送登录链接 / 注册'}
          </button>
        </form>
      )}
      {message && <p role="status" className="login-success">{message}</p>}
      {error && <p role="alert" className="login-error">{error}</p>}
    </div>
  )
}
