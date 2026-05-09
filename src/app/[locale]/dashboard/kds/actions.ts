'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardGuardErrorMessage, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { canAccessKDS, canUpdateOrderStatus } from '@/lib/auth/rbac'
import type { OrderStatus, KDSStation, KDSItemStatus, KDSOrder } from '@/lib/supabase/custom-types'

// Migration 089's UNIQUE(item_id) made order_items → order_item_station_status
// a 1:1 relation; PostgREST returns it as an object, not an array.
type StationStatusRow = { status: KDSItemStatus | null; station: KDSStation; created_at: string | null }
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

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateItemStatus(
  orderId: string,
  itemId:  string,
  station: KDSStation,
  status:  KDSItemStatus,
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

  const supabase = await createServiceClient()

  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isGlobal) {
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('branch_id')
      .eq('id', orderId)
      .single()
    if (fetchErr || !order) return { success: false, error: 'Order not found' }
    if (order.branch_id !== caller.branch_id) {
      return { success: false, error: 'Unauthorized: Order belongs to a different branch' }
    }
  }

  const { error } = await supabase.rpc('update_order_item_station_status', {
    p_order_id: orderId,
    p_item_id:  itemId,
    p_station:  station,
    p_status:   status,
  })

  if (error) return { success: false, error: error.message }
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

  const supabase = await createServiceClient()
  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isGlobal) {
    const { data: order, error: fetchErr } = await supabase
      .from('orders').select('branch_id').eq('id', orderId).single()
    if (fetchErr || !order) return { success: false, error: 'Order not found' }
    if (order.branch_id !== caller.branch_id)
      return { success: false, error: 'Unauthorized: Order belongs to a different branch' }
  }

  const { error } = await supabase
    .from('order_item_station_status')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('station', station)

  if (error) return { success: false, error: error.message }
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

  const supabase = await createServiceClient()
  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isGlobal) {
    const { data: order, error: fetchErr } = await supabase
      .from('orders').select('branch_id').eq('id', orderId).single()
    if (fetchErr || !order) return { success: false, error: 'Order not found' }
    if (order.branch_id !== caller.branch_id)
      return { success: false, error: 'Unauthorized: Order belongs to a different branch' }
  }

  const { error } = await supabase
    .from('order_item_station_status')
    .update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('station', station)
    .eq('status', 'completed')

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function fetchStationOrders(
  station: KDSStation,
): Promise<{ orders: KDSOrder[] } | { error: string }> {
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
  if (error) return { error: error.message }

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
      }))
    return { ...order, order_items: stationItems } as unknown as KDSOrder
  }).filter(order => order.order_items.length > 0)

  return { orders }
}
