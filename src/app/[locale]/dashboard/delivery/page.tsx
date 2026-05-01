import { redirect }             from 'next/navigation'
import { getSession }           from '@/lib/auth/session'
import { createClient }         from '@/lib/supabase/server'
import type { DeliveryOrder, Driver } from '@/lib/delivery/types'
import DeliveryPageClient       from '@/components/delivery/DeliveryPageClient'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function DeliveryPage({ params }: Props) {
  const { locale } = await params
  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')

  // Delivery board is a dispatch tool for managers only.
  // Drivers use /driver, not this page.
  const allowedRoles = new Set(['owner', 'general_manager', 'branch_manager'])
  if (!user.role || !allowedRoles.has(user.role)) {
    redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')
  }

  const supabase = await createClient()
  const today    = new Date().toISOString().split('T')[0]
  const branchScope = user.role === 'owner' || user.role === 'general_manager'
    ? null
    : user.branch_id ?? null

  // Active delivery orders
  let activeOrdersQuery = supabase
    .from('orders')
    .select(`
      id, status, customer_name, customer_phone,
      branch_id, notes, customer_notes, source, total_bhd, created_at, updated_at,
      assigned_driver_id, delivery_address, expected_delivery_time,
      delivery_lat, delivery_lng,
      order_items(id)
    `)
    .in('status', ['accepted', 'preparing', 'ready', 'out_for_delivery'])
    .order('created_at', { ascending: true })

  if (branchScope) activeOrdersQuery = activeOrdersQuery.eq('branch_id', branchScope)
  const { data: ordersRaw } = await activeOrdersQuery

  // Completed today (for metrics + per-driver count + on-time rate)
  let completedQuery = supabase
    .from('orders')
    .select('id, total_bhd, created_at, updated_at, assigned_driver_id, expected_delivery_time')
    .in('status', ['delivered', 'completed'])
    .gte('created_at', today)

  if (branchScope) completedQuery = completedQuery.eq('branch_id', branchScope)
  const { data: completedRaw } = await completedQuery

  // Drivers (staff with role='driver', active)
  let driversQuery = supabase
    .from('staff_basic')
    .select('id, name, phone, branch_id, availability_status')
    .eq('role', 'driver')
    .eq('is_active', true)

  if (branchScope) driversQuery = driversQuery.eq('branch_id', branchScope)
  const { data: driversRaw } = await driversQuery

  // Latest driver locations
  const { data: locationsRaw } = await supabase
    .from('driver_locations')
    .select('driver_id, lat, lng, created_at')
    .order('created_at', { ascending: false })

  // Build driver location map (latest per driver)
  const locationMap = new Map<string, { lat: number; lng: number }>()
  for (const loc of locationsRaw ?? []) {
    if (!locationMap.has(loc.driver_id)) locationMap.set(loc.driver_id, { lat: loc.lat, lng: loc.lng })
  }

  // Build driver → current order map
  const driverOrderMap = new Map<string, string>()
  for (const o of ordersRaw ?? []) {
    if (o.assigned_driver_id && o.status === 'out_for_delivery') {
      driverOrderMap.set(o.assigned_driver_id, o.id)
    }
  }

  // Completed today per driver
  const driverCompletedMap = new Map<string, number>()
  for (const o of completedRaw ?? []) {
    if (o.assigned_driver_id) {
      driverCompletedMap.set(o.assigned_driver_id, (driverCompletedMap.get(o.assigned_driver_id) ?? 0) + 1)
    }
  }

  const drivers: Driver[] = (driversRaw ?? []).map((d) => {
    const avail = d.availability_status ?? 'offline'
    let status: Driver['status']
    if (avail === 'offline') {
      status = 'offline'
    } else if (driverOrderMap.has(d.id)) {
      status = 'delivering'
    } else {
      status = 'available'
    }
    return {
      id:               d.id,
      name:             d.name,
      phone:            d.phone,
      status,
      location:         locationMap.get(d.id) ?? null,
      current_order_id: driverOrderMap.get(d.id) ?? null,
      completed_today:  driverCompletedMap.get(d.id) ?? 0,
      branch_id:        d.branch_id,
    }
  })

  const orders: DeliveryOrder[] = (ordersRaw ?? []).map((o) => {
    const driver = drivers.find(d => d.id === o.assigned_driver_id)
    return {
      id:               o.id,
      order_number:     o.id.slice(0, 8).toUpperCase(),
      status:           o.status as DeliveryOrder['status'],
      customer_name:    o.customer_name,
      customer_phone:   o.customer_phone,
      customer_address:        o.delivery_address ?? null,
      customer_location:       o.delivery_lat != null && o.delivery_lng != null
                                 ? { lat: o.delivery_lat, lng: o.delivery_lng }
                                 : null,
      branch_id:               o.branch_id,
      driver_id:               o.assigned_driver_id,
      driver_name:             driver?.name ?? null,
      driver_phone:            driver?.phone ?? null,
      items_count:             Array.isArray(o.order_items) ? o.order_items.length : 0,
      total_bhd:               o.total_bhd,
      notes:                   o.customer_notes ?? o.notes,
      source:                  o.source,
      created_at:              o.created_at,
      updated_at:              o.updated_at,
      expected_delivery_time:  o.expected_delivery_time ?? null,
    }
  })

  const completed       = completedRaw ?? []
  const revenueToday    = completed.reduce((s, o) => s + (Number(o.total_bhd) || 0), 0)
  const inTransit       = orders.filter(o => o.status === 'out_for_delivery').length
  const nowMs           = Date.now()
  const lateCount       = orders.filter(o => {
    const ageMin = (nowMs - new Date(o.created_at).getTime()) / 60_000
    return ageMin > 45
  }).length
  const driversAvailable = drivers.filter(d => d.status === 'available').length
  const driversTotal     = drivers.length

  // On-time rate: delivered within expected window (fallback: ≤45 min)
  const onTimeCount = completed.filter(o => {
    const exp = o.expected_delivery_time
      ? new Date(o.expected_delivery_time).getTime()
      : new Date(o.created_at).getTime() + 45 * 60_000
    return new Date(o.updated_at).getTime() <= exp
  }).length
  const onTimeRate = completed.length > 0
    ? Math.round(onTimeCount / completed.length * 100)
    : 0

  return (
    <div>
      <DeliveryPageClient
        initialOrders={orders}
        initialDrivers={drivers}
        initialMetrics={{
          revenue_today:      revenueToday,
          orders_total:       orders.length,
          in_transit:         inTransit,
          completed_today:    completed.length,
          late_count:         lateCount,
          revenue_delta:      0,
          orders_delta:       0,
          drivers_available:  driversAvailable,
          drivers_total:      driversTotal,
          on_time_rate:       onTimeRate,
        }}
        locale={locale}
        branchId={branchScope}
      />
    </div>
  )
}
