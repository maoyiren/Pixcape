'use server'

import { getServerSession } from 'next-auth'
import { getAuthOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { encryptSecretSetting, decryptSecretSetting } from '@/lib/secret-settings'
import { adminUrl } from '@/lib/admin-path'

async function requireActiveAdmin() {
  const session = await getServerSession(await getAuthOptions())
  if (!session?.user?.id) redirect('/login')
  // Re-read role/status for every privileged mutation; never trust form data or stale UI state.
  const actor = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, status: true } })
  if (!actor || actor.status !== 'ACTIVE' || actor.role !== 'ADMIN') redirect('/?error=forbidden')
  return actor
}

export async function reviewCreatorApplication(formData: FormData) {
  const actor = await requireActiveAdmin()
  const profileId = String(formData.get('profileId') ?? '').trim()
  const decision = String(formData.get('decision') ?? '')
  if (!profileId || profileId.length > 128 || !['approve', 'reject'].includes(decision)) redirect(adminUrl('/?error=invalid_request'))

  const approved = decision === 'approve'
  const reviewed = await prisma.$transaction(async (tx) => {
    // Conditional update prevents two concurrent admins from both reviewing the same application.
    const changed = await tx.creatorProfile.updateMany({
      where: { id: profileId, reviewStatus: 'PENDING' },
      data: { reviewStatus: approved ? 'APPROVED' : 'REJECTED' },
    })
    if (changed.count !== 1) return false

    const profile = await tx.creatorProfile.findUnique({ where: { id: profileId }, select: { userId: true } })
    if (!profile) throw new Error('Creator profile disappeared during review')
    // Verification review is separate from creator identity. Rejection must never
    // downgrade the account or revoke its ability to create private drafts.
    await tx.auditLog.create({ data: {
      actorId: actor.id,
      action: approved ? 'CREATOR_VERIFICATION_APPROVED' : 'CREATOR_VERIFICATION_REJECTED',
      targetType: 'CreatorProfile',
      targetId: profileId,
      details: { userId: profile.userId },
    } })
    return true
  })
  if (!reviewed) redirect(adminUrl('/?error=already_reviewed'))
  redirect(adminUrl('/?reviewed=1'))
}

export async function setUserStatus(formData: FormData) {
  const actor = await requireActiveAdmin()
  const targetId = String(formData.get('userId') ?? '').trim()
  const requestedStatus = String(formData.get('status') ?? '')
  if (!targetId || targetId.length > 128 || !['ACTIVE', 'SUSPENDED'].includes(requestedStatus)) redirect(adminUrl('/?error=invalid_request'))
  if (targetId === actor.id) redirect(adminUrl('/?error=cannot_change_own_status'))

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, status: true, role: true } })
  if (!target) redirect(adminUrl('/?error=user_not_found'))
  if (target.role === 'ADMIN') redirect(adminUrl('/?error=admin_status_protected'))
  const nextStatus = requestedStatus as 'ACTIVE' | 'SUSPENDED'
  if (target.status === nextStatus) redirect(adminUrl('/?notice=no_change'))

  const changed = await prisma.$transaction(async (tx) => {
    // Include the previously observed state and non-admin role in the write condition to avoid TOCTOU races.
    const result = await tx.user.updateMany({
      where: { id: target.id, status: target.status, role: { not: 'ADMIN' } },
      data: { status: nextStatus },
    })
    if (result.count !== 1) return false

    await tx.auditLog.create({ data: {
      actorId: actor.id,
      action: nextStatus === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      targetType: 'User',
      targetId: target.id,
      details: { previousStatus: target.status, nextStatus },
    } })
    if (nextStatus === 'SUSPENDED') {
      // Invalidate existing database sessions immediately when an account is suspended.
      await tx.session.deleteMany({ where: { userId: target.id } })
    }
    return true
  })
  if (!changed) redirect(adminUrl('/?error=concurrent_change'))
  redirect(adminUrl('/?userUpdated=1'))
}


