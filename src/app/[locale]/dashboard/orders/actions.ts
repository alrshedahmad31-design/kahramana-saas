'use server'

import { createClient } from '@/lib/supabase/server'
import type { OrderRow, OrderItemRow } from '@/lib/supabase/custom-types'

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
