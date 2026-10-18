'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

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
    await tx.user.update({
      where: { id: profile.userId },
      data: { role: approved ? 'CREATOR' : 'USER' },
    })
    await tx.auditLog.create({ data: {
      actorId: actor.id,
      action: approved ? 'CREATOR_APPLICATION_APPROVED' : 'CREATOR_APPLICATION_REJECTED',
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