export async function setUserRole(formData: FormData) {
  const actor = await requireActiveAdmin()
  const targetId = String(formData.get('userId') ?? '').trim()
  const requestedRole = String(formData.get('role') ?? '')
  if (!targetId || targetId.length > 128 || !['USER', 'CREATOR'].includes(requestedRole)) {
    redirect(adminUrl('/?error=invalid_role_request'))
  }
  if (targetId === actor.id) redirect(adminUrl('/?error=cannot_change_own_role'))

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, status: true },
  })
  if (!target) redirect(adminUrl('/?error=user_not_found'))
  if (target.role === 'ADMIN') redirect(adminUrl('/?error=admin_role_protected'))
  if (target.status !== 'ACTIVE') redirect(adminUrl('/?error=inactive_user_role'))
  const nextRole = requestedRole as 'USER' | 'CREATOR'
  if (target.role === nextRole) redirect(adminUrl('/?notice=no_role_change'))

  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id: target.id, role: target.role, status: 'ACTIVE' },
      data: { role: nextRole },
    })
    if (result.count !== 1) return false
    await tx.auditLog.create({ data: {
      actorId: actor.id,
      action: 'USER_ROLE_CHANGED',
      targetType: 'User',
      targetId: target.id,
      details: { previousRole: target.role, nextRole },
    } })
    return true
  })
  if (!changed) redirect(adminUrl('/?error=concurrent_change'))
  redirect(adminUrl('/?roleUpdated=1'))
}


export async function setAdminAccess(formData: FormData) {
  const actor = await requireActiveAdmin()
  const targetId = String(formData.get('userId') ?? '').trim()
  const operation = String(formData.get('operation') ?? '')
  if (!targetId || targetId.length > 128 || !['grant', 'revoke'].includes(operation)) {
    redirect(adminUrl('/?error=invalid_admin_request'))
  }
  if (targetId === actor.id) redirect(adminUrl('/?error=cannot_change_own_admin_access'))

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, status: true },
  })
  if (!target) redirect(adminUrl('/?error=user_not_found'))
  if (target.status !== 'ACTIVE') redirect(adminUrl('/?error=admin_target_inactive'))

  const granting = operation === 'grant'
  if (granting && target.role === 'ADMIN') redirect(adminUrl('/?notice=already_admin'))
  if (!granting && target.role !== 'ADMIN') redirect(adminUrl('/?notice=not_admin'))

  const changed = await prisma.$transaction(async (tx) => {
    // Re-check the last-admin invariant inside the transaction before demotion.
    if (!granting) {
      const activeAdmins = await tx.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } })
      if (activeAdmins <= 1) return 'last_admin' as const
    }

    let nextRole: 'ADMIN' | 'USER' | 'CREATOR' = 'ADMIN'
    if (!granting) {
      // Restore the role that was present before the most recent admin grant when available.
      const priorGrant = await tx.auditLog.findFirst({
        where: { targetType: 'User', targetId: target.id, action: 'ADMIN_ACCESS_GRANTED' },
        orderBy: { createdAt: 'desc' },
        select: { details: true },
      })
      const details = priorGrant?.details as { previousRole?: string } | null
      nextRole = details?.previousRole === 'CREATOR' ? 'CREATOR' : 'USER'
    }

    const result = await tx.user.updateMany({
      where: { id: target.id, role: target.role, status: 'ACTIVE' },
      data: { role: nextRole },
    })
    if (result.count !== 1) return 'concurrent_change' as const

    await tx.auditLog.create({ data: {
      actorId: actor.id,
      action: granting ? 'ADMIN_ACCESS_GRANTED' : 'ADMIN_ACCESS_REVOKED',
      targetType: 'User',
      targetId: target.id,
      details: { previousRole: target.role, nextRole },
    } })
    return 'changed' as const
  })

  if (changed === 'last_admin') redirect(adminUrl('/?error=cannot_revoke_last_admin'))
  if (changed === 'concurrent_change') redirect(adminUrl('/?error=concurrent_change'))
  redirect(adminUrl('/?adminAccessUpdated=1'))
}


