import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canAccessKDS } from '@/lib/auth/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { KDSStationSelector } from '@/components/kds/KDSStationSelector'
import KDSStationBoard from '@/components/kds/KDSStationBoard'
import type { KDSOrder, KDSStation, KDSItemStatus } from '@/lib/supabase/custom-types'
import { ALL_STATIONS } from '@/lib/kds/constants'
import { HIDDEN_BRANCHES } from '@/constants/contact'

// Migration 089 added UNIQUE(item_id) to order_item_station_status, which
// PostgREST detects as a 1:1 relationship and returns as a single object
// instead of an array. Older deployments may still return an array. This
// helper normalises both shapes and returns the row matching the station.
type StationStatusRow = { status: KDSItemStatus | null; station: KDSStation; created_at: string | null }
function pickStationRow(
  raw: StationStatusRow | StationStatusRow[] | null | undefined,
  station: KDSStation,
): StationStatusRow | undefined {
  if (!raw) return undefined
  if (Array.isArray(raw)) return raw.find(r => r.station === station)
  return raw.station === station ? raw : undefined
}

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

  const supabase = await createServiceClient()


  if (!activeStation) {
    // FIX 9: per-station active-item counts (pending + preparing) for the selector.
    let countsQuery = supabase
      .from('order_item_station_status')
      .select('station')
      .in('status', ['pending', 'preparing'])

    if (!isGlobalKitchenViewer) {
      countsQuery = countsQuery.eq('branch_id', user.branch_id!)
    } else if (HIDDEN_BRANCHES.length > 0) {
      countsQuery = countsQuery.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
    }

    const { data: countRows } = await countsQuery
    const stationCounts: Partial<Record<KDSStation, number>> = {}
    for (const row of countRows ?? []) {
      const s = row.station as KDSStation
      stationCounts[s] = (stationCounts[s] ?? 0) + 1
    }

    return (
      <div className="min-h-screen bg-brand-black">
        <KDSStationSelector stationCounts={stationCounts} />
      </div>
    )
  }

  let query = supabase
    .from('orders')
    .select(`
      id, branch_id, status, order_type, source, table_number, created_at, updated_at, notes, customer_name,
      order_items(
        id, name_ar, name_en, quantity, selected_size, selected_variant, menu_item_slug, notes, modifiers,
        order_item_station_status(status, station, created_at)
      )
    `)
    .in('status', ['accepted', 'preparing', 'ready'])
    .order('created_at', { ascending: true })
    .limit(100)

  // S1: Always apply branch filter for non-global roles
  if (!isGlobalKitchenViewer) {
    query = query.eq('branch_id', user.branch_id!)
  } else if (HIDDEN_BRANCHES.length > 0) {
    query = query.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
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
      .map(item => {
        const statusRow = pickStationRow(
          item.order_item_station_status as StationStatusRow | StationStatusRow[] | null,
          activeStation,
        )
        return { item, statusRow }
      })
      .filter(({ statusRow }) => !!statusRow && statusRow.status !== 'completed')
      .map(({ item, statusRow }) => ({
        ...item,
        station_status:       statusRow?.status ?? undefined,
        station_assigned_at:  statusRow?.created_at ?? null,
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
