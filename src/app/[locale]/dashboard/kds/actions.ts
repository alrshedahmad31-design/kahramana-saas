'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getDashboardGuardErrorMessage, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { canAccessKDS, canUpdateOrderStatus } from '@/lib/auth/rbac'
import { toSafeError } from '@/lib/utils/safe-error'
import type { OrderStatus, KDSStation, KDSItemStatus, KDSOrder } from '@/lib/supabase/custom-types'

// Migration 089's UNIQUE(item_id) made order_items → order_item_station_status
// a 1:1 relation; PostgREST returns it as an object, not an array.
type StationStatusRow = { 
  status: KDSItemStatus | null; 
  station: KDSStation; 
  created_at: string | null;
  station_assigned_at?: string | null;
  bumped_at?: string | null;
};
function pickStationRow(
  raw: StationStatusRow | StationStatusRow[] | null | undefined,
  station: KDSStation,
): StationStatusRow | undefined {
  if (!raw) return undefined
  if (Array.isArray(raw)) return raw.find(r => r.station === station)
  return raw.station === station ? raw : undefined
}

export type AdvanceResult = { success: true } | { success: false; error: string }

const ADVANCE: Partial<Record<OrderStatus, OrderStatus>> = {
  accepted:  'preparing',
  preparing: 'ready',
  ready:     'completed',
}

export async function advanceOrderStatus(
  orderId:       string,
  currentStatus: OrderStatus,
): Promise<AdvanceResult> {
  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) {
    return { success: false, error: 'Unauthorized: KDS access restricted' }
  }

  const nextStatus = ADVANCE[currentStatus]
  if (!nextStatus) return { success: false, error: `Cannot advance from ${currentStatus} status` }

  const supabase = await createServiceClient()
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, branch_id, status, order_type')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) return { success: false, error: 'Order not found' }
  if (order.status !== currentStatus) {
    return { success: false, error: 'Order status changed. Refresh and try again.' }
  }
  if (!canUpdateOrderStatus(caller, order, nextStatus)) {
    return { success: false, error: 'Unauthorized: Insufficient permissions to change status' }
  }

  if (currentStatus === 'ready' && order.order_type === 'delivery') {
    return { success: false, error: 'Delivery orders must be handled by a driver.' }
  }

  const { error } = await supabase
    .from('orders')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', currentStatus)
    .select('id')
    .single()

  if (error) return { success: false, error: toSafeError(error) }
  return { success: true }
}

// Server-side transition validation — must match the RPC graph in
// migration 094 (pending→preparing→ready→completed and completed→ready recall).
const ITEM_STATUS_TRANSITIONS: Record<KDSItemStatus, readonly KDSItemStatus[]> = {
  pending:   ['preparing'],
  preparing: ['ready'],
  ready:     ['completed'],
  completed: ['ready'],
}
function isLegalItemTransition(from: KDSItemStatus, to: KDSItemStatus): boolean {
  return ITEM_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export async function updateItemStatus(
  orderId:        string,
  itemId:         string,
  station:        KDSStation,
  status:         KDSItemStatus,
  expectedStatus?: KDSItemStatus,
): Promise<AdvanceResult> {
  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) {
    return { success: false, error: 'Unauthorized: KDS access restricted' }
  }

  // Pre-flight transition validation: short-circuit obvious illegal jumps so
  // the user gets a clear error instead of a generic RPC failure. The RPC
  // re-validates against the actual stored status (defence in depth).
  if (expectedStatus && !isLegalItemTransition(expectedStatus, status)) {
    return { success: false, error: `Illegal transition: ${expectedStatus} → ${status}` }
  }

  const service = await createServiceClient()

  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isGlobal) {
    const { data: order, error: fetchErr } = await service
      .from('orders')
      .select('branch_id')
      .eq('id', orderId)
      .single()
    if (fetchErr || !order) return { success: false, error: 'Order not found' }
    if (order.branch_id !== caller.branch_id) {
      return { success: false, error: 'Unauthorized: Order belongs to a different branch' }
    }
  }

  // User-context client so the RPC's auth_user_role()/auth_user_branch_id()
  // resolve from the cookie JWT. The RPC (migration 094) enforces:
  //   - role whitelist (kitchen, branch_manager, general_manager, owner)
  //   - server-side transition graph
  //   - p_expected_status optimistic-concurrency check
  const userClient = await createClient()
  const { error } = await userClient.rpc('update_order_item_station_status', {
    p_order_id:        orderId,
    p_item_id:         itemId,
    p_station:         station,
    p_status:          status,
    p_expected_status: expectedStatus ?? undefined,
  })

  if (error) {
    console.error('[KDS Action] update_order_item_station_status error:', error);
    return { success: false, error: toSafeError(error) };
  }
  return { success: true }
}

