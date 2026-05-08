'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardGuardErrorMessage, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { canAccessKDS, canUpdateOrderStatus } from '@/lib/auth/rbac'
import type { OrderStatus, KDSStation, KDSItemStatus, KDSOrder } from '@/lib/supabase/custom-types'

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

  // Guard: Delivery orders cannot be completed by kitchen
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
  itemId: string,
  station: KDSStation,
  status: KDSItemStatus
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

  // C3: Branch ownership check — mirror advanceOrderStatus pattern
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
    p_item_id: itemId,
    p_station: station,
    p_status: status
  })

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

  const supabase = await createServiceClient()
  const isGlobal = caller.role === 'owner' || caller.role === 'general_manager'

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

  if (!isGlobal && caller.branch_id) {
    query = query.eq('branch_id', caller.branch_id)
  }

  const { data, error } = await query
  if (error) return { error: error.message }

  const orders = (data ?? []).map((order) => {
    const stationItems = (order.order_items ?? [])
      .filter(item =>
        item.order_item_station_status?.some(s => s.station === station)
      )
      .map(item => ({
        ...item,
        station_status: (item.order_item_station_status?.find(
          s => s.station === station
        )?.status ?? undefined) as KDSItemStatus | undefined,
      }))

    return { ...order, order_items: stationItems } as unknown as KDSOrder
  }).filter(order => order.order_items.length > 0)

  return { orders }
}
