'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import type { DriverLocationInsert, DriverCashHandoverInsert } from '@/lib/supabase/custom-types'

export type DriverActionResult = { success: true } | { success: false; error: string }

// ── Bump order status (driver flow: ready → out_for_delivery → delivered) ─────
//
// Security checks (in order):
//   1. Authenticated user exists
//   2. Role is exactly 'driver'
//   3. Order exists and current status matches the expected value
//   4. Order.branch_id matches the driver's branch
//   5. For out_for_delivery → delivered: order must be assigned to this driver

export async function driverBumpOrder(
  orderId:       string,
  currentStatus: 'ready' | 'out_for_delivery',
): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, branch_id, assigned_driver_id')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) return { success: false, error: 'Order not found' }

  // Guard against race conditions: client's view of current status must match DB
  if (order.status !== currentStatus) {
    return { success: false, error: 'Unexpected order state' }
  }

  // Branch guard: driver may only act on orders in their own branch
  if (user.branch_id && order.branch_id !== user.branch_id) {
    return { success: false, error: 'Unauthorized' }
  }

  // Ownership guard: when delivering, the order must already be assigned to this driver
  if (currentStatus === 'out_for_delivery' && order.assigned_driver_id !== user.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const nextStatus = currentStatus === 'ready' ? 'out_for_delivery' : 'delivered'
  const now        = new Date().toISOString()

  type OrderUpdate = {
    status:             typeof nextStatus
    updated_at:         string
    assigned_driver_id?: string
    picked_up_at?:      string
    delivered_at?:      string
  }
  const orderUpdate: OrderUpdate = { status: nextStatus, updated_at: now }
  if (currentStatus === 'ready') {
    orderUpdate.assigned_driver_id = user.id
    orderUpdate.picked_up_at       = now
  }
  if (currentStatus === 'out_for_delivery') {
    orderUpdate.delivered_at = now
  }

  const { error } = await supabase
    .from('orders')
    .update(orderUpdate)
    .eq('id', orderId)
    .eq('status', currentStatus)   // optimistic-concurrency guard

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Mark driver arrived at customer location ──────────────────────────────────
// Sets arrived_at without changing order status — used for the intermediate
// "I arrived" step before confirming delivery.

export async function markDriverArrived(orderId: string): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || user.role !== 'driver') return { success: false, error: 'Unauthorized' }

  // Verify the order is in the right state and belongs to this driver
  const supabase = await createClient()
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, assigned_driver_id')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) return { success: false, error: 'Order not found' }
  if (order.status !== 'out_for_delivery') return { success: false, error: 'Unexpected order state' }
  if (order.assigned_driver_id !== user.id) return { success: false, error: 'Unauthorized' }

  // Use service client so RLS edge cases don't silently drop the update
  const service = await createServiceClient()
  const now     = new Date().toISOString()

  const { error } = await service
    .from('orders')
    .update({ arrived_at: now, updated_at: now })
    .eq('id', orderId)
    .eq('assigned_driver_id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Post GPS location update ──────────────────────────────────────────────────
// Role is exactly 'driver'. driver_id is always overwritten server-side so
// a tampered payload cannot spoof another driver's position.

export async function postDriverLocation(
  payload: DriverLocationInsert,
): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('driver_locations')
    .insert({ ...payload, driver_id: user.id })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Toggle driver availability (online ↔ offline) ─────────────────────────────
// Driver self-service check-in / check-out. Persisted to staff_basic.availability_status
// so the dispatch board reflects accurate availability without a page refresh.

export async function toggleDriverAvailability(): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: current, error: fetchErr } = await supabase
    .from('staff_basic')
    .select('availability_status')
    .eq('id', user.id)
    .single()

  if (fetchErr || !current) return { success: false, error: 'Driver record not found' }

  const next = current.availability_status === 'online' ? 'offline' : 'online'

  const { error } = await supabase
    .from('staff_basic')
    .update({ availability_status: next })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Submit end-of-shift cash handover ─────────────────────────────────────────
//
// Security checks:
//   1. Role is exactly 'driver'
//   2. No duplicate handover for this driver + shift date
//   3. Every orderID must be assigned to this driver AND be a cash order
//   4. total_cash is computed server-side from the fetched orders — the client
//      payload is NEVER trusted (prevents tampered totals from DevTools).

