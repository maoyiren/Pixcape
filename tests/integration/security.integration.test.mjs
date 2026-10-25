import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { PrismaClient } from '../../generated/prisma-postgresql/index.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { projectAccessWhere } from '../../lib/project-access.ts'
import { incrementRateLimitBucket } from '../../lib/login-rate-limit-store.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required for integration tests.')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

test('PostgreSQL migration, RBAC ownership constraints, and atomic rate limiting', async (t) => {
  const suffix = randomUUID()
  const email = (name) => `${name}-${suffix}@pixcape-test.invalid`
  const createdUserIds = []
  const rateKey = `integration-test:${suffix}`

  try {
    const migration = await prisma.$queryRaw`SELECT to_regclass('"User"')::text AS users, to_regclass('"Project"')::text AS projects, to_regclass('"LoginRateLimit"')::text AS rate_limits`
    assert.ok(migration[0].users, 'User table must exist after applying migrations')
    assert.ok(migration[0].projects, 'Project table must exist after applying migrations')
    assert.ok(migration[0].rate_limits, 'LoginRateLimit table must exist after applying migrations')

    const [owner, other, admin, suspended] = await Promise.all([
      prisma.user.create({ data: { email: email('owner'), name: 'Owner' } }),
      prisma.user.create({ data: { email: email('other'), name: 'Other' } }),
      prisma.user.create({ data: { email: email('admin'), name: 'Admin', role: 'ADMIN' } }),
      prisma.user.create({ data: { email: email('suspended'), name: 'Suspended', status: 'SUSPENDED' } }),
    ])
    createdUserIds.push(owner.id, other.id, admin.id, suspended.id)

    const bootstrapTarget = await prisma.user.create({ data: { email: email('bootstrap'), name: 'Bootstrap Admin' } })
    createdUserIds.push(bootstrapTarget.id)
    const bootstrapOutput = execFileSync(process.execPath, ['scripts/bootstrap-admin.mjs'], {
      env: { ...process.env, BOOTSTRAP_ADMIN_EMAIL: bootstrapTarget.email },
      encoding: 'utf8',
    })
    assert.match(bootstrapOutput, /Initial administrator granted/)
    const bootstrapped = await prisma.user.findUnique({ where: { id: bootstrapTarget.id }, select: { role: true } })
    assert.equal(bootstrapped.role, 'ADMIN', 'bootstrap script must grant the role through the Prisma 7 PostgreSQL adapter')

    const profile = await prisma.creatorProfile.create({ data: { userId: owner.id, displayName: 'Test Creator', reviewStatus: 'PENDING' } })
    const reviewResults = await Promise.all([
      prisma.creatorProfile.updateMany({ where: { id: profile.id, reviewStatus: 'PENDING' }, data: { reviewStatus: 'APPROVED' } }),
      prisma.creatorProfile.updateMany({ where: { id: profile.id, reviewStatus: 'PENDING' }, data: { reviewStatus: 'REJECTED' } }),
    ])
    assert.equal(reviewResults.reduce((sum, result) => sum + result.count, 0), 1, 'only one concurrent creator review may win')

    const session = await prisma.session.create({
      data: { sessionToken: `session-${suffix}`, userId: other.id, expires: new Date(Date.now() + 60 * 60 * 1000) },
    })
    await prisma.$transaction(async (tx) => {
      const suspendedResult = await tx.user.updateMany({
        where: { id: other.id, status: 'ACTIVE', role: { not: 'ADMIN' } },
        data: { status: 'SUSPENDED' },
      })
      assert.equal(suspendedResult.count, 1)
      await tx.auditLog.create({
        data: { actorId: admin.id, action: 'USER_SUSPENDED', targetType: 'User', targetId: other.id, details: { test: true } },
      })
      await tx.session.deleteMany({ where: { userId: other.id } })
    })
    assert.equal(await prisma.session.count({ where: { sessionToken: session.sessionToken } }), 0, 'suspension must revoke active sessions')
    const adminProtection = await prisma.user.updateMany({
      where: { id: admin.id, role: { not: 'ADMIN' } },
      data: { status: 'SUSPENDED' },
    })
    assert.equal(adminProtection.count, 0, 'admin accounts must be protected from self-service status changes')

    const project = await prisma.project.create({ data: { ownerId: owner.id, title: 'Owner-only test project' } })
    assert.ok(await prisma.project.findFirst({ where: projectAccessWhere({ id: owner.id, role: owner.role, status: owner.status }, project.id) }))
    assert.equal(await prisma.project.findFirst({ where: projectAccessWhere({ id: other.id, role: other.role, status: other.status }, project.id) }), null)
    assert.ok(await prisma.project.findFirst({ where: projectAccessWhere({ id: admin.id, role: admin.role, status: admin.status }, project.id) }))

    const unauthorizedUpdate = await prisma.project.updateMany({
      where: projectAccessWhere({ id: other.id, role: other.role, status: other.status }, project.id),
      data: { title: 'unauthorized overwrite' },
    })
    assert.equal(unauthorizedUpdate.count, 0, 'non-owner update must affect zero rows')
    const ownerUpdate = await prisma.project.updateMany({
      where: projectAccessWhere({ id: owner.id, role: owner.role, status: owner.status }, project.id),
      data: { title: 'owner update passed' },
    })
    assert.equal(ownerUpdate.count, 1)
    const adminUpdate = await prisma.project.updateMany({
      where: projectAccessWhere({ id: admin.id, role: admin.role, status: admin.status }, project.id),
      data: { title: 'admin update passed' },
    })
    assert.equal(adminUpdate.count, 1)

    const increments = await Promise.all(Array.from({ length: 12 }, () => incrementRateLimitBucket(prisma, rateKey, 900)))
    assert.deepEqual(increments.map((r) => r.count).sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i + 1), 'concurrent requests must increment atomically')
    assert.ok(increments.every((r) => r.retryAfterSeconds > 0 && r.retryAfterSeconds <= 900))

    await prisma.loginRateLimit.update({ where: { key: rateKey }, data: { windowStartedAt: new Date(Date.now() - 60 * 60 * 1000) } })
    const reset = await incrementRateLimitBucket(prisma, rateKey, 900)
    assert.equal(reset.count, 1, 'expired rate-limit windows must reset atomically')

    const applied = await prisma.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE migration_name IN ('20261014150000_init', '20261014153000_login_rate_limit') AND finished_at IS NOT NULL AND rolled_back_at IS NULL`
    assert.equal(applied.length, 2, 'both forward migrations must be recorded as applied')
  } finally {
    await prisma.loginRateLimit.deleteMany({ where: { key: rateKey } })
    if (createdUserIds.length) {
      await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } })
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    }
  }
})

test.after(async () => { await prisma.$disconnect() })
