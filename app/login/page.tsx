import Link from 'next/link'
import { Alert, Button, Container, Paper, Stack, Text, Title } from '@mantine/core'
import LoginForm from './login-form'
import { prisma } from '@/lib/prisma'
import { decryptSecretSetting } from '@/lib/secret-settings'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ verification?: string; callbackUrl?: string }> }) {
  const params = await searchParams
  const [configuredDefault, returnToOriginalSetting, oauthRows] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: 'AUTH_DEFAULT_CALLBACK_URL' } }).catch(() => null),
    prisma.appSetting.findUnique({ where: { key: 'AUTH_RETURN_TO_ORIGINAL_PAGE' } }).catch(() => null),
    prisma.appSetting.findMany({ where: { key: { in: [
      'AUTH_OAUTH_GITHUB_CLIENT_ID','AUTH_SECRET_OAUTH_GITHUB_CLIENT_SECRET','AUTH_OAUTH_GITHUB_DISABLED',
      'AUTH_OAUTH_GOOGLE_CLIENT_ID','AUTH_SECRET_OAUTH_GOOGLE_CLIENT_SECRET','AUTH_OAUTH_GOOGLE_DISABLED',
      'AUTH_OAUTH_MICROSOFT_CLIENT_ID','AUTH_SECRET_OAUTH_MICROSOFT_CLIENT_SECRET','AUTH_OAUTH_MICROSOFT_DISABLED',
      'AUTH_OAUTH_APPLE_CLIENT_ID','AUTH_SECRET_OAUTH_APPLE_CLIENT_SECRET','AUTH_OAUTH_APPLE_DISABLED',
      'MAIL_SMTP_HOST','MAIL_FROM','MAIL_SECRET_SMTP_PASSWORD',
    ] } } }).catch(() => []),
  ])
  const safePath = (value: string | undefined) => value && value.startsWith('/') && !value.startsWith('//') && !value.includes(String.fromCharCode(92)) ? value : ''
  const returnToOriginalPage = returnToOriginalSetting?.value !== 'false'
  const defaultCallbackUrl = (returnToOriginalPage ? safePath(params?.callbackUrl) : '') || safePath(configuredDefault?.value) || '/workbench'
  const verificationMessage = params?.verification === 'success' ? '邮箱验证成功，可以继续登录。' : params?.verification === 'expired' ? '这条登录链接已过期，请重新获取。' : params?.verification === 'invalid' ? '这条登录链接无效，请重新获取。' : params?.verification === 'error' ? '暂时无法完成验证，请稍后重试。' : ''
  const oauth = Object.fromEntries(oauthRows.map((row) => [row.key,row.value]))
  const hasProvider = (provider: string, envId: string, envSecret: string) =>
    oauth['AUTH_OAUTH_' + provider + '_DISABLED'] !== 'true' &&
    Boolean((oauth['AUTH_OAUTH_' + provider + '_CLIENT_ID'] || process.env[envId]) &&
      (decryptSecretSetting(oauth['AUTH_SECRET_OAUTH_' + provider + '_CLIENT_SECRET']) || process.env[envSecret]))
  const methods = [
    { id: 'google', label: '使用 Google 账号登录', enabled: hasProvider('GOOGLE','AUTH_GOOGLE_ID','AUTH_GOOGLE_SECRET') },
    { id: 'azure-ad', label: '使用 Microsoft 账号登录', enabled: hasProvider('MICROSOFT','AUTH_MICROSOFT_ENTRA_ID_ID','AUTH_MICROSOFT_ENTRA_ID_SECRET') },
    { id: 'github', label: '使用 GitHub 账号登录', enabled: hasProvider('GITHUB','AUTH_GITHUB_ID','AUTH_GITHUB_SECRET') },
    { id: 'apple', label: '使用 Apple 账号登录', enabled: hasProvider('APPLE','AUTH_APPLE_ID','AUTH_APPLE_SECRET') },
    { id: 'email', label: '通过邮箱链接登录', enabled: Boolean((process.env.EMAIL_SERVER && process.env.EMAIL_FROM) || (oauth['MAIL_SMTP_HOST'] && oauth['MAIL_FROM'] && decryptSecretSetting(oauth['MAIL_SECRET_SMTP_PASSWORD']))) },
  ]
  const enabledMethods = methods.filter((method) => method.enabled)
  const adminEnabled = Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_EMAIL)

  return (
    <Container size="sm" py="xl" className="cdpc-login-page">
      <Stack gap="lg">
        <Stack gap={4}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1.5}>CDPC ACCOUNT</Text>
          <Title order={1} size="h2">登录 / 创建账户</Title>
        </Stack>
        <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }} className="cdpc-login-panel">
          <Stack gap="md">
            <Title order={2} size="h3">一个入口，继续你的创作</Title>
            {verificationMessage ? <Alert color={params?.verification === 'success' ? 'green' : 'yellow'} variant="light" role="status">{verificationMessage}</Alert> : null}
            <Text c="dimmed" lh={1.7}>使用邮箱或用户名与密码登录，也可选择已启用的第三方登录方式。系统会根据账户权限开放相应功能。</Text>
            <LoginForm methods={enabledMethods.map(({ id, label }) => ({ id, label }))} adminEnabled={adminEnabled} defaultCallbackUrl={defaultCallbackUrl} />
            {enabledMethods.length === 0 && !adminEnabled ? <Alert color="yellow" variant="light">暂未启用第三方登录方式。你仍可使用已开通的邮箱与密码登录。</Alert> : null}
            <Text size="sm" className="auth-switch-copy">还没有账户？<Link href="/register">创建账户</Link>。新注册账号默认不会获得管理员权限。</Text>
            <Button component="a" href="/" variant="subtle" color="gray" w="fit-content">返回首页</Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  )
}
