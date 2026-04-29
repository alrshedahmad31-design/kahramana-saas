import { redirect }    from 'next/navigation'
import { getSession }  from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { BRANCHES }    from '@/constants/contact'
import type { BranchId } from '@/constants/contact'
import DriverDashboard from '@/components/driver/DriverDashboard'
import type { DriverOrder } from '@/lib/supabase/custom-types'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function DriverPage({ params }: Props) {
  const { locale } = await params
  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')

  const supabase   = await createClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const ORDER_SELECT = `
    id, customer_name, customer_phone, branch_id, status,
    notes, delivery_address, delivery_lat, delivery_lng, delivery_instructions,
    delivery_building, delivery_street, delivery_area,
    expected_delivery_time, customer_notes, driver_notes,
    picked_up_at, arrived_at, delivered_at,
    total_bhd, assigned_driver_id, created_at, updated_at,
    source, whatsapp_sent_at, coupon_id, coupon_discount_bhd,
    order_items(name_ar, name_en, quantity, selected_size, selected_variant),
    payments(method)
  `

  // Active orders for this branch (ready = at restaurant, out_for_delivery = en route)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let activeQ = (supabase as any)
    .from('orders')
    .select(ORDER_SELECT)
    .in('status', ['ready', 'out_for_delivery'])
    .order('created_at', { ascending: true })

  if (user.branch_id) activeQ = activeQ.eq('branch_id', user.branch_id)

  const { data: activeRaw } = await activeQ

  // Completed today by this driver
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: completedRaw } = await (supabase as any)
    .from('orders')
    .select(ORDER_SELECT)
    .eq('status', 'delivered')
    .eq('assigned_driver_id', user.id)
    .gte('updated_at', todayStart.toISOString())
    .order('updated_at', { ascending: false })

  const orders:    DriverOrder[] = (activeRaw    ?? []) as DriverOrder[]
  const completed: DriverOrder[] = (completedRaw ?? []) as DriverOrder[]

  const branch        = user.branch_id ? (BRANCHES[user.branch_id as BranchId] ?? null) : null
  const branchMapsUrl = branch?.mapsUrl ?? null

  return (
    <DriverDashboard
      initialOrders={orders}
      initialCompletedOrders={completed}
      branchId={user.branch_id}
      branchMapsUrl={branchMapsUrl}
      driverId={user.id}
      locale={locale}
      completedCount={completed.length}
    />
  )
}
