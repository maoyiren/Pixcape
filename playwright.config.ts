import { defineConfig, devices } from '@playwright/test'

const nextEnv = {
  ...process.env,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'cdpc-browser-test-secret-not-for-production-0123456789',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://127.0.0.1:3000',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://ci:ci@127.0.0.1:5432/pixcape?schema=public',
}

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [{
    command: 'npm run db:migrate && npm run next:dev -- --port 3000',
    url: 'http://127.0.0.1:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: nextEnv,
  }],
})
