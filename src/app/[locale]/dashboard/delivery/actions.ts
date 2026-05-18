'use server'

import * as Sentry from '@sentry/nextjs'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { sendPushToDriver } from '@/app/[locale]/driver/push-actions'
import { toSafeError } from '@/lib/utils/safe-error'

const MANAGER_ROLES = new Set(['owner', 'general_manager', 'branch_manager'])
const GLOBAL_ADMIN_ROLES = new Set(['owner', 'general_manager'])

export type DispatchActionResult = { success: true } | { success: false; error: string }

export async function assignDriverToOrder(
  orderId:  string,
  driverId: string,
): Promise<DispatchActionResult> {
  const caller = await getSession()
  if (!caller || !caller.role || !MANAGER_ROLES.has(caller.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  // AUD-V4-016: read + write through the same service client. Caller authz
  // is enforced above; using anon for the pre-checks would silently break
  // if RLS on orders/staff_basic ever tightens.
  const service = await createServiceClient()
  const now     = new Date().toISOString()

  const { data: order, error: orderErr } = await service
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

  if (!GLOBAL_ADMIN_ROLES.has(caller.role) && caller.branch_id !== order.branch_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data: driver, error: driverErr } = await service
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

  // VULN-RBAC-01: a NULL branch_id is an invalid driver state, not a wildcard.
  // Reject before any branch-scoped dispatch.
  if (driver.branch_id === null) {
    return { success: false, error: 'Driver has no branch assigned' }
  }
  if (driver.branch_id !== order.branch_id) {
    return { success: false, error: 'Driver does not serve this branch' }
  }

  const { error: updateErr, data: updated } = await service
    .from('orders')
    .update({
      assigned_driver_id: driverId,
      status:             'out_for_delivery',
      picked_up_at:       now,
      updated_at:         now,
    })
    .eq('id', orderId)
    .eq('status', 'ready')
    .select('id')
    .maybeSingle()

  if (updateErr) {
    return { success: false, error: updateErr.message }
  }

  if (!updated) {
    return { success: false, error: 'Order is no longer available for dispatch' }
  }

  const { error: auditError } = await service.from('audit_logs').insert({
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
  if (auditError) {
    Sentry.captureException(auditError, { tags: { area: 'delivery', operation: 'dispatch' } })
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/orders`)
  revalidatePath(`/${locale}/dashboard/delivery`)

  await sendPushToDriver(driverId, {
    title: 'طلب جديد',
    body:  'تم تعيينك لطلب جديد — افتح التطبيق للمعاينة',
    url:   `/${locale}/driver`,
    tag:   'driver-order',
  }).catch(() => {})

  return { success: true }
}

// Active delivery statuses where unassign / reassign make sense.
const ACTIVE_DELIVERY_STATUSES = ['accepted', 'preparing', 'ready', 'out_for_delivery', 'arrived'] as const

export async function unassignDriver(orderId: string): Promise<DispatchActionResult> {
  const caller = await getSession()
  if (!caller || !caller.role || !MANAGER_ROLES.has(caller.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createServiceClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id, branch_id, status')
    .eq('id', orderId)
    .single()
  if (!order) return { success: false, error: 'Order not found' }

  if (!GLOBAL_ADMIN_ROLES.has(caller.role) && caller.branch_id !== order.branch_id) {
    return { success: false, error: 'Unauthorized' }
  }

  // Audit fix #5: only unassign while the order is in an active delivery
  // state. Cannot unassign a delivered/cancelled/failed order.
  if (!(ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(order.status)) {
    return { success: false, error: 'Cannot unassign driver at this stage' }
  }

  // Pin to current status + verify row count so a concurrent transition
  // can't be silently overwritten.
  const { data: updatedRows, error } = await supabase
    .from('orders')
    .update({
      assigned_driver_id: null,
      status: 'ready',
      picked_up_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: 'Order status changed — refresh and retry' }
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/delivery`)
  return { success: true }
}

export async function cancelDeliveryOrder(orderId: string): Promise<DispatchActionResult> {
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

  const CANCELLABLE = new Set(['accepted', 'preparing', 'ready', 'out_for_delivery', 'arrived'])
  if (!CANCELLABLE.has(order.status)) {
    return { success: false, error: 'Order cannot be cancelled at this stage' }
  }

  // Audit fix #5: pin to current status + verify row count so a concurrent
  // delivery/cancel can't be silently overwritten.
  const now = new Date().toISOString()
  const { data: updatedRows, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled', updated_at: now })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: 'Order status changed — refresh and retry' }
  }

  const { error: auditError } = await supabase.from('audit_logs').insert({
    table_name: 'orders',
    action:     'UPDATE',
    user_id:    caller.id,
    record_id:  orderId,
    changes:    { operation: 'cancel', previous_status: order.status, new_status: 'cancelled' },
    branch_id:  order.branch_id,
    actor_role: caller.role,
  })
  if (auditError) {
    Sentry.captureException(auditError, { tags: { area: 'delivery', operation: 'cancel' } })
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/delivery`)
  revalidatePath(`/${locale}/dashboard/orders`)
  return { success: true }
}

export async function confirmDelivery(orderId: string): Promise<DispatchActionResult> {
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

  if (order.status !== 'out_for_delivery' && order.status !== 'arrived') {
    return { success: false, error: 'Order is not out for delivery' }
  }

  // VULN-022: compare-and-swap on the previously-observed status. Without
  // this, a manager click could race against a driver-bump / cancel / reassign
  // that already flipped the row out of out_for_delivery|arrived — the UPDATE
  // would then either stomp a delivered-elsewhere order or surface as an
  // opaque DB error. Pin to the exact status we just read; on miss, return a
  // structured conflict so the UI can re-render and retry instead of falling
  // through to a generic 500-style toast.
  const now = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from('orders')
    .update({ status: 'delivered', delivered_at: now, updated_at: now })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id')

  if (error) return { success: false, error: toSafeError(error) }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'order_status_conflict' }
  }

  const { error: auditError } = await supabase.from('audit_logs').insert({
    table_name: 'orders',
    action:     'UPDATE',
    user_id:    caller.id,
    record_id:  orderId,
    changes:    {
      operation:       'confirm_delivery',
      previous_status: order.status,
      new_status:      'delivered',
    },
    branch_id:  order.branch_id,
    actor_role: caller.role,
  })
  if (auditError) {
    Sentry.captureException(auditError, { tags: { area: 'delivery', operation: 'confirm_delivery' } })
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/delivery`)
  revalidatePath(`/${locale}/dashboard/orders`)
  return { success: true }
}

// D-C4: reassignDriver validates the new driver same way assignDriverToOrder does
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

  // D-C4: validate the new driver — same checks as assignDriverToOrder
  const { data: newDriver, error: driverErr } = await supabase
    .from('staff_basic')
    .select('id, role, is_active, branch_id')
    .eq('id', driverId)
    .single()

  if (driverErr || !newDriver) {
    return { success: false, error: 'Driver not found' }
  }
  if (newDriver.role !== 'driver' || !newDriver.is_active) {
    return { success: false, error: 'Invalid driver' }
  }
  // VULN-RBAC-01: NULL branch_id is invalid state, never a wildcard.
  if (newDriver.branch_id === null) {
    return { success: false, error: 'Driver has no branch assigned' }
  }
  if (newDriver.branch_id !== order.branch_id) {
    return { success: false, error: 'Driver does not serve this branch' }
  }

  // Audit fix #5: only reassign while the order is still in an active
  // delivery state. Pin to current status to detect concurrent transitions.
  if (!(ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(order.status)) {
    return { success: false, error: 'Cannot reassign driver at this stage' }
  }

  const { data: updatedRows, error } = await supabase
    .from('orders')
    .update({
      assigned_driver_id: driverId,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: 'Order status changed — refresh and retry' }
  }

  const { error: auditError } = await supabase.from('audit_logs').insert({
    table_name: 'orders',
    action:     'UPDATE',
    user_id:    caller.id,
    record_id:  orderId,
    changes:    { operation: 'reassign', assigned_driver_id: driverId },
    branch_id:  order.branch_id,
    actor_role: caller.role,
  })
  if (auditError) {
    Sentry.captureException(auditError, { tags: { area: 'delivery', operation: 'reassign' } })
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/delivery`)
  return { success: true }
}
