import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
import { requireDashboardSection } from '@/lib/auth/dashboard-guards'
import { createClient } from '@/lib/supabase/server'
import OrdersClient from '@/components/orders/OrdersClient'
import type { OrderCardData } from '@/components/orders/OrderCard'
import { HIDDEN_BRANCHES } from '@/constants/contact'

const PAGE_SIZE = 20

interface OrdersPageProps {
  params: Promise<{ locale: string }>
}

export default async function OrdersPage({ params }: OrdersPageProps) {
  const { locale } = await params
  const prefix = locale === 'en' ? '/en' : ''
  let user
  try {
    user = await requireDashboardSection('orders')
  } catch {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  // Non-global users are locked to their own branch — enforced here and repeated in OrdersClient
  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  const userBranchId  = isGlobalAdmin ? null : (user.branch_id ?? null)

  // Default filter matches client defaults: today, all statuses, page 1
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bahrain' }).format(new Date())
  const todayIso = new Date(`${today}T00:00:00+03:00`).toISOString()

  let ordersQuery = supabase
    .from('orders')
    .select(
      'id, customer_name, customer_phone, branch_id, status, order_type, total_bhd, created_at, updated_at, notes, customer_notes, delivery_address, delivery_building, delivery_street, source, picked_up_at, delivered_at, order_items(name_ar, name_en, quantity, selected_size, selected_variant, notes)',
      { count: 'exact' },
    )
    .gte('created_at', todayIso)
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1)

  let totalsQuery = supabase
    .from('orders')
    .select('total_bhd')
    .gte('created_at', todayIso)

  if (userBranchId) {
    ordersQuery = ordersQuery.eq('branch_id', userBranchId)
    totalsQuery = totalsQuery.eq('branch_id', userBranchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    ordersQuery = ordersQuery.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
    totalsQuery = totalsQuery.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

  const [ordersResult, totalsResult] = await Promise.all([ordersQuery, totalsQuery])

  // Surface real query failures to the error boundary instead of rendering an
  // empty list + 0.000 total (which is indistinguishable from "no orders today").
  if (ordersResult.error) throw ordersResult.error
  if (totalsResult.error) throw totalsResult.error

  // Compute "late" server-side to avoid client/SSR clock drift, then mark
  // any out-for-delivery order whose pickup happened more than 45 minutes
  // ago and has no delivered_at yet.
  const nowMs = Date.now()
  const LATE_THRESHOLD_MS = 45 * 60_000
  const initialOrders: OrderCardData[] = (
    (ordersResult.data ?? []) as Array<OrderCardData & {
      picked_up_at?: string | null
      delivered_at?: string | null
    }>
  ).map((o) => {
    const pickedUpMs = o.picked_up_at ? new Date(o.picked_up_at).getTime() : null
    const isLate =
      o.status === 'out_for_delivery'
      && pickedUpMs !== null
      && !o.delivered_at
      && (nowMs - pickedUpMs) > LATE_THRESHOLD_MS
    return { ...o, is_late: isLate }
  })

  const initialTotalCount = ordersResult.count ?? 0

  const initialFilteredTotal = (
    (totalsResult.data ?? []) as { total_bhd: number }[]
  ).reduce((s, r) => s + Number(r.total_bhd), 0)

  return (
    <OrdersClient
      userRole={user.role}
      userBranchId={userBranchId}
      initialOrders={initialOrders}
      initialTotalCount={initialTotalCount}
      initialFilteredTotal={initialFilteredTotal}
    />
  )
}
