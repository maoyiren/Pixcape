'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().trim().max(80, '昵称最多 80 个字符').optional().or(z.literal('')),
  email: z.string().trim().email('请输入有效的邮箱地址').max(254, '邮箱地址过长'),
  password: z.string().min(10, '密码至少需要 10 位字符').max(256, '密码不能超过 256 个字符'),
})

type RegisterValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
    mode: 'onBlur',
  })

  async function submit(values: RegisterValues) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name?.trim() || undefined,
          email: values.email.trim(),
          password: values.password,
        }),
      })
      const data = await response.json()
      if (!response.ok) setError(data.error || '暂时无法创建账户，请检查填写内容后重试。')
      else setMessage(data.message || '账户已创建，可以前往登录。')
    } catch {
      setError('暂时无法连接服务，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  return <main className="inventory-shell">
    <header className="topbar"><div><p className="eyebrow">JOIN CDPC</p><h1>创建账户</h1></div><Link className="pixel-button" href="/login">已有账户？登录</Link></header>
    <section className="hero inventory-panel">
      <h2>创建你的 CDPC 账户</h2>
      <p>用你长期可以访问的邮箱注册。账户可用于管理个人资料与创作者申请；密码至少需要 10 位。</p>
      <form className="auth-email-form" onSubmit={handleSubmit(submit)} noValidate>
        <label htmlFor="register-name">昵称 <span>（选填）</span></label>
        <input id="register-name" autoComplete="nickname" maxLength={80} placeholder="你希望显示的名称" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'register-name-error' : undefined} {...register('name')} />
        {errors.name && <p id="register-name-error" role="alert">{errors.name.message}</p>}
        <label htmlFor="register-email">邮箱地址</label>
        <input id="register-email" type="email" maxLength={254} required autoComplete="email" placeholder="name@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'register-email-error' : undefined} {...register('email')} />
        {errors.email && <p id="register-email-error" role="alert">{errors.email.message}</p>}
        <label htmlFor="register-password">设置密码</label>
        <input id="register-password" type="password" minLength={10} maxLength={256} required autoComplete="new-password" placeholder="至少 10 位字符" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'register-password-error' : undefined} {...register('password')} />
        {errors.password && <p id="register-password-error" role="alert">{errors.password.message}</p>}
        <button className="pixel-button primary" disabled={busy} type="submit">{busy ? '正在创建账户…' : '创建账户'}</button>
      </form>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message} <Link href="/login">前往登录</Link></p>}
      <p>注册后默认是普通账户。创作者身份需审核，管理员权限由管理员单独授予。</p>
    </section>
  </main>
}
