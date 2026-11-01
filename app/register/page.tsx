'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Alert, Button, Container, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'

const registerSchema = z.object({
  name: z.string().trim().max(80, '昵称最多 80 个字符').optional().or(z.literal('')),
  email: z.string().trim().email('请输入有效的邮箱地址').max(254, '邮箱地址过长'),
  password: z.string().min(10, '密码至少需要 10 位字符').max(256, '密码不能超过 256 个字符'),
})

type RegisterValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
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

  return (
    <Container size="sm" py="xl" className="cdpc-register-page">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1.5}>JOIN CDPC</Text>
            <Title order={1} size="h2">创建账户</Title>
          </Stack>
          <Button component={Link} href="/login" variant="default" className="cdpc-control">已有账户？登录</Button>
        </Group>

        <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }} className="cdpc-register-panel">
          <Stack gap="md">
            <Title order={2} size="h3">创建你的 CDPC 账户</Title>
            <Text c="dimmed" lh={1.7}>
              使用可正常收信的邮箱注册，密码至少 10 位。注册后即成为 CDPC 创作者，可直接进入创作工作台，无需申请或切换身份。
            </Text>
            <form className="auth-email-form cdpc-stack" onSubmit={handleSubmit(submit)} noValidate>
              <Stack gap="md">
                <TextInput id="register-name" label="昵称（选填）" className="cdpc-mantine-field" classNames={{ input: 'cdpc-input' }} autoComplete="nickname" maxLength={80} placeholder="你希望显示的名称" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'register-name-error' : undefined} error={errors.name?.message} {...register('name')} />
                <TextInput id="register-email" label="邮箱地址" className="cdpc-mantine-field" classNames={{ input: 'cdpc-input' }} type="email" maxLength={254} required aria-required="true" autoComplete="email" placeholder="name@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'register-email-error' : undefined} error={errors.email?.message} {...register('email')} />
                <PasswordInput id="register-password" label="设置密码" className="cdpc-mantine-field" classNames={{ input: 'cdpc-input' }} maxLength={256} minLength={10} required aria-required="true" autoComplete="new-password" placeholder="至少 10 位字符" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'register-password-error' : undefined} error={errors.password?.message} {...register('password')} />
                {errors.name && <Text id="register-name-error" role="alert" size="sm" c="red">{errors.name.message}</Text>}
                {errors.email && <Text id="register-email-error" role="alert" size="sm" c="red">{errors.email.message}</Text>}
                {errors.password && <Text id="register-password-error" role="alert" size="sm" c="red">{errors.password.message}</Text>}
                <Button className="cdpc-control cdpc-control-primary" disabled={busy} type="submit" loading={busy} fullWidth>
                  {busy ? '正在创建账户…' : '创建账户'}
                </Button>
              </Stack>
            </form>
            {error ? <Alert color="red" variant="light" role="alert" title="创建失败">{error}</Alert> : null}
            {message ? <Alert color="blue" variant="light" role="status" title="账户状态">{message} <Link href="/login">前往登录</Link></Alert> : null}
            <Text size="sm" c="dimmed" lh={1.7}>
              你的创作者身份将在注册时自动开通。作品默认保存在本机；公开发布、商业销售等功能会在对应权限开放后提供。
            </Text>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  )
}
