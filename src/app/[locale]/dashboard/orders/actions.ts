'use server'

import { createClient } from '@/lib/supabase/server'
import type { OrderRow, OrderItemRow } from '@/lib/supabase/types'

export type OrderDetails = OrderRow & {
  order_items: Pick<OrderItemRow,
    'id' | 'name_ar' | 'name_en' | 'selected_size' | 'selected_variant' |
    'quantity' | 'unit_price_bhd' | 'item_total_bhd'
  >[]
}

export async function getOrderDetails(orderId: string): Promise<OrderDetails | null> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('orders')
    .select(`
      id, customer_name, customer_phone, branch_id, status, notes,
      total_bhd, coupon_discount_bhd, coupon_id, assigned_driver_id,
      source, whatsapp_sent_at, created_at, updated_at,
      order_items(id, name_ar, name_en, selected_size, selected_variant, quantity, unit_price_bhd, item_total_bhd)
    `)
    .eq('id', orderId)
    .single()

  return (data as OrderDetails) ?? null
}
