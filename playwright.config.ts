import { defineConfig } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })

const baseURL = process.env.E2E_BASE_URL ?? 'https://kahramana.vercel.app'
const isLocal = baseURL.includes('localhost') || baseURL.includes('127.0.0.1')

export default defineConfig({
  testDir: './tests',
  globalSetup:    require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  workers: 2,
  retries: 1,
  webServer: isLocal
    ? {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : undefined,
})
