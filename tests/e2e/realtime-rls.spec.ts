/**
 * NF-5 — Realtime + RLS Integration Tests
 *
 * Tests that Supabase Realtime correctly enforces RLS on the `orders` table.
 * Uses direct Supabase JS clients (anon key + user JWT) — no browser required,
 * no service role key used anywhere.
 *
 * SETUP (required before running):
 *   1. Copy .env.test.example → .env.test
 *   2. Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   3. Fill in E2E_CASHIER_EMAIL/PASSWORD (a real cashier user, branch = riffa)
 *   4. Fill in E2E_OWNER_EMAIL/PASSWORD   (a real owner user)
 *   5. Confirm `orders` table has replication enabled in Supabase Dashboard →
 *      Database → Replication (source: supabase_realtime publication)
 *
 * Run:
 *   npx playwright test tests/e2e/realtime-rls.spec.ts --headed
 */

import { test, expect }              from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database }             from '../../src/lib/supabase/types'
import { SUPABASE_URL, SUPABASE_ANON, TEST_USERS, E2E_CONFIGURED } from '../fixtures/users'

// ── Helpers ────────────────────────────────────────────────────────────────────

async function signIn(email: string, password: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`)
  return client
}

/**
 * Subscribe to postgres_changes on `orders` and count events received.
 * Returns helpers to await the next event (or confirm none arrives within timeoutMs).
 */
function watchOrders(client: SupabaseClient<Database>, channelSuffix: string) {
  let eventCount      = 0
  let lastEventId: string | null = null
  const receivedIds: string[] = []

  const channel = client
    .channel(`test-orders-${channelSuffix}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      (payload) => {
        eventCount++
        const id = (payload.new as { id?: string })?.id
                ?? (payload.old as { id?: string })?.id
                ?? null
        lastEventId = id
        if (id) receivedIds.push(id)
      },
    )
    .subscribe()

  /** Resolves true when ≥1 event arrives within timeoutMs, false on timeout. */
  function waitForEvent(timeoutMs = 6_000): Promise<boolean> {
    const baseline = eventCount
    return new Promise((resolve) => {
      const poll = setInterval(() => {
        if (eventCount > baseline) { clearInterval(poll); resolve(true) }
      }, 50)
      setTimeout(() => { clearInterval(poll); resolve(false) }, timeoutMs)
    })
  }

  /** Waits the full silenceMs and asserts no new events arrived. */
  function waitForSilence(silenceMs = 3_000): Promise<void> {
    const baseline = eventCount
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (eventCount > baseline) {
          reject(new Error(
            `Expected no events but received ${eventCount - baseline} event(s). ` +
            `Order IDs: ${receivedIds.slice(-(eventCount - baseline)).join(', ')}`,
          ))
        } else {
          resolve()
        }
      }, silenceMs)
    })
  }

  function subscribeStatus(): Promise<string> {
    return new Promise((resolve) => {
      const unsub = channel.subscribe((status, err) => {
        if (err) { unsub; resolve(`ERROR: ${err.message}`) }
        if (status === 'SUBSCRIBED') resolve('SUBSCRIBED')
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(status)
      })
    })
  }

  async function cleanup() {
    await client.removeChannel(channel)
    await client.auth.signOut()
  }

  return { waitForEvent, waitForSilence, subscribeStatus, cleanup, getCount: () => eventCount, lastId: () => lastEventId }
}

/** Insert a minimal test order as the given client. Returns the inserted order's id. */
async function insertTestOrder(
  client: SupabaseClient<Database>,
  branchId: string,
): Promise<string> {
  const { data, error } = await client
    .from('orders')
    .insert({
      branch_id:       branchId,
      status:          'new',
      customer_name:   `__E2E_TEST__`,
      customer_phone:  '00000000',
      total_bhd:       0.001,
      source:          'dashboard',
    })
    .select('id')
    .single()

  if (error) throw new Error(`insertTestOrder(${branchId}) failed: ${error.message}`)
  return data.id
}

/** Delete test orders by id using the service client approach — but since we
 *  must not use service role key in tests, we delete via the owner client
 *  (owner has UPDATE permission per RLS; for DELETE we rely on a separate
 *  cleanup policy or use admin Supabase dashboard). */
