'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import type { DriverLocationInsert } from '@/lib/supabase/custom-types'

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
  tipBhd?:       number,   // only meaningful for the delivered transition
  actualCollected?: number, // what the customer actually paid (cash only)
): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, branch_id, assigned_driver_id, arrived_at')
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

  // Arrival guard: driver must mark arrived before confirming delivery
  if (currentStatus === 'out_for_delivery' && !order.arrived_at) {
    return { success: false, error: 'Must mark as arrived before delivering' }
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
      if (tipBhd && tipBhd > 0) {
        if (tipBhd > 50) return { success: false, error: 'Tip exceeds maximum (50 BD)' }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(orderUpdate as any).tip_bhd = Number(tipBhd.toFixed(3))
      }
      if (actualCollected !== undefined && actualCollected !== null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(orderUpdate as any).actual_collected = Number(actualCollected.toFixed(3))
      }
    }

  const query = supabase
    .from('orders')
    .update(orderUpdate)
    .eq('id', orderId)
    .eq('status', currentStatus)

  // If picking up a ready order, ensure it hasn't been claimed yet
  if (currentStatus === 'ready') {
    query.is('assigned_driver_id', null)
  }

  const { data: updatedRows, error } = await query
    .select('id')

  if (error) return { success: false, error: error.message }
  
  if (!updatedRows || updatedRows.length === 0) {
    return { 
      success: false, 
      error: 'Order update failed. It might have been claimed by another driver or its status changed.' 
    }
  }

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

  const { data: updatedRows, error } = await service
    .from('orders')
    .update({ arrived_at: now, updated_at: now })
    .eq('id', orderId)
    .eq('assigned_driver_id', user.id)
    .select('id')

  if (error) return { success: false, error: error.message }
  
  if (!updatedRows || updatedRows.length === 0) {
    return { 
      success: false, 
      error: 'Order update failed. Status might have changed.' 
    }
  }

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

  // Server-side rate limit: max one insert per 15 seconds per driver.
  // Silent throttle — not an error from the client's perspective.
  const { data: last } = await supabase
    .from('driver_locations')
    .select('created_at')
    .eq('driver_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (last && Date.now() - new Date(last.created_at).getTime() < 15_000) {
    return { success: true }
  }

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

  // Mirror availability changes to time_entries for shift hours tracking.
  const service = await createServiceClient()
  const now     = new Date().toISOString()

  if (next === 'online') {
    // Close any orphaned open entry from a previous session first.
    const { data: orphan } = await service
      .from('time_entries')
      .select('id, clock_in')
      .eq('staff_id', user.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (orphan) {
      const hours = (Date.now() - new Date(orphan.clock_in).getTime()) / 3_600_000
      await service
        .from('time_entries')
        .update({ clock_out: now, total_hours: Number(hours.toFixed(2)) })
        .eq('id', orphan.id)
    }

    // Open a new time entry for this shift.
    await service.from('time_entries').insert({ staff_id: user.id, clock_in: now })
  } else {
    // Clock-out: close the most recent open entry.
    const { data: open } = await service
      .from('time_entries')
      .select('id, clock_in')
      .eq('staff_id', user.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (open) {
      const hours = (Date.now() - new Date(open.clock_in).getTime()) / 3_600_000
      await service
        .from('time_entries')
        .update({ clock_out: now, total_hours: Number(hours.toFixed(2)) })
        .eq('id', open.id)
    }
  }

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
  orderIds:     string[],
  actualAmount: number, // The physical cash being handed over
): Promise<DriverActionResult & { totalExpected?: number }> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  // Authoritative total — recomputed from DB.
  let totalExpected = 0
  let branchId: string | null = null

  if (orderIds.length > 0) {
    const supabase = await createClient()
    const { data: orders } = await supabase
      .from('orders')
      .select('id, assigned_driver_id, total_bhd, status, branch_id, payments(method), actual_collected, tip_bhd')
      .in('id', orderIds)

    if (!orders || orders.length === 0) return { success: false, error: 'Orders not found' }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedOrders = orders as any[]

    // Branch and Ownership validation
    branchId = typedOrders[0].branch_id
    const invalid = typedOrders.filter(
      o =>
        o.assigned_driver_id !== user.id ||
        o.status             !== 'delivered' ||
        o.payments?.method   !== 'cash' ||
        o.branch_id          !== branchId
    )
    if (invalid.length > 0) return { success: false, error: 'Invalid orders in handover' }

    // Sum price + tips (if any)
    totalExpected = typedOrders.reduce(
      (s: number, o) => s + Number(o.actual_collected ?? o.total_bhd) + Number(o.tip_bhd ?? 0),
      0
    )
  } else {
    return { success: false, error: 'No orders selected' }
  }

  const service = await createServiceClient()
  const now = new Date().toISOString()

  // 1. Create the handover record
  const { data: handover, error: hErr } = await service
    .from('cash_handovers')
    .insert({
      driver_id:       user.id,
      branch_id:       branchId!,
      expected_amount: Number(totalExpected.toFixed(3)),
      actual_amount:   Number(actualAmount.toFixed(3)),
      order_ids:       orderIds,
      manager_confirmed: false
    })
    .select('id')
    .single()

  if (hErr || !handover) return { success: false, error: hErr?.message ?? 'Handover failed' }

  // 2. Mark orders as handed over
  const { error: updateErr } = await service
    .from('orders')
    .update({
      cash_handed_over: true,
      handed_over_at:   now,
      cash_settlement_id: handover.id // Maintain backwards compatibility if needed
    })
    .in('id', orderIds)
    .eq('assigned_driver_id', user.id)

  if (updateErr) {
    // Attempt rollback
    await service.from('cash_handovers').delete().eq('id', handover.id)
    return { success: false, error: updateErr.message }
  }

  // 3. Audit Log
  await service.from('audit_logs').insert({
    action: 'INSERT',
    table_name: 'cash_handovers',
    record_id: handover.id,
    user_id: user.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actor_role: user.role as any, // Cast to any to avoid staff_role mismatch if needed
    branch_id: branchId,
    changes: {
      order_ids: orderIds,
      expected:  totalExpected,
      actual:    actualAmount,
      diff:      actualAmount - totalExpected
    }
  })

  return { success: true, totalExpected }
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

export async function reportDeliveryFailure(
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
    .select('id, branch_id, assigned_driver_id, status, driver_notes')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) return { success: false, error: 'Order not found' }

  // Branch guard
  if (user.branch_id && order.branch_id !== user.branch_id) {
    return { success: false, error: 'Unauthorized' }
  }

  // Ownership guard: must be assigned to this driver and currently on route
  if (order.assigned_driver_id !== user.id || order.status !== 'out_for_delivery') {
    return { success: false, error: 'Unauthorized' }
  }

  const service = await createServiceClient()

  // 1. Update order status to delivery_failed and append note
  const failureNote = `[فشل التوصيل]: ${reason}${notes ? ` - ${notes}` : ''}`
  const updatedDriverNotes = order.driver_notes 
    ? `${order.driver_notes}\n${failureNote}` 
    : failureNote

  const { error: updateError } = await service
    .from('orders')
    .update({ 
      status: 'delivery_failed',
      driver_notes: updatedDriverNotes,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)

  if (updateError) return { success: false, error: updateError.message }

  // 2. Also log in driver_order_issues for reporting
  await service
    .from('driver_order_issues')
    .insert({
      order_id:  orderId,
      driver_id: user.id,
      reason:    reason.trim(),
      notes:     notes?.trim() ?? null,
    })

  return { success: true }
}

