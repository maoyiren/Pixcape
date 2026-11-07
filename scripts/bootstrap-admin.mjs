import { PrismaClient } from '../generated/prisma-postgresql/index.js'
import { PrismaPg } from '@prisma/adapter-pg'

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
if (!email) {
  console.error('Set BOOTSTRAP_ADMIN_EMAIL to the exact existing account email. No changes were made.')
  process.exit(1)
}
const connectionString = process.env.DATABASE_URL
if (!connectionString || !/^postgres(ql)?:\/\//i.test(connectionString)) {
  console.error('DATABASE_URL must be a PostgreSQL connection URL. No changes were made.')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
try {
  const target = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true, status: true } })
  if (!target) {
    console.error('No account exists for that email. Sign in once with the configured OAuth provider, then run this script again.')
    process.exitCode = 1
  } else if (target.status !== 'ACTIVE') {
    console.error('The account is not ACTIVE. Reactivate it through a controlled database operation before bootstrapping.')
    process.exitCode = 1
  } else if (target.role === 'ADMIN') {
    console.log('The selected account is already an administrator. No changes were made.')
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { role: 'ADMIN' } })
      await tx.auditLog.create({ data: {
        actorId: target.id,
        action: 'INITIAL_ADMIN_BOOTSTRAPPED',
        targetType: 'User',
        targetId: target.id,
        details: { email: target.email, method: 'operator-run-script' },
      } })
    })
    console.log('Initial administrator granted and audit log recorded. Remove BOOTSTRAP_ADMIN_EMAIL from the environment now.')
  }
} finally {
  await prisma.$disconnect()
}