async function deleteTestOrder(ownerClient: SupabaseClient<Database>, id: string) {
  const { error } = await ownerClient
    .from('orders')
    .delete()
    .eq('id', id)
    .eq('customer_name', '__E2E_TEST__')  // safety guard — only deletes test rows
  if (error) {
    // Non-fatal: deletion may fail if RLS doesn't allow DELETE.
    // Manual cleanup: DELETE FROM orders WHERE customer_name = '__E2E_TEST__';
    console.warn(`cleanup: could not delete test order ${id}: ${error.message}`)
  }
}

// ── Replication pre-check ──────────────────────────────────────────────────────

test.describe('Pre-flight checks', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('owner can authenticate and query orders', async () => {
    const owner = await signIn(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const { data, error } = await owner.from('orders').select('id').limit(1)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    await owner.auth.signOut()
  })

  test('cashier can authenticate and query orders (branch-scoped)', async () => {
    const cashier = await signIn(TEST_USERS.cashierRiffa.email, TEST_USERS.cashierRiffa.password)
    const { data, error } = await cashier.from('orders').select('id, branch_id').limit(50)
    expect(error).toBeNull()
    // Every row the cashier can read must belong to their branch
    for (const row of data ?? []) {
      expect(row.branch_id).toBe(TEST_USERS.cashierRiffa.branchId)
    }
    await cashier.auth.signOut()
  })

  test('cashier realtime channel subscribes successfully', async () => {
    const cashier  = await signIn(TEST_USERS.cashierRiffa.email, TEST_USERS.cashierRiffa.password)
    const watcher  = watchOrders(cashier, 'preflight')
    const status   = await Promise.race([
      watcher.subscribeStatus(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('subscribe timeout')), 8_000)),
    ])

    if (status.startsWith('ERROR') || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      throw new Error(
        `Channel subscription failed: ${status}\n` +
        `➜ Check Supabase Dashboard → Database → Replication → ensure "orders" table ` +
        `is enabled in the supabase_realtime publication.`,
      )
    }

    expect(status).toBe('SUBSCRIBED')
    await watcher.cleanup()
  })
})

// ── Scenario A — Cashier receives events for their own branch ──────────────────

test.describe('Scenario A — Cashier receives events for own branch (riffa)', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  let ownerClient:  SupabaseClient<Database>
  let insertedId: string

  test.beforeAll(async () => {
    ownerClient = await signIn(TEST_USERS.owner.email, TEST_USERS.owner.password)
  })

  test.afterAll(async () => {
    if (insertedId) await deleteTestOrder(ownerClient, insertedId)
    await ownerClient.auth.signOut()
  })

  test('receives INSERT event for own branch and fetchOrders would return the row', async () => {
    const cashier = await signIn(TEST_USERS.cashierRiffa.email, TEST_USERS.cashierRiffa.password)
    const watcher = watchOrders(cashier, 'scenario-a')

    // Wait for channel to connect
    await watcher.subscribeStatus()

    // Owner inserts an order in the cashier's branch
    const eventArrived = watcher.waitForEvent(8_000)
    insertedId = await insertTestOrder(ownerClient, TEST_USERS.cashierRiffa.branchId)

    const got = await eventArrived
    expect(got, 'Cashier should receive a realtime INSERT event for their own branch').toBe(true)

    // Verify RLS SELECT also works: cashier can query the new row
    const { data, error } = await cashier
      .from('orders')
      .select('id, branch_id')
      .eq('id', insertedId)
      .single()
    expect(error).toBeNull()
    expect(data?.branch_id).toBe(TEST_USERS.cashierRiffa.branchId)

    await watcher.cleanup()
  })
})

// ── Scenario B — Cashier does NOT receive events for another branch ────────────

