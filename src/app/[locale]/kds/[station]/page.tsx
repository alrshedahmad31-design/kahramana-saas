import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ALL_STATIONS } from '@/lib/kds/constants'
import type { KDSOrder, KDSStation, KDSItemStatus } from '@/lib/supabase/custom-types'
import SingleStationView from './SingleStationView'

// Mirrors the helper in /dashboard/kds/page.tsx. Migration 089 added
// UNIQUE(item_id) on order_item_station_status, which PostgREST exposes as
// a 1:1 — so the embedded relation may arrive as a single object or an
// array depending on deployment age. Normalise both shapes.
type StationStatusRow = {
  status:     KDSItemStatus | null
  station:    KDSStation
  created_at: string | null
  bumped_at?: string | null
}
function pickStationRow(
  raw: StationStatusRow | StationStatusRow[] | null | undefined,
  station: KDSStation,
): StationStatusRow | undefined {
  if (!raw) return undefined
  if (Array.isArray(raw)) return raw.find(r => r.station === station)
  return raw.station === station ? raw : undefined
}

interface Props {
  params: Promise<{ locale: string; station: string }>
}

export const dynamic = 'force-dynamic'

export default async function MobileSingleStationPage({ params }: Props) {
  const { locale, station } = await params
  const prefix = locale === 'en' ? '/en' : ''

  // Validate station param against the canonical enum before anything else;
  // also exclude `unassigned` so cooks never land on a queue they don't own.
  if (station === 'unassigned' || !ALL_STATIONS.includes(station as KDSStation)) {
    redirect(`${prefix}/kds`)
  }
  const activeStation = station as KDSStation

  // Layout already enforces the role gate; session here is just for branch scope.
  const user = await getSession()
  const isGlobalKitchenViewer = user?.role === 'owner' || user?.role === 'general_manager'
  const branchId = isGlobalKitchenViewer ? null : (user?.branch_id ?? null)

  if (!isGlobalKitchenViewer && !branchId) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

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

  if (!isGlobalKitchenViewer && branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query
  const initialNow = Date.now()

  if (error) {
    return (
      <SingleStationView
        initialOrders={[]}
        station={activeStation}
        branchId={branchId}
        locale={locale}
        initialNow={initialNow}
        loadError={error.message || 'Failed to load orders'}
      />
    )
  }

  const rawOrders = data ?? []
  const normalizedOrders: KDSOrder[] = rawOrders
    .map(order => {
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
          bumped_at:            null,
        }))
      return { ...order, order_items: stationItems } as unknown as KDSOrder
    })
    .filter(order => order.order_items.length > 0)

  return (
    <SingleStationView
      initialOrders={normalizedOrders}
      station={activeStation}
      branchId={branchId}
      locale={locale}
      initialNow={initialNow}
    />
  )
}
