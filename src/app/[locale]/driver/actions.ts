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

  type OrderUpdate = { status: typeof nextStatus; updated_at: string; assigned_driver_id?: string }
  const orderUpdate: OrderUpdate = { status: nextStatus, updated_at: now }
  if (currentStatus === 'ready') orderUpdate.assigned_driver_id = user.id

  const { error } = await supabase
    .from('orders')
    .update(orderUpdate)
    .eq('id', orderId)
    .eq('status', currentStatus)   // optimistic-concurrency guard

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

// ── Submit end-of-shift cash handover ─────────────────────────────────────────
//
// Security checks:
//   1. Role is exactly 'driver'
//   2. No duplicate handover for this driver + shift date
//   3. Every orderID must be assigned to this driver AND be a cash order

export async function submitCashHandover(
  orderIds:  string[],
  totalCash: number,
): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const today    = new Date().toISOString().split('T')[0]

  // Prevent duplicate submission for the same shift date
  const { data: existing } = await supabase
    .from('driver_cash_handovers')
    .select('id')
    .eq('driver_id', user.id)
    .eq('shift_date', today)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'Handover already submitted for today' }
  }

  // Validate that every supplied order is assigned to this driver and is a cash order
  if (orderIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, assigned_driver_id, payments(method)')
      .in('id', orderIds)

    // Ensure all requested IDs were actually found
    const fetchedIds = new Set((orders ?? []).map(o => o.id))
    const missing    = orderIds.filter(id => !fetchedIds.has(id))
    if (missing.length > 0) return { success: false, error: 'Invalid order IDs' }

    // Reject any order not owned by this driver or not a cash order.
    // payments is a one-to-one embed so TS infers a single object, not an array.
    const invalid = (orders ?? []).filter(
      o => o.assigned_driver_id !== user.id || o.payments?.method !== 'cash',
    )
    if (invalid.length > 0) {
      return { success: false, error: 'Unauthorized orders in handover' }
    }
  }

  const handover: DriverCashHandoverInsert = {
    driver_id:  user.id,
    shift_date: today,
    total_cash: totalCash,
    order_ids:  orderIds,
  }

  const { error } = await supabase
    .from('driver_cash_handovers')
    .insert(handover)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