test.describe('Scenario B — Cashier receives NO events for other branch (qallali)', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  const OTHER_BRANCH = TEST_USERS.cashierRiffa.branchId === 'riffa' ? 'qallali' : 'riffa'
  let ownerClient: SupabaseClient<Database>
  let insertedId: string

  test.beforeAll(async () => {
    ownerClient = await signIn(TEST_USERS.owner.email, TEST_USERS.owner.password)
  })

  test.afterAll(async () => {
    if (insertedId) await deleteTestOrder(ownerClient, insertedId)
    await ownerClient.auth.signOut()
  })

  test('no event arrives within 3s after INSERT in other branch', async () => {
    const cashier = await signIn(TEST_USERS.cashierRiffa.email, TEST_USERS.cashierRiffa.password)
    const watcher = watchOrders(cashier, 'scenario-b')

    await watcher.subscribeStatus()

    // Insert order in the OTHER branch
    insertedId = await insertTestOrder(ownerClient, OTHER_BRANCH)

    // Silence window: 3 seconds — no event should arrive
    await expect(watcher.waitForSilence(3_000)).resolves.not.toThrow()

    // Double-confirm: cashier cannot SELECT this row either
    const { data } = await cashier
      .from('orders')
      .select('id')
      .eq('id', insertedId)
    expect(data ?? []).toHaveLength(0)

    await watcher.cleanup()
  })
})

// ── Scenario C — Owner receives events from ALL branches ──────────────────────

test.describe('Scenario C — Owner receives events from all branches', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  let ownerClient:  SupabaseClient<Database>
  let ownerWatcher: ReturnType<typeof watchOrders>
  const insertedIds: string[] = []

  test.beforeAll(async () => {
    ownerClient  = await signIn(TEST_USERS.owner.email, TEST_USERS.owner.password)
    ownerWatcher = watchOrders(ownerClient, 'scenario-c')
    await ownerWatcher.subscribeStatus()
  })

  test.afterAll(async () => {
    for (const id of insertedIds) await deleteTestOrder(ownerClient, id)
    await ownerWatcher.cleanup()
  })

  test('receives event for riffa order', async () => {
    const arrived = ownerWatcher.waitForEvent(8_000)
    const id      = await insertTestOrder(ownerClient, 'riffa')
    insertedIds.push(id)
    expect(await arrived, 'Owner should receive realtime event for riffa order').toBe(true)
  })

  test('receives event for qallali order', async () => {
    const arrived = ownerWatcher.waitForEvent(8_000)
    const id      = await insertTestOrder(ownerClient, 'qallali')
    insertedIds.push(id)
    expect(await arrived, 'Owner should receive realtime event for qallali order').toBe(true)
  })

  test('can SELECT both orders (no RLS restriction)', async () => {
    const { data, error } = await ownerClient
      .from('orders')
      .select('id, branch_id')
      .in('id', insertedIds)
    expect(error).toBeNull()
    const branches = (data ?? []).map(r => r.branch_id)
    expect(branches).toContain('riffa')
    expect(branches).toContain('qallali')
  })
})

// ── Console / WebSocket error detection ───────────────────────────────────────

test.describe('Channel health checks', () => {
  test.skip(!E2E_CONFIGURED, 'E2E env vars not configured — see .env.test.example')

  test('no RLS policy violation on cashier channel subscribe', async () => {
    const cashier = await signIn(TEST_USERS.cashierRiffa.email, TEST_USERS.cashierRiffa.password)
    const errors: string[] = []

    const channel = cashier
      .channel('test-health-cashier')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {})
      .subscribe((status, err) => {
        if (err) errors.push(err.message)
        if (status === 'CHANNEL_ERROR') errors.push(`CHANNEL_ERROR (no detail)`)
      })

    await new Promise(r => setTimeout(r, 5_000))
    await cashier.removeChannel(channel)

    expect(
      errors,
      `RLS or subscription errors detected:\n  ${errors.join('\n  ')}`,
    ).toHaveLength(0)

    await cashier.auth.signOut()
  })

  test('no RLS policy violation on owner channel subscribe', async () => {
    const owner = await signIn(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const errors: string[] = []

    const channel = owner
      .channel('test-health-owner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {})
      .subscribe((status, err) => {
        if (err) errors.push(err.message)
        if (status === 'CHANNEL_ERROR') errors.push(`CHANNEL_ERROR (no detail)`)
      })

    await new Promise(r => setTimeout(r, 5_000))
    await owner.removeChannel(channel)

    expect(
      errors,
      `RLS or subscription errors detected:\n  ${errors.join('\n  ')}`,
    ).toHaveLength(0)

    await owner.auth.signOut()
  })
})
