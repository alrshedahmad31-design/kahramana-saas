// Test user credentials loaded from .env.test
// Copy .env.test.example → .env.test and fill in real Supabase test-user credentials.
// These must be real auth.users entries in the project — do NOT use the service role key.

export const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? ''
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const TEST_USERS = {
  cashier: {
    email:    process.env.E2E_CASHIER_EMAIL    ?? '',
    password: process.env.E2E_CASHIER_PASSWORD ?? '',
    branchId: (process.env.E2E_CASHIER_BRANCH  ?? 'riffa') as 'riffa' | 'qallali',
  },
  owner: {
    email:    process.env.E2E_OWNER_EMAIL    ?? '',
    password: process.env.E2E_OWNER_PASSWORD ?? '',
  },
} as const

export const E2E_CONFIGURED =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON) &&
  Boolean(TEST_USERS.cashier.email) &&
  Boolean(TEST_USERS.cashier.password) &&
  Boolean(TEST_USERS.owner.email) &&
  Boolean(TEST_USERS.owner.password)
