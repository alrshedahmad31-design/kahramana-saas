import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  requireDashboardSection,
  isDashboardGuardError,
} from '@/lib/auth/dashboard-guards'
import { createClient } from '@/lib/supabase/server'
import { KDSStationSelector } from '@/components/kds/KDSStationSelector'
import KDSStationBoard from '@/components/kds/KDSStationBoard'
import type { KDSOrder, KDSStation, KDSItemStatus } from '@/lib/supabase/custom-types'
import { ALL_STATIONS } from '@/lib/kds/constants'
import { toSafeError } from '@/lib/utils/safe-error'

// Migration 089 added UNIQUE(item_id) to order_item_station_status, which
// PostgREST detects as a 1:1 relationship and returns as a single object
// instead of an array. Older deployments may still return an array. This
// helper normalises both shapes and returns the row matching the station.
type StationStatusRow = { 
  status: KDSItemStatus | null; 
  station: KDSStation; 
  created_at: string | null;
  bumped_at?: string | null;
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

  // P1-16: unified RBAC surface — same gate as other dashboard sections.
  let user
  try {
    user = await requireDashboardSection('kds')
  } catch (e) {
    if (isDashboardGuardError(e)) redirect(`/${locale}/dashboard`)
    throw e
  }

  const isGlobalKitchenViewer = user.role === 'owner' || user.role === 'general_manager'

  // S1: Non-global staff must be assigned to a branch
  if (!isGlobalKitchenViewer && !user.branch_id) {
    redirect(`/${locale}/dashboard`)
  }

  // P1-17: anon client — RLS on kds tables is branch-scoped; manual .eq()
  // below is kept as defense-in-depth.
  const supabase = await createClient()


  if (!activeStation) {
    // Per-station active-item counts for the selector chips.
    // Two filters must agree with the inner station board (below):
    //   • item-level: order_item_station_status.status IN (pending, preparing)
    //   • order-level: orders.status IN (accepted, preparing, ready)
    // Without the order-level join, items whose parent order is terminal
    // (cancelled / delivered) but somehow still 'pending' would inflate
    // chip counts and route the operator into an empty station view.
    // Migration 161 adds a DB trigger that prevents the latter going
    // forward; this embed is defense in depth so selector and board
    // never disagree even if the trigger misses an edge case.
    let countsQuery = supabase
      .from('order_item_station_status')
      .select('station, orders!inner(status)')
      .in('status', ['pending', 'preparing'])
      .in('orders.status', ['accepted', 'preparing', 'ready'])

    if (!isGlobalKitchenViewer) {
      countsQuery = countsQuery.eq('branch_id', user.branch_id!)
    }

    const { data: countRows, error: countsError } = await countsQuery
    if (countsError) {
      // Log + render selector with empty counts so the operator can still
      // navigate. Hiding the error would make a DB/RLS failure look like
      // "no work to do".
      console.error('[kds] station counts query failed:', countsError)
    }
    const stationCounts: Partial<Record<KDSStation, number>> = {}
    for (const row of countRows ?? []) {
      const s = row.station as KDSStation
      stationCounts[s] = (stationCounts[s] ?? 0) + 1
    }

    const showMobileKDSLink = user.role === 'owner' || user.role === 'general_manager'
    const mobilePrefix = locale === 'en' ? '/en' : ''
    return (
      <div className="min-h-screen bg-brand-black relative">
        {showMobileKDSLink && (
          <Link
            href={`${mobilePrefix}/kds`}
            className="absolute top-4 end-4 z-10 inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-brand-gold/40 bg-brand-surface/60 text-brand-gold text-xs font-bold uppercase tracking-wider hover:bg-brand-gold hover:text-brand-black transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <rect x="5" y="2" width="14" height="20" rx="2.5" />
              <line x1="12" y1="18" x2="12" y2="18.01" />
            </svg>
            {locale === 'ar' ? 'عرض الجوال' : 'Mobile KDS'}
          </Link>
        )}
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
  }

  const { data, error } = await query
  const branchId = isGlobalKitchenViewer ? null : (user.branch_id ?? null)
  const initialNow = Date.now()

  // B1: Surface DB errors to the board instead of silently showing empty state
  if (error) {
    return (
      <div className="h-screen overflow-hidden bg-brand-black">
        <KDSStationBoard
          initialActive={[]}
        initialStalled={[]}
          station={activeStation}
          branchId={branchId}
          locale={locale}
          loadError={toSafeError(error)}
          initialNow={initialNow}
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
        bumped_at:            null,
      }))
    return { ...order, order_items: stationItems } as unknown as KDSOrder
  }).filter(order => order.order_items.length > 0)
  // Split into active and stalled (older than 3 hours)
  const threeHoursAgo = new Date(initialNow - 3 * 60 * 60 * 1000)
  const initialActive  = normalizedOrders.filter(o => new Date(o.created_at) >= threeHoursAgo)
  const initialStalled = normalizedOrders.filter(o => new Date(o.created_at) < threeHoursAgo)

  return (
    <div className="h-screen overflow-hidden bg-brand-black">
      <KDSStationBoard
        initialActive={initialActive}
        initialStalled={initialStalled}
        station={activeStation}
        branchId={branchId}
        locale={locale}
        initialNow={initialNow}
      />
    </div>
  )
}
