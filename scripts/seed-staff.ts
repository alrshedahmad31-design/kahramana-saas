/**
 * scripts/seed-staff.ts — Production staff bootstrap
 *
 * For each STAFF_ROSTER entry:
 *   1. Invite the user via supabase.auth.admin.inviteUserByEmail()
 *      (sends a magic-link signup email through Supabase + Resend).
 *      If the auth user already exists, fetch its id instead.
 *   2. Upsert a staff_basic row with role + branch_id, keyed by the
 *      auth user's UUID.
 *
 * Idempotent — safe to re-run after partial failures.
 *
 * Required env (.env.local OR shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npm run seed:staff           # invite + insert
 *   npm run seed:staff -- --dry  # show what would happen, no writes
 *
 * Pre-reqs (must be true before running):
 *   - Migration 090_extend_staff_role_waiter.sql APPLIED to production.
 *   - types.ts regenerated post-090.
 *   - Real email addresses filled into STAFF_ROSTER below.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import process from 'node:process'

// Load .env.local first, fall back to .env
loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
loadEnv({ path: path.resolve(process.cwd(), '.env') })

// ── Roster ────────────────────────────────────────────────────────────────────
// FILL IN REAL EMAILS BEFORE RUNNING.
// `branch_id` must be 'riffa' | 'qallali' | null (null = no branch scope, e.g. owner/GM/marketing).

type Branch = 'riffa' | 'qallali' | null

type StaffRole =
  | 'owner'
  | 'general_manager'
  | 'branch_manager'
  | 'cashier'
  | 'kitchen'
  | 'waiter'
  | 'driver'
  | 'inventory'
  | 'inventory_manager'
  | 'marketing'
  | 'support'

interface StaffSeed {
  email: string
  name: string
  role: StaffRole
  branch_id: Branch
}

const STAFF_ROSTER: StaffSeed[] = [
  // Branch managers
  { email: 'TODO+bm-riffa@kahramanat.com',     name: 'Branch Manager — Riffa',    role: 'branch_manager',    branch_id: 'riffa'   },
  { email: 'TODO+bm-qallali@kahramanat.com',   name: 'Branch Manager — Qallali',  role: 'branch_manager',    branch_id: 'qallali' },

  // Cashiers
  { email: 'TODO+cash-riffa@kahramanat.com',   name: 'Cashier — Riffa',           role: 'cashier',           branch_id: 'riffa'   },
  { email: 'TODO+cash-qallali@kahramanat.com', name: 'Cashier — Qallali',         role: 'cashier',           branch_id: 'qallali' },

  // Kitchen
  { email: 'TODO+kit-riffa@kahramanat.com',    name: 'Kitchen — Riffa',           role: 'kitchen',           branch_id: 'riffa'   },
  { email: 'TODO+kit-qallali@kahramanat.com',  name: 'Kitchen — Qallali',         role: 'kitchen',           branch_id: 'qallali' },

  // Drivers
  { email: 'TODO+drv-riffa@kahramanat.com',    name: 'Driver — Riffa',            role: 'driver',            branch_id: 'riffa'   },
  { email: 'TODO+drv-qallali@kahramanat.com',  name: 'Driver — Qallali',          role: 'driver',            branch_id: 'qallali' },

  // Waiters (new role — requires migration 090)
  { email: 'TODO+wai-riffa@kahramanat.com',    name: 'Waiter — Riffa',            role: 'waiter',            branch_id: 'riffa'   },
  { email: 'TODO+wai-qallali@kahramanat.com',  name: 'Waiter — Qallali',          role: 'waiter',            branch_id: 'qallali' },

  // Inventory officers (mapped to inventory_manager — full inventory access)
  { email: 'TODO+inv-riffa@kahramanat.com',    name: 'Inventory Officer — Riffa', role: 'inventory_manager', branch_id: 'riffa'   },
  { email: 'TODO+inv-qallali@kahramanat.com',  name: 'Inventory Officer — Qallali', role: 'inventory_manager', branch_id: 'qallali' },

  // Marketing (no branch scope)
  { email: 'TODO+marketing@kahramanat.com',    name: 'Marketing',                 role: 'marketing',         branch_id: null      },
]

// ── Runtime ───────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry') || process.argv.includes('--dry-run')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('[seed-staff] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const placeholderCount = STAFF_ROSTER.filter((s) => s.email.startsWith('TODO')).length
if (placeholderCount > 0 && !DRY_RUN) {
  console.error(`[seed-staff] ${placeholderCount} roster entr${placeholderCount === 1 ? 'y' : 'ies'} still has a TODO email. Fill in real addresses or re-run with --dry.`)
  process.exit(1)
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserIdByEmail(email: string): Promise<string | null> {
  // listUsers paginates; for our scale (≤ 50 staff) one page is fine.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw new Error(`listUsers failed: ${error.message}`)
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  return match?.id ?? null
}

async function inviteOrFindUser(email: string, name: string): Promise<string> {
  const existing = await findUserIdByEmail(email)
  if (existing) return existing

  if (DRY_RUN) return '00000000-0000-0000-0000-000000000000'

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
  })
  if (error || !data.user) throw new Error(`inviteUserByEmail(${email}) failed: ${error?.message ?? 'no user returned'}`)
  return data.user.id
}

async function upsertStaffProfile(s: StaffSeed, userId: string): Promise<'inserted' | 'updated' | 'unchanged'> {
  if (DRY_RUN) return 'inserted'

  const { data: existing, error: selErr } = await supabase
    .from('staff_basic')
    .select('id, name, role, branch_id, is_active')
    .eq('id', userId)
    .maybeSingle()
  if (selErr) throw new Error(`select staff_basic(${userId}) failed: ${selErr.message}`)

  if (!existing) {
    const { error: insErr } = await supabase.from('staff_basic').insert({
      id: userId,
      name: s.name,
      role: s.role,
      branch_id: s.branch_id,
      is_active: true,
    })
    if (insErr) throw new Error(`insert staff_basic(${userId}) failed: ${insErr.message}`)
    return 'inserted'
  }

  const drift =
    existing.name !== s.name ||
    existing.role !== s.role ||
    existing.branch_id !== s.branch_id ||
    existing.is_active !== true
  if (!drift) return 'unchanged'

  const { error: updErr } = await supabase
    .from('staff_basic')
    .update({ name: s.name, role: s.role, branch_id: s.branch_id, is_active: true })
    .eq('id', userId)
  if (updErr) throw new Error(`update staff_basic(${userId}) failed: ${updErr.message}`)
  return 'updated'
}

async function main() {
  console.log(`[seed-staff] ${DRY_RUN ? 'DRY RUN — ' : ''}${STAFF_ROSTER.length} entries`)
  const summary = { invited_or_found: 0, inserted: 0, updated: 0, unchanged: 0, failed: 0 }

  for (const s of STAFF_ROSTER) {
    try {
      const userId = await inviteOrFindUser(s.email, s.name)
      summary.invited_or_found += 1
      const result = await upsertStaffProfile(s, userId)
      summary[result] += 1
      console.log(`  OK ${s.email.padEnd(40)} ${s.role.padEnd(18)} ${(s.branch_id ?? '-').padEnd(8)} -> ${result}${DRY_RUN ? '' : ` (${userId})`}`)
    } catch (err) {
      summary.failed += 1
      console.error(`  X  ${s.email.padEnd(40)} ${s.role.padEnd(18)} -> ${(err as Error).message}`)
    }
  }

  console.log(`\n[seed-staff] done. ${JSON.stringify(summary)}`)
  if (summary.failed > 0) process.exit(2)
}

main().catch((err) => {
  console.error('[seed-staff] fatal:', err)
  process.exit(1)
})
