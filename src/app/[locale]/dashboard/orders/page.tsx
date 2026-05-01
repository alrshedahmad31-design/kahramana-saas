import { requireAuth }  from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import OrdersClient     from '@/components/orders/OrdersClient'
import type { OrderCardData } from '@/components/orders/OrderCard'

const PAGE_SIZE = 20

export default async function OrdersPage() {
  const user     = await requireAuth()
  const supabase = await createClient()

  // Default filter matches client defaults: today, all statuses, page 1
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const [ordersResult, totalsResult] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, customer_name, customer_phone, branch_id, status, total_bhd, created_at, updated_at, notes, customer_notes, delivery_address, delivery_building, delivery_street, order_items(name_ar, name_en, quantity, selected_size, selected_variant)',
        { count: 'exact' },
      )
      .gte('created_at', todayIso)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1),
    supabase
      .from('orders')
      .select('total_bhd')
      .gte('created_at', todayIso),
  ])

  const initialOrders: OrderCardData[] =
    (ordersResult.data ?? []) as OrderCardData[]

  const initialTotalCount = ordersResult.count ?? 0

  const initialFilteredTotal = (
    (totalsResult.data ?? []) as { total_bhd: number }[]
  ).reduce((s, r) => s + Number(r.total_bhd), 0)

  return (
    <OrdersClient
      userRole={user.role}
      initialOrders={initialOrders}
      initialTotalCount={initialTotalCount}
      initialFilteredTotal={initialFilteredTotal}
    />
  )
}
