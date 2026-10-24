'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { createCipheriv, createHash, randomBytes } from 'node:crypto'

async function requireActiveAdmin() {
  const session = await getServerSession(authOptions)
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
  if (!profileId || profileId.length > 128 || !['approve', 'reject'].includes(decision)) redirect('/admin?error=invalid_request')

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
  if (!reviewed) redirect('/admin?error=already_reviewed')
  redirect('/admin?reviewed=1')
}

export async function setUserStatus(formData: FormData) {
  const actor = await requireActiveAdmin()
  const targetId = String(formData.get('userId') ?? '').trim()
  const requestedStatus = String(formData.get('status') ?? '')
  if (!targetId || targetId.length > 128 || !['ACTIVE', 'SUSPENDED'].includes(requestedStatus)) redirect('/admin?error=invalid_request')
  if (targetId === actor.id) redirect('/admin?error=cannot_change_own_status')

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, status: true, role: true } })
  if (!target) redirect('/admin?error=user_not_found')
  if (target.role === 'ADMIN') redirect('/admin?error=admin_status_protected')
  const nextStatus = requestedStatus as 'ACTIVE' | 'SUSPENDED'
  if (target.status === nextStatus) redirect('/admin?notice=no_change')

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
  if (!changed) redirect('/admin?error=concurrent_change')
  redirect('/admin?userUpdated=1')
}


export async function setUserRole(formData: FormData) {
  const actor = await requireActiveAdmin()
  const targetId = String(formData.get('userId') ?? '').trim()
  const requestedRole = String(formData.get('role') ?? '')
  if (!targetId || targetId.length > 128 || !['USER', 'CREATOR'].includes(requestedRole)) {
    redirect('/admin?error=invalid_role_request')
  }
  if (targetId === actor.id) redirect('/admin?error=cannot_change_own_role')

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, status: true },
  })
  if (!target) redirect('/admin?error=user_not_found')
  if (target.role === 'ADMIN') redirect('/admin?error=admin_role_protected')
  if (target.status !== 'ACTIVE') redirect('/admin?error=inactive_user_role')
  const nextRole = requestedRole as 'USER' | 'CREATOR'
  if (target.role === nextRole) redirect('/admin?notice=no_role_change')

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
  if (!changed) redirect('/admin?error=concurrent_change')
  redirect('/admin?roleUpdated=1')
}


export async function setAdminAccess(formData: FormData) {
  const actor = await requireActiveAdmin()
  const targetId = String(formData.get('userId') ?? '').trim()
  const operation = String(formData.get('operation') ?? '')
  if (!targetId || targetId.length > 128 || !['grant', 'revoke'].includes(operation)) {
    redirect('/admin?error=invalid_admin_request')
  }
  if (targetId === actor.id) redirect('/admin?error=cannot_change_own_admin_access')

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, status: true },
  })
  if (!target) redirect('/admin?error=user_not_found')
  if (target.status !== 'ACTIVE') redirect('/admin?error=admin_target_inactive')

  const granting = operation === 'grant'
  if (granting && target.role === 'ADMIN') redirect('/admin?notice=already_admin')
  if (!granting && target.role !== 'ADMIN') redirect('/admin?notice=not_admin')

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

  if (changed === 'last_admin') redirect('/admin?error=cannot_revoke_last_admin')
  if (changed === 'concurrent_change') redirect('/admin?error=concurrent_change')
  redirect('/admin?adminAccessUpdated=1')
}


export async function saveSystemConfiguration(formData: FormData) {
  const actor = await requireActiveAdmin()
  const callbackUrl = String(formData.get('defaultCallbackUrl') ?? '/account').trim()
  if (!callbackUrl.startsWith('/') || callbackUrl.startsWith('//') || callbackUrl.includes('\\\\') || callbackUrl.length > 300) {
    redirect('/admin?error=invalid_default_callback#configuration')
  }
  await prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: 'AUTH_DEFAULT_CALLBACK_URL' },
      update: { value: callbackUrl },
      create: { key: 'AUTH_DEFAULT_CALLBACK_URL', value: callbackUrl },
    })
    await tx.auditLog.create({
      data: { actorId: actor.id, action: 'SYSTEM_CONFIGURATION_UPDATED', targetType: 'AppSetting', targetId: 'AUTH_DEFAULT_CALLBACK_URL', details: { defaultCallbackUrl: callbackUrl } },
    })
  })
  redirect('/admin?systemConfigurationSaved=1#configuration')
}

