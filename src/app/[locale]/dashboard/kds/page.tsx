import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canAccessKDS } from '@/lib/auth/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { KDSStationSelector } from '@/components/kds/KDSStationSelector'
import KDSStationBoard from '@/components/kds/KDSStationBoard'
import type { KDSOrder, KDSStation } from '@/lib/supabase/custom-types'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ station?: string }>
}

export const dynamic = 'force-dynamic'

export default async function KDSPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { station: activeStation } = (await searchParams) as { station?: KDSStation }

  const user = await getSession()
  if (!user) redirect(`/${locale}/login`)
  if (!canAccessKDS(user)) redirect(`/${locale}/dashboard`)

  const supabase = await createServiceClient()
  const isGlobalKitchenViewer = user.role === 'owner' || user.role === 'general_manager'

  // D-C7: explicit columns only — exclude customer PII (phone, address, total, coupon, etc.)
  let query = supabase
    .from('orders')
    .select(`
      id, branch_id, status, order_type, source, created_at, updated_at, notes, customer_name,
      order_items(
        id, name_ar, name_en, quantity, selected_size, selected_variant, menu_item_slug, notes,
        order_item_station_status(status, station)
      )
    `)
    .in('status', ['accepted', 'preparing', 'ready'])
    .order('created_at', { ascending: true })

  if (!isGlobalKitchenViewer && user.branch_id) {
    query = query.eq('branch_id', user.branch_id)
  }

  const { data } = await query

  // slugStationMap and slugStockMap are only used by the legacy KDSBoard (full overview).
  // KDSStationBoard filters via order_item_station_status join — no table lookup needed.

  // Normalize orders for the selected station if applicable
  const rawOrders = data ?? []
  
  const normalizedOrders = rawOrders.map(order => {
    // If no active station, return full order
    if (!activeStation) return order as unknown as KDSOrder

    // Filter items to only those belonging to this station
    const stationItems = order.order_items.filter(item => {
      const status = item.order_item_station_status?.find(s => s.station === activeStation)
      return !!status
    }).map(item => ({
      ...item,
      station_status: item.order_item_station_status?.find(s => s.station === activeStation)?.status
    }))

    return { ...order, order_items: stationItems } as unknown as KDSOrder
  }).filter(order => !activeStation || order.order_items.length > 0)

  if (!activeStation) {
    return (
      <div className="min-h-screen bg-brand-black">
        <KDSStationSelector />
      </div>
    )
  }

  const branchId = isGlobalKitchenViewer ? null : (user.branch_id ?? null)

  return (
    <div className="h-screen overflow-hidden bg-brand-black">
      <KDSStationBoard
        initialOrders={normalizedOrders}
        station={activeStation}
        branchId={branchId}
        locale={locale}
      />
    </div>
  )
}
