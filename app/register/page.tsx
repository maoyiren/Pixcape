'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
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
    mode: 'onChange',
    reValidateMode: 'onChange',
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
      if (!response.ok) {
        setError(data.error || '暂时无法创建账户，请检查填写信息后重试。')
      } else if (data.requiresVerification) {
        setMessage(data.message || '注册已提交，请查收验证邮件。')
      } else {
        const result = await signIn('email-password', {
          email: values.email.trim(),
          password: values.password,
          redirect: false,
          callbackUrl: '/workbench',
        })
        if (result?.ok) {
          router.push('/workbench')
          router.refresh()
        } else {
          setMessage('账户已创建，请使用邮箱和密码登录。')
        }
      }
    } catch {
      setError('当前无法连接服务，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  return <main className="inventory-shell cdpc-page">
    <header className="topbar cdpc-panel"><div><p className="eyebrow">JOIN CDPC</p><h1>创建账户</h1></div><Link className="pixel-button cdpc-control" href="/login">已有账户？登录</Link></header>
    <section className="hero inventory-panel cdpc-panel">
      <h2>创建你的 CDPC 账户</h2>
      <p>使用可正常收信的邮箱注册。密码需至少包含 10 位字符。注册后即可登录并管理个人资料。</p>
      <form className="auth-email-form cdpc-stack" onSubmit={handleSubmit(submit)}>
        <label htmlFor="register-name">昵称 <span>（选填）</span></label>
        <input id="register-name" className="cdpc-input" autoComplete="nickname" maxLength={80} placeholder="你希望显示的名称" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'register-name-error' : undefined} {...register('name')} />
        {errors.name && <p id="register-name-error" role="alert">{errors.name.message}</p>}
        <label htmlFor="register-email">邮箱地址</label>
        <input id="register-email" className="cdpc-input" type="email" maxLength={254} required aria-required="true" autoComplete="email" placeholder="name@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'register-email-error' : undefined} {...register('email')} />
        {errors.email && <p id="register-email-error" role="alert">{errors.email.message}</p>}
        <label htmlFor="register-password">设置密码</label>
        <input id="register-password" className="cdpc-input" type="password" maxLength={256} minLength={10} required aria-required="true" autoComplete="new-password" placeholder="至少 10 位字符" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'register-password-error' : undefined} {...register('password')} />
        {errors.password && <p id="register-password-error" role="alert">{errors.password.message}</p>}
        <button className="pixel-button primary cdpc-control cdpc-control-primary" disabled={busy} type="submit">{busy ? '正在创建账户…' : '创建账户'}</button>
      </form>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message} <Link href="/login">前往登录</Link></p>}
      <p>注册后即可开始创作，并可在创作者中心完善公开资料。</p>
    </section>
  </main>
}
