import { IBM_Plex_Sans_Arabic } from 'next/font/google'
import { redirect }             from 'next/navigation'
import { getSession }           from '@/lib/auth/session'
import { createClient }         from '@/lib/supabase/server'
import type { DeliveryOrder, Driver } from '@/lib/delivery/types'
import DeliveryPageClient       from '@/components/delivery/DeliveryPageClient'

const ibmPlex = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '600', '700'] })

interface Props {
  params: Promise<{ locale: string }>
}

export default async function DeliveryPage({ params }: Props) {
  const { locale } = await params
  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')

  // Restrict to roles that legitimately need the delivery board:
  // dispatchers (branch_manager+), drivers, and global admins.
  const allowedRoles = new Set(['owner', 'general_manager', 'branch_manager', 'driver'])
  if (!user.role || !allowedRoles.has(user.role)) {
    redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')
  }

  const supabase = await createClient()
  const today    = new Date().toISOString().split('T')[0]

  // Active delivery orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ordersRaw } = await (supabase as any)
    .from('orders')
    .select(`
      id, order_number, status, customer_name, customer_phone,
      branch_id, notes, source, total_bhd, created_at, updated_at,
      assigned_driver_id,
      order_items(id)
    `)
    .in('status', ['accepted', 'preparing', 'ready', 'out_for_delivery'])
    .order('created_at', { ascending: true })

  // Completed today (for metrics + per-driver count)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: completedRaw } = await (supabase as any)
    .from('orders')
    .select('id, total_bhd, created_at, assigned_driver_id')
    .in('status', ['delivered', 'completed'])
    .gte('created_at', today)

  // Drivers (staff with role='driver', active)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: driversRaw } = await (supabase as any)
    .from('staff_basic')
    .select('id, name, phone, branch_id')
    .eq('role', 'driver')
    .eq('is_active', true)

  // Latest driver locations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: locationsRaw } = await (supabase as any)
    .from('driver_locations')
    .select('driver_id, lat, lng, created_at')
    .order('created_at', { ascending: false })

  // Build driver location map (latest per driver)
  const locationMap = new Map<string, { lat: number; lng: number }>()
  for (const loc of (locationsRaw ?? []) as { driver_id: string; lat: number; lng: number }[]) {
    if (!locationMap.has(loc.driver_id)) locationMap.set(loc.driver_id, { lat: loc.lat, lng: loc.lng })
  }

  // Build driver → current order map
  const driverOrderMap = new Map<string, string>()
  for (const o of (ordersRaw ?? []) as { assigned_driver_id: string | null; id: string; status: string }[]) {
    if (o.assigned_driver_id && o.status === 'out_for_delivery') {
      driverOrderMap.set(o.assigned_driver_id, o.id)
    }
  }

  // Completed today per driver
  const driverCompletedMap = new Map<string, number>()
  for (const o of (completedRaw ?? []) as { assigned_driver_id: string | null }[]) {
    if (o.assigned_driver_id) {
      driverCompletedMap.set(o.assigned_driver_id, (driverCompletedMap.get(o.assigned_driver_id) ?? 0) + 1)
    }
  }

  const drivers: Driver[] = (driversRaw ?? []).map((d: {
    id: string; name: string; phone: string | null; branch_id: string | null
  }) => ({
    id:               d.id,
    name:             d.name,
    phone:            d.phone,
    status:           driverOrderMap.has(d.id) ? 'delivering' : 'available',
    location:         locationMap.get(d.id) ?? null,
    current_order_id: driverOrderMap.get(d.id) ?? null,
    completed_today:  driverCompletedMap.get(d.id) ?? 0,
    branch_id:        d.branch_id,
  })) as Driver[]

  const orders: DeliveryOrder[] = (ordersRaw ?? []).map((o: {
    id: string; order_number: string; status: string; customer_name: string | null
    customer_phone: string | null; branch_id: string; notes: string | null; source: string
    total_bhd: number; created_at: string; updated_at: string; assigned_driver_id: string | null
    order_items: unknown[]
  }) => {
    const driver = drivers.find(d => d.id === o.assigned_driver_id)
    return {
      id:               o.id,
      order_number:     o.order_number,
      status:           o.status as DeliveryOrder['status'],
      customer_name:    o.customer_name,
      customer_phone:   o.customer_phone,
      customer_address: null,
      customer_location:null,
      branch_id:        o.branch_id,
      driver_id:        o.assigned_driver_id,
      driver_name:      driver?.name ?? null,
      driver_phone:     driver?.phone ?? null,
      items_count:      Array.isArray(o.order_items) ? o.order_items.length : 0,
      total_bhd:        o.total_bhd,
      notes:            o.notes,
      source:           o.source,
      created_at:       o.created_at,
      updated_at:       o.updated_at,
    }
  })

  const completed = (completedRaw ?? []) as { total_bhd: number }[]
  const revenueToday  = completed.reduce((s, o) => s + (Number(o.total_bhd) || 0), 0)
  const inTransit     = orders.filter(o => o.status === 'out_for_delivery').length
  const nowMs         = Date.now()
  const lateCount     = orders.filter(o => {
    const ageMin = (nowMs - new Date(o.created_at).getTime()) / 60_000
    return ageMin > 45
  }).length

  return (
    <div className={ibmPlex.className} style={{ fontFamily: 'IBM Plex Sans Arabic, sans-serif' }}>
      <DeliveryPageClient
        initialOrders={orders}
        initialDrivers={drivers}
        initialMetrics={{
          revenue_today:   revenueToday,
          orders_total:    orders.length,
          in_transit:      inTransit,
          completed_today: completed.length,
          late_count:      lateCount,
          revenue_delta:   0,
          orders_delta:    0,
        }}
        locale={locale}
        branchId={user.branch_id}
      />
    </div>
  )
}
