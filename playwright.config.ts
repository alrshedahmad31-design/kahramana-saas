import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'https://kahramana.vercel.app',
  },
  workers: 2,
  retries: 1,
})