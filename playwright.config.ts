import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'

// Load .env.test before anything else (takes precedence over .env.local for E2E runs)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.resolve(__dirname, '.env.test') })

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir:  './tests/e2e',
  timeout:  30_000,

  // Auth tests share cookies/sessions — must not run in parallel
  fullyParallel: false,
  workers:       1,

  retries: process.env.CI ? 2 : 0,

  use: {
    baseURL:             BASE_URL,
    screenshot:          'only-on-failure',
    trace:               'on-first-retry',
    video:               'off',
    actionTimeout:       10_000,
    navigationTimeout:   15_000,
  },

  // Start Next.js dev server automatically when running locally
  webServer: {
    command:             'npm run dev',
    url:                 BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout:             120_000,
    stdout:              'pipe',
    stderr:              'pipe',
  },

  globalSetup:    './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  projects: [
    // ── Auth E2E tests (browser required, no parallel) ─────────────────────
    {
      name: 'auth-chromium',
      use:  { ...devices['Desktop Chrome'], headless: false },
      testMatch: '**/e2e/auth/**/*.spec.ts',
    },

    // ── Realtime/RLS tests (API-level, no browser needed) ─────────────────
    {
      name: 'realtime-api',
      use:  {},
      testMatch: '**/e2e/realtime-rls.spec.ts',
    },
  ],
})
