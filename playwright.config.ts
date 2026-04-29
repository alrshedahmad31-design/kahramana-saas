import { defineConfig } from '@playwright/test'
import * as path from 'path'

// Load .env.test if present (takes precedence over .env.local for E2E runs)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.resolve(__dirname, '.env.test') })

export default defineConfig({
  testDir:  './tests/e2e',
  timeout:  30_000,
  retries:  0,

  // These realtime tests are all API-level (direct Supabase client, no browser needed).
  // The browser project is kept for any future UI-based tests.
  projects: [
    {
      name: 'realtime-api',
      use:  {},   // no browser — tests run in Node context only
    },
    {
      name: 'chromium',
      use:  { browserName: 'chromium', headless: false },
      testMatch: '**/browser-*.spec.ts',
    },
  ],

  reporter: [['list'], ['html', { open: 'never' }]],
})