export async function saveSystemConfiguration(formData: FormData) {
  const actor = await requireActiveAdmin()
  const callbackUrl = String(formData.get('defaultCallbackUrl') ?? '/workbench').trim()
  const returnToOriginalPage = String(formData.get('returnToOriginalPage') ?? 'true')
  if (!['true', 'false'].includes(returnToOriginalPage)) redirect(adminUrl('/auth?error=invalid_return_behavior'))
  if (!callbackUrl.startsWith('/') || callbackUrl.startsWith('//') || callbackUrl.includes(String.fromCharCode(92)) || callbackUrl.length > 300) {
    redirect(adminUrl('/auth?error=invalid_default_callback'))
  }
  await prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: 'AUTH_DEFAULT_CALLBACK_URL' },
      update: { value: callbackUrl },
      create: { key: 'AUTH_DEFAULT_CALLBACK_URL', value: callbackUrl },
    })
    await tx.appSetting.upsert({
      where: { key: 'AUTH_RETURN_TO_ORIGINAL_PAGE' },
      update: { value: returnToOriginalPage },
      create: { key: 'AUTH_RETURN_TO_ORIGINAL_PAGE', value: returnToOriginalPage },
    })
    await tx.auditLog.create({
      data: { actorId: actor.id, action: 'SYSTEM_CONFIGURATION_UPDATED', targetType: 'AppSetting', targetId: 'AUTH_LOGIN_REDIRECT', details: { defaultCallbackUrl: callbackUrl, returnToOriginalPage: returnToOriginalPage === 'true' } },
    })
  })
  redirect(adminUrl('/auth?systemConfigurationSaved=1'))
}

export async function setEmailVerificationRequired(formData: FormData) {
  const actor = await requireActiveAdmin()
  const value = String(formData.get('required') ?? '')
  if (!['true', 'false'].includes(value)) redirect(adminUrl('/auth?error=invalid_email_verification_setting'))
  const smtpSettings = await prisma.appSetting.findMany({
    where: { key: { in: ['MAIL_SMTP_HOST','MAIL_FROM','MAIL_SECRET_SMTP_PASSWORD'] } },
    select: { key: true, value: true },
  })
  const smtp = Object.fromEntries(smtpSettings.map((item) => [item.key,item.value]))
  const smtpReady = Boolean((smtp.MAIL_SMTP_HOST && smtp.MAIL_FROM && decryptSecretSetting(smtp.MAIL_SECRET_SMTP_PASSWORD)) || (process.env.EMAIL_SERVER && process.env.EMAIL_FROM))
  if (value === 'true' && (!smtpReady || !process.env.NEXTAUTH_URL)) {
    redirect(adminUrl('/auth?error=email_verification_smtp_missing'))
  }
  await prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: 'EMAIL_VERIFICATION_REQUIRED' },
      update: { value },
      create: { key: 'EMAIL_VERIFICATION_REQUIRED', value },
    })
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'EMAIL_VERIFICATION_SETTING_CHANGED',
        targetType: 'AppSetting',
        targetId: 'EMAIL_VERIFICATION_REQUIRED',
        details: { required: value === 'true' },
      },
    })
  })
  redirect(adminUrl('/auth?emailVerificationUpdated=1'))
}


