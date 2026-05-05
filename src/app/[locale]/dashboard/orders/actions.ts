'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canUpdateOrderStatus } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import type { OrderRow, OrderItemRow } from '@/lib/supabase/custom-types'
import type { OrderStatus } from '@/lib/supabase/custom-types'

export type OrderDetails = OrderRow & {
  order_items: Pick<OrderItemRow,
    'id' | 'name_ar' | 'name_en' | 'selected_size' | 'selected_variant' |
    'quantity' | 'unit_price_bhd' | 'item_total_bhd'
  >[]
}

export async function getOrderDetails(orderId: string): Promise<OrderDetails | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select(`
      *,
      order_items(id, name_ar, name_en, selected_size, selected_variant, quantity, unit_price_bhd, item_total_bhd)
    `)
    .eq('id', orderId)
    .single()

  return data as OrderDetails | null
}

export type UpdateOrderStatusResult =
  | { success: true; status: OrderStatus }
  | { success: false; error: string }

export async function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
): Promise<UpdateOrderStatusResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }

  const supabase = await createServiceClient()
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, branch_id, status')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) {
    return { success: false, error: fetchError?.message ?? 'Order not found' }
  }

  if (!canUpdateOrderStatus(caller, order, nextStatus)) {
    return { success: false, error: 'Unauthorized status transition' }
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId)
    .eq('status', order.status)

  if (updateError) return { success: false, error: updateError.message }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/orders`)
  revalidatePath(`/${locale}/dashboard/delivery`)

  return { success: true, status: nextStatus }
}
