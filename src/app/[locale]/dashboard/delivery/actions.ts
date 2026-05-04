'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

const MANAGER_ROLES = new Set(['owner', 'general_manager', 'branch_manager'])
const GLOBAL_ADMIN_ROLES = new Set(['owner', 'general_manager'])

export type DispatchActionResult = { success: true } | { success: false; error: string }

// ── Assign a driver to a ready order ─────────────────────────────────────────
//
// Security checks (in order):
//   1. Caller is authenticated and has a manager role
//   2. Order exists and is currently 'ready' (no double-dispatch races)
//   3. Order belongs to caller's branch (unless caller is global admin)
//   4. Driver exists, role='driver', is_active=true
//   5. Driver belongs to the same branch as the order
//   6. Optimistic-concurrency guard: only updates rows where status is still 'ready'
//
// On success, transitions order to 'out_for_delivery', records picked_up_at,
// and writes an audit log entry.

export async function assignDriverToOrder(
  orderId:  string,
  driverId: string,
): Promise<DispatchActionResult> {
  const caller = await getSession()
  if (!caller || !caller.role || !MANAGER_ROLES.has(caller.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  // 1. Fetch the order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, status, branch_id, assigned_driver_id')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    return { success: false, error: 'Order not found' }
  }

  if (order.status !== 'ready') {
    return { success: false, error: 'Order is not ready for dispatch' }
  }

  // Branch scope: only owner/GM can dispatch across branches
  if (!GLOBAL_ADMIN_ROLES.has(caller.role) && caller.branch_id !== order.branch_id) {
    return { success: false, error: 'Unauthorized' }
  }

  // 2. Fetch the driver
  const { data: driver, error: driverErr } = await supabase
    .from('staff_basic')
    .select('id, role, is_active, branch_id')
    .eq('id', driverId)
    .single()

  if (driverErr || !driver) {
    return { success: false, error: 'Driver not found' }
  }

  if (driver.role !== 'driver' || !driver.is_active) {
    return { success: false, error: 'Invalid driver' }
  }

  // Driver must serve the same branch as the order
  if (driver.branch_id !== null && driver.branch_id !== order.branch_id) {
    return { success: false, error: 'Driver does not serve this branch' }
  }

  // 3. Update via service client (bypass RLS edge cases) with optimistic guard
  const service = await createServiceClient()
  const now     = new Date().toISOString()

  const { error: updateErr, data: updated } = await service
    .from('orders')
    .update({
      assigned_driver_id: driverId,
      status:             'out_for_delivery',
      picked_up_at:       now,
      updated_at:         now,
    })
    .eq('id', orderId)
    .eq('status', 'ready')   // optimistic concurrency
    .select('id')
    .maybeSingle()

  if (updateErr) {
    return { success: false, error: updateErr.message }
  }

  if (!updated) {
    // Race lost — another dispatcher beat us to it
    return { success: false, error: 'Order is no longer available for dispatch' }
  }

  // 4. Audit log (best-effort; do not fail the dispatch if logging fails)
  await service.from('audit_logs').insert({
    table_name: 'orders',
    action:     'UPDATE',
    user_id:    caller.id,
    record_id:  orderId,
    changes:    {
      operation:          'dispatch',
      assigned_driver_id: driverId,
      status:             'out_for_delivery',
    },
    branch_id:  order.branch_id,
    actor_role: caller.role,
  })

  return { success: true }
}

// ── Driver self-assign a ready order ──────────────────────────────────────────
//
// Any active driver can claim an unassigned 'ready' order in their branch.
// Sets: assigned_driver_id = caller, status = out_for_delivery, picked_up_at = now.
// Optimistic-concurrency guard prevents two drivers from claiming the same order.

export async function assignSelfAsDriver(
  orderId: string,
): Promise<DispatchActionResult> {
  const caller = await getSession()
  if (!caller || caller.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  const service = await createServiceClient()
  const now     = new Date().toISOString()

  const { error: updateErr, data: updated } = await service
    .from('orders')
    .update({
      assigned_driver_id: caller.id,
      status:             'out_for_delivery',
      picked_up_at:       now,
      updated_at:         now,
    })
    .eq('id', orderId)
    .eq('status', 'ready')
    .is('assigned_driver_id', null)
    .select('id')
    .maybeSingle()

  if (updateErr) return { success: false, error: updateErr.message }
  if (!updated)  return { success: false, error: 'Order is no longer available' }

  return { success: true }
}

// ── Driver marks own order delivered (no manager gate) ────────────────────────
//
// Security:
//   1. Caller must be role='driver'
//   2. Order must be assigned to this driver
//   3. Driver must have previously marked arrival (arrived_at must be set)
//   4. Status must still be 'out_for_delivery' (optimistic guard)

export async function markOrderDelivered(
  orderId: string,
): Promise<DispatchActionResult> {
  const caller = await getSession()
  if (!caller || caller.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  const service = await createServiceClient()

  const { data: order, error: fetchErr } = await service
    .from('orders')
    .select('id, status, assigned_driver_id, arrived_at')
    .eq('id', orderId)
    .single()

  if (fetchErr || !order)                            return { success: false, error: 'Order not found' }
  if (order.assigned_driver_id !== caller.id)        return { success: false, error: 'Unauthorized' }
  if (order.status !== 'out_for_delivery')           return { success: false, error: 'Unexpected order state' }
  if (!order.arrived_at)                             return { success: false, error: 'Must mark as arrived before delivering' }

  const now = new Date().toISOString()

  const { error: updateErr, data: updated } = await service
    .from('orders')
    .update({ status: 'delivered', delivered_at: now, updated_at: now })
    .eq('id', orderId)
    .eq('assigned_driver_id', caller.id)
    .eq('status', 'out_for_delivery')
    .select('id')
    .maybeSingle()

  if (updateErr) return { success: false, error: updateErr.message }
  if (!updated)  return { success: false, error: 'Order update failed' }

  return { success: true }
}