export async function saveAIConfiguration(formData: FormData) {
  const actor = await requireActiveAdmin()
  const provider = String(formData.get('provider') ?? 'auto')
  if (!['auto', 'gemini', 'openai', 'openrouter', 'seedream'].includes(provider)) redirect(adminUrl('/ai?error=invalid_ai_provider'))
  const model = String(formData.get('model') ?? '').trim().slice(0, 160)
  const geminiModels = String(formData.get('geminiModels') ?? '').trim().slice(0, 500)
  const openaiModels = String(formData.get('openaiModels') ?? '').trim().slice(0, 500)
  const openrouterModels = String(formData.get('openrouterModels') ?? '').trim().slice(0, 1000)
  const seedreamModels = String(formData.get('seedreamModels') ?? '').trim().slice(0, 500)
  const deepseekTextModel = String(formData.get('deepseekTextModel') ?? 'deepseek-chat').trim().slice(0, 160)
  const arkBaseUrl = String(formData.get('arkBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3').trim().slice(0, 300)
  try {
    const parsed = new URL(arkBaseUrl)
    if (parsed.protocol !== 'https:' || !/(^|\.)volces\.com$|(^|\.)volcengine\.com$/.test(parsed.hostname)) throw new Error()
  } catch { redirect(adminUrl('/ai?error=invalid_ark_url')) }

  const values: Record<string, string> = {
    AI_DEFAULT_PROVIDER: provider,
    AI_DEFAULT_MODEL: model,
    GEMINI_IMAGE_MODELS: geminiModels,
    OPENAI_IMAGE_MODELS: openaiModels,
    OPENROUTER_IMAGE_MODELS: openrouterModels,
    SEEDREAM_IMAGE_MODELS: seedreamModels,
    DEEPSEEK_TEXT_MODEL: deepseekTextModel,
    ARK_BASE_URL: arkBaseUrl,
  }
  const secretFields = [
    ['geminiApiKey', 'clearGeminiApiKey', 'AI_SECRET_GEMINI_API_KEY'],
    ['openaiApiKey', 'clearOpenaiApiKey', 'AI_SECRET_OPENAI_API_KEY'],
    ['openrouterApiKey', 'clearOpenrouterApiKey', 'AI_SECRET_OPENROUTER_API_KEY'],
    ['seedreamApiKey', 'clearSeedreamApiKey', 'AI_SECRET_ARK_API_KEY'],
    ['deepseekApiKey', 'clearDeepseekApiKey', 'AI_SECRET_DEEPSEEK_API_KEY'],
  ] as const
  for (const [field, clearField, settingKey] of secretFields) {
    const value = String(formData.get(field) ?? '').trim()
    if (value.length > 2048) redirect(adminUrl('/ai?error=ai_key_too_long'))
    if (formData.get(clearField) === 'on') values[settingKey] = ''
    else if (value) values[settingKey] = encryptSecretSetting(value)
  }
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      await tx.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    }
    for (const [field, clearField, settingKey] of secretFields) {
      if (formData.get(clearField) === 'on' || String(formData.get(field) ?? '').trim()) {
        await tx.auditLog.create({ data: {
          actorId: actor.id, action: 'AI_CONFIGURATION_SECRET_CHANGED',
          targetType: 'AppSetting', targetId: settingKey,
          details: { cleared: formData.get(clearField) === 'on', changed: formData.get(clearField) === 'on' || Boolean(String(formData.get(field) ?? '').trim()) },
        } })
      }
    }
    await tx.auditLog.create({ data: {
      actorId: actor.id, action: 'AI_CONFIGURATION_UPDATED', targetType: 'AppSetting', targetId: 'AI_DEFAULT_PROVIDER',
      details: { provider, model, configuredModelLists: ['gemini', 'openai', 'openrouter', 'seedream', 'deepseek-text'] },
    } })
  })
  redirect(adminUrl('/ai?aiConfigurationSaved=1'))
}


function parseSecretField(formData: FormData, field: string, clearField: string, key: string, values: Record<string, string>) {
  const value = String(formData.get(field) ?? '').trim()
  if (value.length > 2048) redirect(adminUrl('/?error=secret_too_long'))
  if (formData.get(clearField) === 'on') values[key] = ''
  else if (value) values[key] = encryptSecretSetting(value)
}

