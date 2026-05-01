'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canAccessDriver } from '@/lib/auth/rbac'
import type { DriverLocationInsert } from '@/lib/supabase/custom-types'

export type DriverActionResult = { success: true } | { success: false; error: string }

// ── Bump order status (driver flow: ready → out_for_delivery → delivered) ─────

export async function driverBumpOrder(
  orderId: string,
  currentStatus: 'ready' | 'out_for_delivery',
): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || !canAccessDriver(user)) {
    return { success: false, error: 'Unauthorized' }
  }

  const nextStatus = currentStatus === 'ready' ? 'out_for_delivery' : 'delivered'
  const now        = new Date().toISOString()

  const supabase = await createClient()

  const orderUpdate: { status: typeof nextStatus; updated_at: string; assigned_driver_id?: string } = {
    status:     nextStatus,
    updated_at: now,
  }
  if (currentStatus === 'ready') orderUpdate.assigned_driver_id = user.id

  const { error } = await supabase
    .from('orders')
    .update(orderUpdate)
    .eq('id', orderId)
    .in('status', [currentStatus])

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Post GPS location update ──────────────────────────────────────────────────

export async function postDriverLocation(
  payload: DriverLocationInsert,
): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('driver_locations')
    .insert({ ...payload, driver_id: user.id })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Submit end-of-shift cash handover ─────────────────────────────────────────

export async function submitCashHandover(
  orderIds:  string[],
  totalCash: number,
): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || !canAccessDriver(user)) {
    return { success: false, error: 'Unauthorized' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  const { error } = await supabase
    .from('driver_cash_handovers')
    .insert({
      driver_id:  user.id,
      shift_date: new Date().toISOString().split('T')[0],
      total_cash: totalCash,
      order_ids:  orderIds,
    })

  if (error) return { success: false, error: error.message }
  return { success: true }
}