export async function submitCashHandover(
  orderIds: string[],
): Promise<DriverActionResult & { totalCash?: number }> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  // Authoritative total — recomputed from DB. Even if client sends garbage,
  // server is the only source of truth.
  let totalCash = 0

  if (orderIds.length > 0) {
    const anon = await createClient()
    const { data: orders } = await anon
      .from('orders')
      .select('id, assigned_driver_id, total_bhd, status, payments(method)')
      .in('id', orderIds)

    // Ensure all requested IDs were actually found
    const fetchedIds = new Set((orders ?? []).map(o => o.id))
    const missing    = orderIds.filter(id => !fetchedIds.has(id))
    if (missing.length > 0) return { success: false, error: 'Invalid order IDs' }

    // Reject any order not owned by this driver, not delivered, or not a cash order.
    // payments is a one-to-one embed so TS infers a single object, not an array.
    const invalid = (orders ?? []).filter(
      o =>
        o.assigned_driver_id !== user.id ||
        o.status             !== 'delivered' ||
        o.payments?.method   !== 'cash',
    )
    if (invalid.length > 0) {
      return { success: false, error: 'Unauthorized orders in handover' }
    }

    // Sum from DB — ignore any totalCash sent by the client.
    totalCash = (orders ?? []).reduce((s, o) => s + Number(o.total_bhd), 0)
  }

  // Use service client for atomicity — bypasses RLS so the link-table insert
  // and the rollback delete both succeed without permission edge cases.
  const service = await createServiceClient()
  const today   = new Date().toISOString().split('T')[0]

  const handover: DriverCashHandoverInsert = {
    driver_id:  user.id,
    shift_date: today,
    total_cash: totalCash,
    order_ids:  orderIds,
  }

  const { data: row, error: hErr } = await service
    .from('driver_cash_handovers')
    .insert(handover)
    .select('id')
    .single()

  if (hErr || !row) return { success: false, error: hErr?.message ?? 'Insert failed' }

  // Link each order to this handover — UNIQUE(order_id) on the link table
  // prevents the same order from appearing in two handovers (23505 error).
  if (orderIds.length > 0) {
    const links = orderIds.map(oid => ({ handover_id: row.id, order_id: oid }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: linkErr } = await (service as any)
      .from('driver_cash_handover_orders')
      .insert(links)

    if (linkErr) {
      // Rollback the parent row so it doesn't appear as an empty phantom handover.
      await service.from('driver_cash_handovers').delete().eq('id', row.id)
      if (linkErr.code === '23505') {
        return { success: false, error: 'Some orders are already settled in another handover' }
      }
      return { success: false, error: linkErr.message }
    }
  }

  return { success: true, totalCash }
}

// ── Submit driver issue report ────────────────────────────────────────────────
//
// Security checks:
//   1. Role is exactly 'driver'
//   2. Order exists and is in the driver's branch
//   3. driver_id is always overwritten server-side — payload cannot spoof another driver
//   4. Reason must be non-empty

export async function submitDriverIssue(
  orderId: string,
  reason:  string,
  notes?:  string,
): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  if (!reason.trim()) {
    return { success: false, error: 'Reason is required' }
  }

  const supabase = await createClient()

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, branch_id, assigned_driver_id, status')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) return { success: false, error: 'Order not found' }

  // Branch guard
  if (user.branch_id && order.branch_id !== user.branch_id) {
    return { success: false, error: 'Unauthorized' }
  }

  // Ownership guard: must be assigned to this driver or be a ready order in their branch
  const isOwnedByDriver = order.assigned_driver_id === user.id
  const isClaimable     = order.status === 'ready'
  if (!isOwnedByDriver && !isClaimable) {
    return { success: false, error: 'Unauthorized' }
  }

  const service = await createServiceClient()

  const { error } = await service
    .from('driver_order_issues')
    .insert({
      order_id:  orderId,
      driver_id: user.id,
      reason:    reason.trim(),
      notes:     notes?.trim() ?? null,
    })

  if (error) return { success: false, error: error.message }
  return { success: true }
}
