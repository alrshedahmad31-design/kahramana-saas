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
import type { OrderRow, OrderItemRow } from '@/lib/supabase/custom-types'
import type { OrderStatus } from '@/lib/supabase/custom-types'
import { sendOrderStatusUpdate } from '@/lib/email/send'
import { BRANCHES, type BranchId } from '@/constants/contact'
import { toSafeError } from '@/lib/utils/safe-error'
import { restoreLoyaltyForReversedOrder } from '@/lib/loyalty/restore'
import { captureAnalyticsError } from '@/lib/analytics/result-helpers'

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

type RpcUpdateOrderStatusResult =
  | { ok: true;  status: OrderStatus }
  | { ok: false; code: OrderActionErrorCode }

function isOrderRpcResult(value: unknown): value is RpcUpdateOrderStatusResult {
  return typeof value === 'object' && value !== null && 'ok' in value
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

  // Service-role read for the pre-RPC snapshot (customer_name/phone for the
  // email step) and the customer_profiles lookup — RLS would block these
  // for branch-bound callers.
  const supabase = await createServiceClient()
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, branch_id, status, customer_name, customer_phone')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) {
    return { success: false, code: 'not_found', error: fetchError?.message ?? 'Order not found' }
  }

  // Belt-and-braces: rbac.ts canUpdateOrderStatus catches the obvious
  // forbidden transitions before we hit the DB. The RPC re-asserts every
  // guard under SECURITY DEFINER so the source of truth lives in one place.
  if (!canUpdateOrderStatus(caller, order, nextStatus)) {
    return { success: false, code: 'forbidden_transition', error: 'Unauthorized status transition' }
  }

  // Atomic transition: rpc_update_order_status (migration 165) checks role,
  // branch, transition matrix, captured-payment refund block, and CAS, then
  // writes the audit_logs row in the same transaction.
  const authClient = await createClient()
  const { data: rpcRaw, error: rpcError } = await authClient.rpc('rpc_update_order_status', {
    p_order_id:        orderId,
    p_new_status:      nextStatus,
    p_expected_status: order.status,
  })
  if (rpcError) {
    return { success: false, code: 'db_error', error: toSafeError(rpcError) }
  }
  const rpc = isOrderRpcResult(rpcRaw) ? rpcRaw : null
  if (!rpc) {
    return { success: false, code: 'db_error', error: 'Order status update returned an unexpected payload' }
  }
  if (!rpc.ok) {
    const code = rpc.code
    const errMessageMap: Record<OrderActionErrorCode, string> = {
      unauthorized:         'Unauthorized',
      invalid_input:        'Invalid input',
      not_found:            'Order not found',
      forbidden_transition: 'Unauthorized status transition',
      conflict:             'Order status changed by another request — refresh and retry',
      refund_required:      'Order has captured payment — refund must be processed before status change',
      db_error:             'Database error',
    }
    return { success: false, code, error: errMessageMap[code] ?? 'Status update rejected' }
  }

  // VULN-103: cancelled/returned orders restore redeemed loyalty points.
  // Atomic + idempotent inside the RPC. Failures are logged but do not
  // unwind the status change — the audit row is the durable trail.
  if (nextStatus === 'cancelled' || nextStatus === 'returned') {
    const restore = await restoreLoyaltyForReversedOrder(orderId, caller)
    if (!restore.ok) {
      console.error('[orders] loyalty restore failed for', orderId, restore.error)
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
      }).catch((err: unknown) => {
        captureAnalyticsError({
          code:      'EMAIL_SEND_FAILED',
          message:   err instanceof Error ? err.message : String(err),
          function:  'email_send_failed',
          timestamp: new Date().toISOString(),
        })
      })
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

  // Service-role read for the order existence + transition check below; the
  // RPC re-checks all of role / branch / transition / refund / CAS under
  // SECURITY DEFINER and writes the audit row atomically.
  const supabase = await createServiceClient()
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, branch_id, status, notes')
    .eq('id', v.orderId)
    .single()

  if (fetchError) {
    return { success: false, code: 'db_error', error: toSafeError(fetchError) }
  }
  if (!order) {
    return { success: false, code: 'not_found', error: 'Order not found' }
  }

  // Reuse the same transition+role+branch validator as updateOrderStatus
  // so the cancel/return path can't bypass the workflow graph.
  if (!canUpdateOrderStatus(caller, order, v.targetStatus)) {
    return { success: false, code: 'forbidden_transition', error: 'Unauthorized status transition' }
  }

  const authClient = await createClient()
  const { data: rpcRaw, error: rpcError } = await authClient.rpc('rpc_cancel_order', {
    p_order_id:      v.orderId,
    p_target_status: v.targetStatus,
    p_reason:        v.reason,
  })
  if (rpcError) {
    return { success: false, code: 'db_error', error: toSafeError(rpcError) }
  }
  const rpc = isOrderRpcResult(rpcRaw) ? rpcRaw : null
  if (!rpc) {
    return { success: false, code: 'db_error', error: 'Order cancel returned an unexpected payload' }
  }
  if (!rpc.ok) {
    const code = rpc.code
    const errMessageMap: Record<OrderActionErrorCode, string> = {
      unauthorized:         'Unauthorized',
      invalid_input:        'Invalid input',
      not_found:            'Order not found',
      forbidden_transition: 'Unauthorized status transition',
      conflict:             'Order status changed by another request — refresh and retry',
      refund_required:      'Order has captured payment — refund must be processed before cancellation/return',
      db_error:             'Database error',
    }
    return { success: false, code, error: errMessageMap[code] ?? 'Cancel/return rejected' }
  }

  // VULN-103: restore redeemed loyalty points for the cancelled/returned order.
  const restore = await restoreLoyaltyForReversedOrder(v.orderId, caller)
  if (!restore.ok) {
    console.error('[orders] loyalty restore failed for', v.orderId, restore.error)
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/orders`)
  revalidatePath(`/${locale}/dashboard/delivery`)

  return { success: true, status: v.targetStatus }
}