async function saveModuleSettings(actorId: string, action: string, target: string, values: Record<string, string>) {
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      await tx.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    }
    await tx.auditLog.create({
      data: { actorId, action, targetType: 'AppSetting', targetId: target, details: { updatedKeys: Object.keys(values) } },
    })
  })
}

export async function saveMailConfiguration(formData: FormData) {
  const actor = await requireActiveAdmin()
  const host = String(formData.get('smtpHost') ?? '').trim().slice(0, 255)
  const port = String(formData.get('smtpPort') ?? '587').trim()
  const user = String(formData.get('smtpUser') ?? '').trim().slice(0, 255)
  const from = String(formData.get('mailFrom') ?? '').trim().slice(0, 255)
  const secure = String(formData.get('smtpSecure') ?? 'false')
  if (!/^[a-zA-Z0-9.-]+$/.test(host) || !/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535 || !['true','false'].includes(secure) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
    redirect(adminUrl('/mail?error=invalid_mail_config'))
  }
  const values: Record<string,string> = {
    MAIL_SMTP_HOST: host, MAIL_SMTP_PORT: port, MAIL_SMTP_USER: user,
    MAIL_FROM: from, MAIL_SMTP_SECURE: secure,
  }
  parseSecretField(formData,'smtpPassword','clearSmtpPassword','MAIL_SECRET_SMTP_PASSWORD',values)
  await saveModuleSettings(actor.id,'MAIL_CONFIGURATION_UPDATED','MAIL_SMTP',values)
  redirect(adminUrl('/mail?saved=1'))
}

export async function saveStorageConfiguration(formData: FormData) {
  const actor = await requireActiveAdmin()
  const endpoint = String(formData.get('endpoint') ?? '').trim().slice(0,300)
  const bucket = String(formData.get('bucket') ?? '').trim().slice(0,128)
  const region = String(formData.get('region') ?? '').trim().slice(0,128)
  const publicBaseUrl = String(formData.get('publicBaseUrl') ?? '').trim().slice(0,300)
  try {
    if (endpoint) { const url = new URL(endpoint); if (url.protocol !== 'https:') throw new Error() }
    if (publicBaseUrl) { const url = new URL(publicBaseUrl); if (url.protocol !== 'https:') throw new Error() }
  } catch { redirect(adminUrl('/storage?error=invalid_storage_url')) }
  if (!bucket || !/^[a-zA-Z0-9._-]{3,128}$/.test(bucket)) redirect(adminUrl('/storage?error=invalid_bucket'))
  const values: Record<string,string> = { STORAGE_S3_ENDPOINT:endpoint, STORAGE_S3_BUCKET:bucket, STORAGE_S3_REGION:region, STORAGE_PUBLIC_BASE_URL:publicBaseUrl }
  parseSecretField(formData,'accessKeyId','clearAccessKeyId','STORAGE_SECRET_ACCESS_KEY_ID',values)
  parseSecretField(formData,'secretAccessKey','clearSecretAccessKey','STORAGE_SECRET_ACCESS_KEY',values)
  await saveModuleSettings(actor.id,'STORAGE_CONFIGURATION_UPDATED','STORAGE_S3',values)
  redirect(adminUrl('/storage?saved=1'))
}

export async function saveIntegrationConfiguration(formData: FormData) {
  const actor = await requireActiveAdmin()
  const name = String(formData.get('integrationName') ?? '').trim().slice(0,80)
  const webhookUrl = String(formData.get('webhookUrl') ?? '').trim().slice(0,300)
  if (!name) redirect(adminUrl('/integrations?error=invalid_name'))
  try { const url = new URL(webhookUrl); if (url.protocol !== 'https:') throw new Error() }
  catch { redirect(adminUrl('/integrations?error=invalid_webhook')) }
  const values: Record<string,string> = { PLATFORM_INTEGRATION_NAME:name, PLATFORM_WEBHOOK_URL:encryptSecretSetting(webhookUrl) }
  parseSecretField(formData,'webhookSecret','clearWebhookSecret','PLATFORM_SECRET_WEBHOOK_TOKEN',values)
  await saveModuleSettings(actor.id,'PLATFORM_INTEGRATION_UPDATED','PLATFORM_WEBHOOK',values)
  redirect(adminUrl('/integrations?saved=1'))
}

