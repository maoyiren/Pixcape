import { spawnSync } from 'node:child_process'

const provider = (process.env.DATABASE_PROVIDER || 'postgresql').toLowerCase()
const schemas = {
  postgresql: 'prisma/schema.prisma',
  mysql: 'prisma/schema.mysql.prisma',
  sqlite: 'prisma/schema.sqlite.prisma',
}
const schema = schemas[provider]
if (!schema) {
  console.error(`Unsupported DATABASE_PROVIDER: ${provider}`)
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(command, ['prisma', 'db', 'push', '--schema', schema], { stdio: 'inherit', env: process.env })
if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)
