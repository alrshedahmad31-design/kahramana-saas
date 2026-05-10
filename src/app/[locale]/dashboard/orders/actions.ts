'use server'

import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  requireDashboardSection,
  isDashboardGuardError,
  isGlobalDashboardAdmin,
} from '@/lib/auth/dashboard-guards'
import { canUpdateOrderStatus } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import type { OrderRow, OrderItemRow, PaymentStatus } from '@/lib/supabase/custom-types'
import type { OrderStatus } from '@/lib/supabase/custom-types'
import { sendOrderStatusUpdate } from '@/lib/email/send'
import { BRANCHES, type BranchId } from '@/constants/contact'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EMAIL_STATUSES = ['new', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'] as const
type EmailableStatus = typeof EMAIL_STATUSES[number]
function isEmailableStatus(s: string): s is EmailableStatus {
  return (EMAIL_STATUSES as readonly string[]).includes(s)
}

export type OrderDetails = OrderRow & {
  order_items: Pick<OrderItemRow,
    'id' | 'name_ar' | 'name_en' | 'selected_size' | 'selected_variant' |
    'quantity' | 'unit_price_bhd' | 'item_total_bhd' | 'notes'
  >[]
}

const ORDER_DETAIL_FIELDS =
  'id, customer_name, customer_phone, branch_id, status, order_type, total_bhd, ' +
  'created_at, updated_at, notes, customer_notes, delivery_address, delivery_building, ' +
  'delivery_street, source, ' +
  'order_items(id, name_ar, name_en, selected_size, selected_variant, quantity, unit_price_bhd, item_total_bhd, notes)'

export async function getOrderDetails(orderId: string): Promise<OrderDetails | null> {
  // Section guard — replaces RLS-only trust path. Roles outside the orders
  // section can no longer pull full order PII via the modal action.
  let user
  try {
    user = await requireDashboardSection('orders')
  } catch (e) {
    if (isDashboardGuardError(e)) return null
    throw e
  }

  if (!UUID_RE.test(orderId)) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_DETAIL_FIELDS)
    .eq('id', orderId)
    .single()

  if (error || !data) return null
  const detail = data as unknown as OrderDetails

  // Branch scope: branch-bound staff cannot peek at other branches' orders
  // even if RLS allowed (e.g., kitchen reads on accepted/preparing/ready).
  if (!isGlobalDashboardAdmin(user) && user.branch_id && user.branch_id !== detail.branch_id) {
    return null
  }

  return detail
}

export type OrderActionErrorCode =
  | 'unauthorized'
  | 'invalid_input'
  | 'not_found'
  | 'forbidden_transition'
  | 'conflict'
  | 'refund_required'
  | 'db_error'

export type UpdateOrderStatusResult =
  | { success: true; status: OrderStatus }
  | { success: false; code: OrderActionErrorCode; error: string }

// `completed` is the only "money captured" state in the payment_status enum
// (012_payments_schema.sql). `processing` is in-flight, `pending*` is awaiting,
// `failed`/`refunded` are already terminal.
const PAID_PAYMENT_STATUSES: PaymentStatus[] = ['completed']

async function hasCapturedPayment(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  orderId: string,
): Promise<{ paid: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, status')
    .eq('order_id', orderId)
    .in('status', PAID_PAYMENT_STATUSES)
    .limit(1)
  if (error) return { paid: false, error: error.message }
  return { paid: (data ?? []).length > 0 }
}