export async function saveSecurityConfiguration(formData: FormData) {
  const actor = await requireActiveAdmin()
  const limit = String(formData.get('loginRateLimitMax') ?? '')
  const windowSeconds = String(formData.get('loginRateLimitWindowSeconds') ?? '')
  if (!/^\d{1,3}$/.test(limit) || Number(limit) < 5 || Number(limit) > 100 || !/^\d{1,6}$/.test(windowSeconds) || Number(windowSeconds) < 60 || Number(windowSeconds) > 86400) {
    redirect(adminUrl('/security?error=invalid_limits'))
  }
  const values = { SECURITY_LOGIN_RATE_LIMIT_MAX:limit, SECURITY_LOGIN_RATE_LIMIT_WINDOW_SECONDS:windowSeconds }
  await saveModuleSettings(actor.id,'SECURITY_CONFIGURATION_UPDATED','LOGIN_RATE_LIMIT',values)
  redirect(adminUrl('/security?saved=1'))
}

export async function saveOAuthConfiguration(formData: FormData) {
  const actor = await requireActiveAdmin()
  const provider = String(formData.get('provider') ?? '').toUpperCase()
  const providers = ['GITHUB','GOOGLE','MICROSOFT','APPLE']
  if (!providers.includes(provider)) redirect(adminUrl('/auth?error=invalid_oauth_provider'))
  const enabled = formData.get('enabled') === 'on'
  const clientId = String(formData.get('clientId') ?? '').trim().slice(0, 512)
  const clientSecret = String(formData.get('clientSecret') ?? '').trim()
  const tenantId = String(formData.get('tenantId') ?? 'common').trim().slice(0, 128)
  if (clientSecret.length > 2048) redirect(adminUrl('/auth?error=oauth_secret_too_long'))
  const idKey = 'AUTH_OAUTH_' + provider + '_CLIENT_ID'
  const secretKey = 'AUTH_SECRET_OAUTH_' + provider + '_CLIENT_SECRET'
  const disabledKey = 'AUTH_OAUTH_' + provider + '_DISABLED'
  if (enabled && !clientId) redirect(adminUrl('/auth?error=oauth_client_id_required'))
  const existingSecret = await prisma.appSetting.findUnique({ where: { key: secretKey }, select: { value: true } })
  const clearClientSecret = formData.get('clearClientSecret') === 'on'
  if (enabled && !clientSecret && (clearClientSecret || !decryptSecretSetting(existingSecret?.value)) && !(provider === 'GITHUB' ? process.env.AUTH_GITHUB_SECRET : provider === 'GOOGLE' ? process.env.AUTH_GOOGLE_SECRET : provider === 'MICROSOFT' ? process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET : process.env.AUTH_APPLE_SECRET)) {
    redirect(adminUrl('/auth?error=oauth_secret_required'))
  }
  const values: Record<string,string> = { [disabledKey]: enabled ? 'false' : 'true' }
  if (clientId) values[idKey] = clientId
  if (clientSecret) values[secretKey] = encryptSecretSetting(clientSecret)
  else if (clearClientSecret) values[secretKey] = ''
  if (provider === 'MICROSOFT') values.AUTH_OAUTH_MICROSOFT_TENANT_ID = tenantId || 'common'
  await saveModuleSettings(actor.id,'OAUTH_PROVIDER_CONFIGURATION_UPDATED','OAuth:' + provider,values)
  redirect(adminUrl('/auth?oauthSaved=' + provider.toLowerCase()))
}
