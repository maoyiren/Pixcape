import 'server-only'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma-postgresql'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required. CDPC uses PostgreSQL as its only supported database.')
}
if (!/^postgres(ql)?:\/\//i.test(connectionString)) {
  throw new Error('CDPC supports PostgreSQL only. DATABASE_URL must use postgresql:// or postgres://.')
}

type RuntimePrismaClient = PrismaClient
const globalForPrisma = globalThis as unknown as { prisma?: RuntimePrismaClient }

function createPrismaClient(): RuntimePrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
