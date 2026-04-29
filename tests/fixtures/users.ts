/**
 * E2E test credentials — loaded from .env.test
 * Copy .env.test.example → .env.test and fill in values before running.
 *
 * Test user matrix:
 *   e2e-owner@test           role: owner          branch: null (global)
 *   e2e-manager@test         role: general_manager branch: null (global)
 *   e2e-branch-mgr@test      role: branch_manager  branch: riffa
 *   e2e-cashier-riffa@test   role: cashier         branch: riffa
 *   e2e-cashier-qallali@test role: cashier         branch: qallali
 *   e2e-driver@test          role: driver          branch: riffa
 */

export const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? ''
export const SUPABASE_ANON        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY     ?? ''
export const BASE_URL             = process.env.E2E_BASE_URL                  ?? 'http://localhost:3000'
export const TEST_PASSWORD        = process.env.E2E_TEST_PASSWORD             ?? 'E2eTest!2026'

export interface TestUser {
  readonly email:    string
  readonly password: string
  readonly role:     string
  readonly branchId: string | null
  readonly name:     string
}

export const TEST_USERS = {
  owner: {
    email:    'e2e-owner@test.kahramana',
    password: TEST_PASSWORD,
    role:     'owner',
    branchId: null,
    name:     'E2E Owner',
  },
  manager: {
    email:    'e2e-manager@test.kahramana',
    password: TEST_PASSWORD,
    role:     'general_manager',
    branchId: null,
    name:     'E2E Manager',
  },
  branchMgr: {
    email:    'e2e-branch-mgr@test.kahramana',
    password: TEST_PASSWORD,
    role:     'branch_manager',
    branchId: 'riffa',
    name:     'E2E Branch Manager',
  },
  cashierRiffa: {
    email:    'e2e-cashier-riffa@test.kahramana',
    password: TEST_PASSWORD,
    role:     'cashier',
    branchId: 'riffa',
    name:     'E2E Cashier Riffa',
  },
  cashierQallali: {
    email:    'e2e-cashier-qallali@test.kahramana',
    password: TEST_PASSWORD,
    role:     'cashier',
    branchId: 'qallali',
    name:     'E2E Cashier Qallali',
  },
  driver: {
    email:    'e2e-driver@test.kahramana',
    password: TEST_PASSWORD,
    role:     'driver',
    branchId: 'riffa',
    name:     'E2E Driver',
  },
} as const satisfies Record<string, TestUser>

export const E2E_CONFIGURED =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON) &&
  Boolean(SUPABASE_SERVICE_KEY)
