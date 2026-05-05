'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { sendPushToDriver } from '@/app/[locale]/driver/push-actions'

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

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/orders`)
  revalidatePath(`/${locale}/dashboard/delivery`)

  // 5. Push notification to driver (best-effort, does not fail the dispatch)
  await sendPushToDriver(driverId, {
    title: '😋 طلب جديد',
    body:  'تم تعيينك لطلب جديد — افتح التطبيق للمعاينة',
    url:   `/${locale}/driver`,
    tag:   'driver-order',
  }).catch(() => { /* silent: push is informational only */ })

  return { success: true }
}

// ── Unassign driver / Return to pool ──────────────────────────────────────────
// Reverts status to 'ready' and clears the assigned driver.
export async function unassignDriver(orderId: string): Promise<DispatchActionResult> {
  const caller = await getSession()
  if (!caller || !caller.role || !MANAGER_ROLES.has(caller.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createServiceClient()
  const { data: order } = await supabase.from('orders').select('branch_id').eq('id', orderId).single()
  if (!order) return { success: false, error: 'Order not found' }

  if (!GLOBAL_ADMIN_ROLES.has(caller.role) && caller.branch_id !== order.branch_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('orders')
    .update({ 
      assigned_driver_id: null, 
      status: 'ready', 
      picked_up_at: null,
      updated_at: new Date().toISOString() 
    })
    .eq('id', orderId)

  if (error) return { success: false, error: error.message }
  
  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/delivery`)
  return { success: true }
}

// ── Reassign to different driver ──────────────────────────────────────────────
// Changes the driver without changing the status (assumes order is out_for_delivery).
export async function reassignDriver(orderId: string, driverId: string): Promise<DispatchActionResult> {
  const caller = await getSession()
  if (!caller || !caller.role || !MANAGER_ROLES.has(caller.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createServiceClient()
  const { data: order } = await supabase.from('orders').select('branch_id, status').eq('id', orderId).single()
  if (!order) return { success: false, error: 'Order not found' }

  if (!GLOBAL_ADMIN_ROLES.has(caller.role) && caller.branch_id !== order.branch_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('orders')
    .update({ 
      assigned_driver_id: driverId, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', orderId)

  if (error) return { success: false, error: error.message }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/delivery`)
  return { success: true }
}
