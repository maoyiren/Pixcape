import { spawnSync } from 'node:child_process'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for PostgreSQL.')
  process.exit(1)
}
if (!/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL)) {
  console.error('CDPC supports PostgreSQL only. DATABASE_URL must use postgresql:// or postgres://.')
  process.exit(1)
}
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(command, ['prisma', 'db', 'push', '--schema', 'prisma/schema.prisma'], {
  stdio: 'inherit',
  env: process.env,
})
if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)
