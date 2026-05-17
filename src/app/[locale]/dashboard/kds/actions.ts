'use server'

import * as Sentry from '@sentry/nextjs'
import { getTranslations } from 'next-intl/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getDashboardGuardErrorMessage, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { canAccessKDS, canUpdateOrderStatus } from '@/lib/auth/rbac'
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

type RpcOrderStatusResult =
  | { ok: true;  status: OrderStatus }
  | { ok: false; code: string }

function isRpcOrderResult(value: unknown): value is RpcOrderStatusResult {
  return typeof value === 'object' && value !== null && 'ok' in value
}

export async function advanceOrderStatus(
  orderId:       string,
  currentStatus: OrderStatus,
): Promise<AdvanceResult> {
  const t = await getTranslations('kds.errors')

  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) {
    return { success: false, error: t('accessRestricted') }
  }

  const nextStatus = ADVANCE[currentStatus]
  if (!nextStatus) return { success: false, error: t('cannotAdvance', { status: currentStatus }) }

  // Service-role read for the pre-RPC snapshot — RLS would block kitchen/
  // branch_manager from reading orders outside their station's status set.
  const service = await createServiceClient()
  const { data: order, error: fetchError } = await service
    .from('orders')
    .select('id, branch_id, status, order_type')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) return { success: false, error: t('orderNotFound') }
  if (order.status !== currentStatus) {
    return { success: false, error: t('stale') }
  }
  if (!canUpdateOrderStatus(caller, order, nextStatus)) {
    return { success: false, error: t('insufficientPermissions') }
  }

  if (currentStatus === 'ready' && order.order_type === 'delivery') {
    return { success: false, error: t('deliveryDriverOnly') }
  }

  // Atomic: rpc_update_order_status (migration 165) re-checks role / branch /
  // transition / refund-block / optimistic-concurrency + writes audit_logs in
  // the same transaction. JS guards above stay as pre-flight UX.
  const authClient = await createClient()
  const { data: rpcRaw, error: rpcError } = await authClient.rpc('rpc_update_order_status', {
    p_order_id:        orderId,
    p_new_status:      nextStatus,
    p_expected_status: currentStatus,
  })

  if (rpcError) {
    Sentry.captureException(rpcError, {
      tags:  { area: 'kds', action: 'advanceOrderStatus' },
      extra: { orderId, currentStatus, nextStatus },
    })
    return { success: false, error: t('rpcFailed') }
  }

  const rpc = isRpcOrderResult(rpcRaw) ? rpcRaw : null
  if (!rpc) {
    Sentry.captureException(new Error('rpc_update_order_status unexpected payload'), {
      tags:  { area: 'kds', action: 'advanceOrderStatus' },
      extra: { orderId, payload: rpcRaw },
    })
    return { success: false, error: t('rpcFailed') }
  }
  if (!rpc.ok) {
    // Map RPC error codes to user-facing keys. Unknown codes fall back to
    // the generic message — but we capture them so we can extend the map.
    switch (rpc.code) {
      case 'not_found':            return { success: false, error: t('orderNotFound') }
      case 'forbidden_branch':     return { success: false, error: t('wrongBranch') }
      case 'forbidden_transition': return { success: false, error: t('insufficientPermissions') }
      case 'conflict':             return { success: false, error: t('stale') }
      default:
        Sentry.captureException(new Error(`rpc_update_order_status unknown code: ${rpc.code}`), {
          tags:  { area: 'kds', action: 'advanceOrderStatus' },
          extra: { orderId, rpcCode: rpc.code },
        })
        return { success: false, error: t('rpcFailed') }
    }
  }

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
  const t = await getTranslations('kds.errors')

  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) {
    return { success: false, error: t('accessRestricted') }
  }

  // Pre-flight transition validation: short-circuit obvious illegal jumps so
  // the user gets a clear error instead of a generic RPC failure. The RPC
  // re-validates against the actual stored status (defence in depth).
  if (expectedStatus && !isLegalItemTransition(expectedStatus, status)) {
    return { success: false, error: t('illegalTransition', { from: expectedStatus, to: status }) }
  }

  const service = await createServiceClient()

  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isGlobal) {
    const { data: order, error: fetchErr } = await service
      .from('orders')
      .select('branch_id')
      .eq('id', orderId)
      .single()
    if (fetchErr || !order) return { success: false, error: t('orderNotFound') }
    if (order.branch_id !== caller.branch_id) {
      return { success: false, error: t('wrongBranch') }
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
    Sentry.captureException(error, {
      tags:  { area: 'kds', action: 'updateItemStatus' },
      extra: { orderId, itemId, station, status, expectedStatus },
    })
    return { success: false, error: t('rpcFailed') }
  }
  return { success: true }
}