export async function setEmailVerificationRequired(formData: FormData) {
  const actor = await requireActiveAdmin()
  const value = String(formData.get('required') ?? '')
  if (!['true', 'false'].includes(value)) redirect('/admin?error=invalid_email_verification_setting')
  if (value === 'true' && (!process.env.EMAIL_SERVER || !process.env.EMAIL_FROM || !process.env.NEXTAUTH_URL)) {
    redirect('/admin?error=email_verification_smtp_missing')
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
  redirect('/admin?emailVerificationUpdated=1#configuration')
}


function encryptAISecret(value: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('缺少 AUTH_SECRET / NEXTAUTH_SECRET，无法安全保存 AI 密钥')
  const iv = randomBytes(12)
  const key = createHash('sha256').update(secret).digest()
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export async function saveAIConfiguration(formData: FormData) {
  const actor = await requireActiveAdmin()
  const provider = String(formData.get('provider') ?? 'auto')
  if (!['auto', 'gemini', 'openai', 'openrouter', 'seedream'].includes(provider)) redirect('/admin?error=invalid_ai_provider#configuration')
  const model = String(formData.get('model') ?? '').trim().slice(0, 160)
  const geminiModels = String(formData.get('geminiModels') ?? '').trim().slice(0, 500)
  const openaiModels = String(formData.get('openaiModels') ?? '').trim().slice(0, 500)
  const openrouterModels = String(formData.get('openrouterModels') ?? '').trim().slice(0, 1000)
  const seedreamModels = String(formData.get('seedreamModels') ?? '').trim().slice(0, 500)\n  const deepseekTextModel = String(formData.get('deepseekTextModel') ?? 'deepseek-chat').trim().slice(0, 160)
  const arkBaseUrl = String(formData.get('arkBaseUrl') ?? 'https://ark.cn-beijing.volces.com/api/v3').trim().slice(0, 300)
  try {
    const parsed = new URL(arkBaseUrl)
    if (parsed.protocol !== 'https:' || !/(^|\.)volces\.com$|(^|\.)volcengine\.com$/.test(parsed.hostname)) throw new Error()
  } catch { redirect('/admin?error=invalid_ark_url#configuration') }

  const values: Record<string, string> = {
    AI_DEFAULT_PROVIDER: provider,
    AI_DEFAULT_MODEL: model,
    GEMINI_IMAGE_MODELS: geminiModels,
    OPENAI_IMAGE_MODELS: openaiModels,
    OPENROUTER_IMAGE_MODELS: openrouterModels,
    SEEDREAM_IMAGE_MODELS: seedreamModels,\n    DEEPSEEK_TEXT_MODEL: deepseekTextModel,
    ARK_BASE_URL: arkBaseUrl,
  }
  const secretFields = [
    ['geminiApiKey', 'clearGeminiApiKey', 'AI_SECRET_GEMINI_API_KEY'],
    ['openaiApiKey', 'clearOpenaiApiKey', 'AI_SECRET_OPENAI_API_KEY'],
    ['openrouterApiKey', 'clearOpenrouterApiKey', 'AI_SECRET_OPENROUTER_API_KEY'],
    ['seedreamApiKey', 'clearSeedreamApiKey', 'AI_SECRET_ARK_API_KEY'],\n    ['deepseekApiKey', 'clearDeepseekApiKey', 'AI_SECRET_DEEPSEEK_API_KEY'],
  ] as const
  for (const [field, clearField, settingKey] of secretFields) {
    const value = String(formData.get(field) ?? '').trim()
    if (value.length > 2048) redirect('/admin?error=ai_key_too_long#configuration')
    if (formData.get(clearField) === 'on') values[settingKey] = ''
    else if (value) values[settingKey] = encryptAISecret(value)
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
  redirect('/admin?aiConfigurationSaved=1#configuration')
}