export async function bumpStationOrder(
  orderId: string,
  station: KDSStation,
): Promise<AdvanceResult> {
  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) return { success: false, error: 'Unauthorized' }

  console.log(`[KDS Action] bumpStationOrder: fetching order branch_id for validation...`);
  const service = await createServiceClient()
  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isGlobal) {
    const { data: order, error: fetchErr } = await service
      .from('orders').select('branch_id').eq('id', orderId).single()
    if (fetchErr || !order) {
      console.error('[KDS Action] Order not found for validation:', fetchErr);
      return { success: false, error: 'Order not found' }
    }
    if (order.branch_id !== caller.branch_id) {
      console.warn('[KDS Action] Branch mismatch:', { order: order.branch_id, caller: caller.branch_id });
      return { success: false, error: 'Unauthorized: Order belongs to a different branch' }
    }
  }

  console.log(`[KDS Action] Executing bump_station_order RPC for ${orderId} / ${station}...`);
  const userClient = await createClient()
  const { error } = await userClient.rpc('bump_station_order', {
    p_order_id: orderId,
    p_station:  station,
  })

  if (error) {
    console.error('[KDS Action] bump_station_order error:', error);
    return { success: false, error: toSafeError(error) };
  }
  return { success: true }
}

export async function recallStationOrder(
  orderId: string,
  station: KDSStation,
): Promise<AdvanceResult> {
  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) return { success: false, error: 'Unauthorized' }

  const service = await createServiceClient()
  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isGlobal) {
    const { data: order, error: fetchErr } = await service
      .from('orders').select('branch_id').eq('id', orderId).single()
    if (fetchErr || !order) return { success: false, error: 'Order not found' }
    if (order.branch_id !== caller.branch_id)
      return { success: false, error: 'Unauthorized: Order belongs to a different branch' }
  }

  // User-context client — see bumpStationOrder for rationale.
  const userClient = await createClient()
  const { error } = await userClient.rpc('recall_station_order', {
    p_order_id: orderId,
    p_station:  station,
  })

  if (error) return { success: false, error: toSafeError(error) }
  return { success: true }
}

export async function getStationDailyCount(
  station: KDSStation,
  branchId: string,
): Promise<{ count: number } | { error: string }> {
  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) return { error: 'Unauthorized' }

  // P1-18: clamp branchId to caller.branch_id for non-global roles to prevent
  // attacker-controlled branch lookup from a kitchen-scoped role.
  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  const effectiveBranchId = isGlobal ? branchId : (caller.branch_id ?? null)
  if (!effectiveBranchId) return { error: 'Staff not assigned to a branch' }

  const userClient = await createClient()
  const { data, error } = await userClient.rpc('get_station_daily_count', {
    p_station:   station,
    p_branch_id: effectiveBranchId,
  })

  if (error) return { error: toSafeError(error) }
  return { count: data ?? 0 }
}

export async function fetchStationOrders(
  station: KDSStation,
): Promise<{ active: KDSOrder[]; stalled: KDSOrder[] } | { error: string }> {
  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) return { error: 'Unauthorized' }

  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isGlobal && !caller.branch_id) return { error: 'Staff not assigned to a branch' }

  const supabase = await createServiceClient()

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

  if (!isGlobal) query = query.eq('branch_id', caller.branch_id!)

  const { data, error } = await query
  if (error) return { error: toSafeError(error) }

  const orders = (data ?? []).map((order) => {
    const stationItems = (order.order_items ?? [])
      .map(item => {
        const statusRow = pickStationRow(
          item.order_item_station_status as StationStatusRow | StationStatusRow[] | null,
          station,
        )
        return { item, statusRow }
      })
      .filter(({ statusRow }) => !!statusRow && statusRow.status !== 'completed')
      .map(({ item, statusRow }) => ({
        ...item,
        station_status:      (statusRow?.status ?? undefined) as KDSItemStatus | undefined,
        station_assigned_at: statusRow?.created_at ?? null,
        bumped_at:           null,
      }))
    return { ...order, order_items: stationItems } as unknown as KDSOrder
  }).filter(order => order.order_items.length > 0)

  // Split into active and stalled (older than 3 hours)
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const active  = orders.filter(o => new Date(o.created_at) >= threeHoursAgo)
  const stalled = orders.filter(o => new Date(o.created_at) < threeHoursAgo)

  return { active, stalled }
}
