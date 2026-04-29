'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canAccessKDS } from '@/lib/auth/rbac'
import type { OrderStatus } from '@/lib/supabase/types'

export type AdvanceResult = { success: true } | { success: false; error: string }

const ADVANCE: Partial<Record<OrderStatus, OrderStatus>> = {
  accepted:  'preparing',
  preparing: 'ready',
  ready:     'completed',
}

export async function advanceOrderStatus(
  orderId:       string,
  currentStatus: OrderStatus,
): Promise<AdvanceResult> {
  const caller = await getSession()
  if (!caller || !canAccessKDS(caller)) {
    return { success: false, error: 'Unauthorized' }
  }

  const nextStatus = ADVANCE[currentStatus]
  if (!nextStatus) return { success: false, error: 'Invalid transition' }

  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId)
    .eq('status', currentStatus)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
