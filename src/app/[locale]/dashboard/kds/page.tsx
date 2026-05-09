import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canAccessKDS } from '@/lib/auth/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { KDSStationSelector } from '@/components/kds/KDSStationSelector'
import KDSStationBoard from '@/components/kds/KDSStationBoard'
import type { KDSOrder, KDSStation } from '@/lib/supabase/custom-types'
import { ALL_STATIONS } from '@/lib/kds/constants'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ station?: string }>
}

export const dynamic = 'force-dynamic'

export default async function KDSPage({ params, searchParams }: Props) {
  const { locale } = await params

  // S2: Validate station against known enum values — never trust raw URL params
  const rawStation = (await searchParams).station
  const activeStation = ALL_STATIONS.includes(rawStation as KDSStation)
    ? (rawStation as KDSStation)
    : undefined

  const user = await getSession()
  if (!user) redirect(`/${locale}/login`)
  if (!canAccessKDS(user)) redirect(`/${locale}/dashboard`)

  const isGlobalKitchenViewer = user.role === 'owner' || user.role === 'general_manager'

  // S1: Non-global staff must be assigned to a branch
  if (!isGlobalKitchenViewer && !user.branch_id) {
    redirect(`/${locale}/dashboard`)
  }

  if (!activeStation) {
    return (
      <div className="min-h-screen bg-brand-black">
        <KDSStationSelector />
      </div>
    )
  }

  const supabase = await createServiceClient()

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
    .limit(100)

  // S1: Always apply branch filter for non-global roles
  if (!isGlobalKitchenViewer) {
    query = query.eq('branch_id', user.branch_id!)
  }

  const { data, error } = await query
  const branchId = isGlobalKitchenViewer ? null : (user.branch_id ?? null)

  // B1: Surface DB errors to the board instead of silently showing empty state
  if (error) {
    return (
      <div className="h-screen overflow-hidden bg-brand-black">
        <KDSStationBoard
          initialOrders={[]}
          station={activeStation}
          branchId={branchId}
          locale={locale}
          loadError={error.message}
        />
      </div>
    )
  }

  const rawOrders = data ?? []

  // Normalize: filter items to active station, exclude bumped (completed) items
  const normalizedOrders = rawOrders.map(order => {
    const stationItems = order.order_items
      .filter(item => {
        const statusRow = item.order_item_station_status?.find(s => s.station === activeStation)
        return !!statusRow && statusRow.status !== 'completed'
      })
      .map(item => ({
        ...item,
        station_status: item.order_item_station_status?.find(s => s.station === activeStation)?.status,
      }))
    return { ...order, order_items: stationItems } as unknown as KDSOrder
  }).filter(order => order.order_items.length > 0)

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