export async function bumpStationOrder(
  orderId: string,
  station: KDSStation,
): Promise<AdvanceResult> {
  const t = await getTranslations('kds.errors')

  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) return { success: false, error: t('unauthorized') }

  const service = await createServiceClient()
  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isGlobal) {
    const { data: order, error: fetchErr } = await service
      .from('orders').select('branch_id').eq('id', orderId).single()
    if (fetchErr || !order) {
      return { success: false, error: t('orderNotFound') }
    }
    if (order.branch_id !== caller.branch_id) {
      return { success: false, error: t('wrongBranch') }
    }
  }

  const userClient = await createClient()
  const { error } = await userClient.rpc('bump_station_order', {
    p_order_id: orderId,
    p_station:  station,
  })

  if (error) {
    Sentry.captureException(error, {
      tags:  { area: 'kds', action: 'bumpStationOrder' },
      extra: { orderId, station },
    })
    return { success: false, error: t('rpcFailed') }
  }
  return { success: true }
}

export async function recallStationOrder(
  orderId: string,
  station: KDSStation,
): Promise<AdvanceResult> {
  const t = await getTranslations('kds.errors')

  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { success: false, error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) return { success: false, error: t('unauthorized') }

  const service = await createServiceClient()
  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isGlobal) {
    const { data: order, error: fetchErr } = await service
      .from('orders').select('branch_id').eq('id', orderId).single()
    if (fetchErr || !order) return { success: false, error: t('orderNotFound') }
    if (order.branch_id !== caller.branch_id)
      return { success: false, error: t('wrongBranch') }
  }

  // User-context client — see bumpStationOrder for rationale.
  const userClient = await createClient()
  const { error } = await userClient.rpc('recall_station_order', {
    p_order_id: orderId,
    p_station:  station,
  })

  if (error) {
    Sentry.captureException(error, {
      tags:  { area: 'kds', action: 'recallStationOrder' },
      extra: { orderId, station },
    })
    return { success: false, error: t('rpcFailed') }
  }
  return { success: true }
}

export async function getStationDailyCount(
  station: KDSStation,
  branchId: string,
): Promise<{ count: number } | { error: string }> {
  const t = await getTranslations('kds.errors')

  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) return { error: t('unauthorized') }

  // P1-18: clamp branchId to caller.branch_id for non-global roles to prevent
  // attacker-controlled branch lookup from a kitchen-scoped role.
  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  const effectiveBranchId = isGlobal ? branchId : (caller.branch_id ?? null)
  if (!effectiveBranchId) return { error: t('noBranch') }

  const userClient = await createClient()
  const { data, error } = await userClient.rpc('get_station_daily_count', {
    p_station:   station,
    p_branch_id: effectiveBranchId,
  })

  if (error) {
    Sentry.captureException(error, {
      tags:  { area: 'kds', action: 'getStationDailyCount' },
      extra: { station, branchId: effectiveBranchId },
    })
    return { error: t('rpcFailed') }
  }
  return { count: data ?? 0 }
}

export async function fetchStationOrders(
  station: KDSStation,
): Promise<{ active: KDSOrder[]; stalled: KDSOrder[] } | { error: string }> {
  const t = await getTranslations('kds.errors')

  let caller
  try {
    caller = await requireDashboardSession()
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (!canAccessKDS(caller)) return { error: t('unauthorized') }

  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isGlobal && !caller.branch_id) return { error: t('noBranch') }

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
  if (error) {
    Sentry.captureException(error, {
      tags:  { area: 'kds', action: 'fetchStationOrders' },
      extra: { station, scope: isGlobal ? 'global' : caller.branch_id },
    })
    return { error: t('rpcFailed') }
  }

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