export async function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
): Promise<UpdateOrderStatusResult> {
  let caller
  try {
    caller = await requireDashboardSection('orders')
  } catch (e) {
    return { success: false, code: 'unauthorized', error: isDashboardGuardError(e) ? e.message : 'Unauthorized' }
  }

  if (!UUID_RE.test(orderId)) {
    return { success: false, code: 'invalid_input', error: 'Invalid order id' }
  }

  const supabase = await createServiceClient()
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, branch_id, status, customer_name, customer_phone')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) {
    return { success: false, code: 'not_found', error: fetchError?.message ?? 'Order not found' }
  }

  if (!canUpdateOrderStatus(caller, order, nextStatus)) {
    return { success: false, code: 'forbidden_transition', error: 'Unauthorized status transition' }
  }

  // Refund-aware terminal transitions: paid orders cannot silently flip to
  // cancelled/returned without manager-driven refund handling.
  if (nextStatus === 'cancelled' || nextStatus === 'returned') {
    const paidCheck = await hasCapturedPayment(supabase, orderId)
    if (paidCheck.error) {
      return { success: false, code: 'db_error', error: paidCheck.error }
    }
    if (paidCheck.paid) {
      return {
        success: false,
        code: 'refund_required',
        error: 'Order has captured payment — refund must be processed before status change',
      }
    }
  }

  // Optimistic concurrency: scope by current status AND verify a row was
  // actually updated. .select('id') returns the affected rows; length 0 means
  // a concurrent change beat us.
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id')

  if (updateError) return { success: false, code: 'db_error', error: updateError.message }
  if (!updated || updated.length === 0) {
    return {
      success: false,
      code: 'conflict',
      error: 'Order status changed by another request — refresh and retry',
    }
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/orders`)
  revalidatePath(`/${locale}/dashboard/delivery`)

  // Fire-and-forget status update email
  if (order.customer_phone && isEmailableStatus(nextStatus)) {
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('email, name')
      .eq('phone', order.customer_phone)
      .maybeSingle()

    if (profile?.email) {
      sendOrderStatusUpdate(profile.email, {
        customerName: profile.name ?? order.customer_name ?? '',
        orderId,
        status: nextStatus,
        branchName: BRANCHES[order.branch_id as BranchId]?.nameAr ?? 'كهرمانة',
      }).catch(() => {})
    }
  }

  return { success: true, status: nextStatus }
}

const reasonSchema = z.object({
  orderId:      z.string().regex(UUID_RE, 'Invalid order id'),
  reason:       z.string().trim().min(3).max(500),
  targetStatus: z.enum(['cancelled', 'returned']),
})

/**
 * Updates an order status with a mandatory reason.
 * Used for cancellations and returns.
 */
export async function updateOrderWithReason(
  orderId: string,
  reason: string,
  targetStatus: 'cancelled' | 'returned' = 'cancelled',
): Promise<UpdateOrderStatusResult> {
  let caller
  try {
    caller = await requireDashboardSection('orders')
  } catch (e) {
    return { success: false, code: 'unauthorized', error: isDashboardGuardError(e) ? e.message : 'Unauthorized' }
  }

  const parsed = reasonSchema.safeParse({ orderId, reason, targetStatus })
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      success: false,
      code: 'invalid_input',
      error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input',
    }
  }
  const v = parsed.data

  const supabase = await createServiceClient()
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, branch_id, status, notes')
    .eq('id', v.orderId)
    .single()

  if (fetchError) {
    return { success: false, code: 'db_error', error: fetchError.message }
  }
  if (!order) {
    return { success: false, code: 'not_found', error: 'Order not found' }
  }

  // Reuse the same transition+role+branch validator as updateOrderStatus
  // so the cancel/return path can't bypass the workflow graph.
  if (!canUpdateOrderStatus(caller, order, v.targetStatus)) {
    return { success: false, code: 'forbidden_transition', error: 'Unauthorized status transition' }
  }

  // Refund-aware: paid orders block cancel/return until payments are reconciled.
  const paidCheck = await hasCapturedPayment(supabase, v.orderId)
  if (paidCheck.error) {
    return { success: false, code: 'db_error', error: paidCheck.error }
  }
  if (paidCheck.paid) {
    return {
      success: false,
      code: 'refund_required',
      error: 'Order has captured payment — refund must be processed before cancellation/return',
    }
  }

  const timestamp = new Date().toISOString()
  const tag = v.targetStatus.toUpperCase()
  const updatedNotes = order.notes
    ? `${order.notes}\n[${tag} ${timestamp}]: ${v.reason}`
    : `[${tag} ${timestamp}]: ${v.reason}`

  // Optimistic concurrency: pin to current status and verify a row was updated.
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({
      status:     v.targetStatus,
      notes:      updatedNotes,
      updated_at: timestamp,
    })
    .eq('id', v.orderId)
    .eq('status', order.status)
    .select('id')

  if (updateError) return { success: false, code: 'db_error', error: updateError.message }
  if (!updated || updated.length === 0) {
    return {
      success: false,
      code: 'conflict',
      error: 'Order status changed by another request — refresh and retry',
    }
  }

  // Audit log: high-risk action, surface failure instead of swallowing.
  const { error: auditError } = await supabase.from('audit_logs').insert({
    table_name: 'orders',
    action:     'UPDATE',
    user_id:    caller.id,
    record_id:  v.orderId,
    changes:    { status: v.targetStatus, reason: v.reason, prev_status: order.status },
    branch_id:  order.branch_id,
    actor_role: caller.role,
  })
  if (auditError) {
    // Order is already mutated — log durable warning but still report success
    // so the UI doesn't double-submit. Operations should monitor this log.
    console.error('[orders] audit_logs insert failed for cancel/return', v.orderId, auditError)
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/orders`)
  revalidatePath(`/${locale}/dashboard/delivery`)

  return { success: true, status: v.targetStatus }
}
