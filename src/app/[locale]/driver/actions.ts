'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import type { DriverLocationInsert } from '@/lib/supabase/custom-types'
import { revalidatePath } from 'next/cache'

// Audit fix #1: driver mutations are driver-only. Managers monitor and
// dispatch from the delivery dashboard; they do not bump/arrive/fail orders
// directly. The previous broader DRIVER_ACTION_ROLES allowed branch_manager/
// GM/owner to perform driver-side mutations, which leaked accountability.
function isDriver(role: string | null | undefined): boolean {
  return role === 'driver'
}

function isManagerPlus(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'general_manager' || role === 'branch_manager'
}

export type DriverActionResult = { success: true } | { success: false; error: string }

// Audit fix #5: validate cash collection consistently — finite, non-negative,
// rounded to 3 decimals. Returns NaN to signal invalid input.
function normalizeCashAmount(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value < 0) return Number.NaN
  return Math.round(value * 1000) / 1000
}

export async function driverBumpOrder(
  orderId:       string,
  currentStatus: 'ready' | 'out_for_delivery',
  tipBhd?:       number,
  actualCollected?: number,
): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user) {
    return { success: false, error: 'Login Required' }
  }
  // Audit fix #1: driver-only (expanded to Manager+ for supervision).
  if (!isDriver(user.role) && !isManagerPlus(user.role)) {
    return { success: false, error: 'Unauthorized: Driver access only' }
  }

  const supabase = await createClient()

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, branch_id, order_type, assigned_driver_id, arrived_at')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) return { success: false, error: 'Order not found' }

  // Audit fix #3: drivers only act on delivery orders. Reject defensively
  // even though the page query already filters by order_type='delivery'.
  if (order.order_type !== 'delivery') {
    return { success: false, error: 'Order is not a delivery order' }
  }

  if (order.status !== currentStatus) {
    return { success: false, error: 'Unexpected order state' }
  }

  // Branch guard — driver must serve this order's branch (Owner/GM bypass).
  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  if (!isGlobalAdmin && (!user.branch_id || order.branch_id !== user.branch_id)) {
    return { success: false, error: 'Unauthorized: Order belongs to another branch' }
  }

  if (currentStatus === 'out_for_delivery' && order.assigned_driver_id !== user.id && !isManagerPlus(user.role)) {
    return { success: false, error: 'Unauthorized: This order is assigned to another driver' }
  }

  if (currentStatus === 'out_for_delivery' && !order.arrived_at) {
    return { success: false, error: 'Must mark as arrived before delivering' }
  }

  const nextStatus = currentStatus === 'ready' ? 'out_for_delivery' : 'delivered'
  const now        = new Date().toISOString()

  type OrderUpdate = {
    status:             typeof nextStatus
    updated_at:         string
    assigned_driver_id?: string
    picked_up_at?:      string
    delivered_at?:      string
  }
  const orderUpdate: OrderUpdate = { status: nextStatus, updated_at: now }
  if (currentStatus === 'ready') {
    orderUpdate.assigned_driver_id = user.id
    orderUpdate.picked_up_at       = now
  }
  if (currentStatus === 'out_for_delivery') {
    orderUpdate.delivered_at = now
    if (tipBhd !== undefined && tipBhd !== null && tipBhd > 0) {
      if (!Number.isFinite(tipBhd) || tipBhd > 50) {
        return { success: false, error: 'Tip exceeds maximum (50 BD) or is invalid' }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(orderUpdate as any).tip_bhd = Math.round(tipBhd * 1000) / 1000
    }
    // Audit fix #5: validate actualCollected via shared helper.
    if (actualCollected !== undefined && actualCollected !== null) {
      const normalized = normalizeCashAmount(actualCollected)
      if (normalized === null || Number.isNaN(normalized)) {
        return { success: false, error: 'Cash collected must be a non-negative finite number' }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(orderUpdate as any).actual_collected = normalized
    }
  }

  const query = supabase
    .from('orders')
    .update(orderUpdate)
    .eq('id', orderId)
    .eq('status', currentStatus)

  if (currentStatus === 'ready') {
    query.is('assigned_driver_id', null)
  }

  const { data: updatedRows, error } = await query.select('id')

  if (error) return { success: false, error: error.message }

  if (!updatedRows || updatedRows.length === 0) {
    return {
      success: false,
      error: 'Order update failed. It might have been claimed by another driver or its status changed.'
    }
  }

  return { success: true }
}

export async function markDriverArrived(orderId: string): Promise<DriverActionResult> {
  const user = await getSession()
  // Audit fix #1: driver-only (expanded to Manager+ for supervision).
  if (!user || (!isDriver(user.role) && !isManagerPlus(user.role))) return { success: false, error: 'Unauthorized' }

  const service = createServiceClient()
  const { data: order, error: fetchError } = await service
    .from('orders')
    .select('id, status, branch_id, order_type, assigned_driver_id')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) return { success: false, error: 'Order not found' }
  // Audit fix #3: delivery only.
  if (order.order_type !== 'delivery') return { success: false, error: 'Order is not a delivery order' }
  if (order.status !== 'out_for_delivery') return { success: false, error: 'Unexpected order state' }
  // Branch guard (Owner/GM bypass).
  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  if (!isGlobalAdmin && (!user.branch_id || order.branch_id !== user.branch_id)) {
    return { success: false, error: 'Unauthorized: Order belongs to another branch' }
  }
  // Only the assigned driver may mark arrival (Managers bypass).
  if (order.assigned_driver_id !== user.id && !isManagerPlus(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const now = new Date().toISOString()

  const { data: updatedRows, error } = await service
    .from('orders')
    .update({ arrived_at: now, updated_at: now })
    .eq('id', orderId)
    .select('id')

  if (error) return { success: false, error: error.message }

  if (!updatedRows || updatedRows.length === 0) {
    return {
      success: false,
      error: 'Order update failed. Status might have changed.'
    }
  }

  return { success: true }
}

export async function postDriverLocation(
  payload: DriverLocationInsert,
): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  // Audit fix #2: verify the order this location belongs to is actually
  // assigned to this driver, in 'out_for_delivery' state, and within the
  // driver's branch. Without this, a malicious client could write spurious
  // pings against any order_id and pollute the live driver-tracking map.
  const orderId = (payload as { order_id?: string | null }).order_id
  if (!orderId) {
    return { success: false, error: 'Order id required' }
  }

  const supabase = await createServiceClient()

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, status, branch_id, order_type, assigned_driver_id')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) return { success: false, error: 'Order not found' }
  if (order.order_type !== 'delivery') {
    return { success: false, error: 'Order is not a delivery order' }
  }
  if (order.status !== 'out_for_delivery') {
    return { success: false, error: 'Order is not in transit' }
  }
  if (order.assigned_driver_id !== user.id) {
    return { success: false, error: 'Unauthorized: Order is not assigned to you' }
  }
  if (!user.branch_id || order.branch_id !== user.branch_id) {
    return { success: false, error: 'Unauthorized: Order belongs to another branch' }
  }

  const { error } = await supabase
    .from('driver_locations')
    .upsert(
      [{
        ...payload,
        driver_id: user.id,
        updated_at: new Date().toISOString()
      }],
      {
        onConflict: 'driver_id,order_id'
      }
    )

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function toggleDriverAvailability(): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: current, error: fetchErr } = await supabase
    .from('staff_basic')
    .select('availability_status')
    .eq('id', user.id)
    .single()

  if (fetchErr || !current) return { success: false, error: 'Driver record not found' }

  const next = current.availability_status === 'online' ? 'offline' : 'online'

  const { error } = await supabase
    .from('staff_basic')
    .update({ availability_status: next })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  const service = await createServiceClient()
  const now     = new Date().toISOString()

  if (next === 'online') {
    const { data: orphan } = await service
      .from('time_entries')
      .select('id, clock_in')
      .eq('staff_id', user.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (orphan) {
      const hours = (Date.now() - new Date(orphan.clock_in).getTime()) / 3_600_000
      await service
        .from('time_entries')
        .update({ clock_out: now, total_hours: Number(hours.toFixed(2)) })
        .eq('id', orphan.id)
    }

    await service.from('time_entries').insert({ staff_id: user.id, clock_in: now })
  } else {
    const { data: open } = await service
      .from('time_entries')
      .select('id, clock_in')
      .eq('staff_id', user.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (open) {
      const hours = (Date.now() - new Date(open.clock_in).getTime()) / 3_600_000
      await service
        .from('time_entries')
        .update({ clock_out: now, total_hours: Number(hours.toFixed(2)) })
        .eq('id', open.id)
    }
  }

  return { success: true }
}

export async function submitCashHandover(
  orderIds:     string[],
  actualAmount: number,
): Promise<DriverActionResult & { totalExpected?: number }> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  // Audit fix #5: cash amount must be finite and non-negative.
  const normalizedActual = normalizeCashAmount(actualAmount)
  if (normalizedActual === null || Number.isNaN(normalizedActual)) {
    return { success: false, error: 'Cash amount must be a non-negative finite number' }
  }

  let totalExpected = 0
  let branchId: string | null = null

  if (orderIds.length > 0) {
    const supabase = await createClient()
    const { data: orders } = await supabase
      .from('orders')
      .select('id, assigned_driver_id, total_bhd, status, branch_id, payments(method), actual_collected, tip_bhd')
      .in('id', orderIds)

    if (!orders || orders.length === 0) return { success: false, error: 'Orders not found' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedOrders = orders as any[]

    branchId = typedOrders[0].branch_id
    const invalid = typedOrders.filter(
      o =>
        o.assigned_driver_id !== user.id ||
        o.status             !== 'delivered' ||
        o.payments?.method   !== 'cash' ||
        o.branch_id          !== branchId
    )
    if (invalid.length > 0) return { success: false, error: 'Invalid orders in handover' }

    totalExpected = typedOrders.reduce(
      (s: number, o) => s + Number(o.actual_collected ?? o.total_bhd) + Number(o.tip_bhd ?? 0),
      0
    )
  } else {
    return { success: false, error: 'No orders selected' }
  }

  const service = await createServiceClient()
  const now = new Date().toISOString()

  const { data: handover, error: hErr } = await service
    .from('cash_handovers')
    .insert({
      driver_id:       user.id,
      branch_id:       branchId!,
      expected_amount: Math.round(totalExpected * 1000) / 1000,
      actual_amount:   normalizedActual,
      order_ids:       orderIds,
      manager_confirmed: false
    })
    .select('id')
    .single()

  if (hErr || !handover) return { success: false, error: hErr?.message ?? 'Handover failed' }

  const { error: updateErr } = await service
    .from('orders')
    .update({
      cash_handed_over: true,
      handed_over_at:   now,
      cash_settlement_id: handover.id
    })
    .in('id', orderIds)
    .eq('assigned_driver_id', user.id)

  if (updateErr) {
    await service.from('cash_handovers').delete().eq('id', handover.id)
    return { success: false, error: updateErr.message }
  }

  await service.from('audit_logs').insert({
    action: 'INSERT',
    table_name: 'cash_handovers',
    record_id: handover.id,
    user_id: user.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actor_role: user.role as any,
    branch_id: branchId,
    changes: {
      order_ids: orderIds,
      expected:  totalExpected,
      actual:    normalizedActual,
      diff:      normalizedActual - totalExpected
    }
  })

  return { success: true, totalExpected }
}

export async function submitDriverIssue(
  orderId: string,
  reason:  string,
  notes?:  string,
): Promise<DriverActionResult> {
  const user = await getSession()
  if (!user || (!isDriver(user.role) && !isManagerPlus(user.role))) {
    return { success: false, error: 'Unauthorized' }
  }

  if (!reason.trim()) {
    return { success: false, error: 'Reason is required' }
  }

  const supabase = await createClient()

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, branch_id, assigned_driver_id, status')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) return { success: false, error: 'Order not found' }

  // D-C3: Branch guard (Owner/GM bypass).
  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  if (!isGlobalAdmin && (!user.branch_id || order.branch_id !== user.branch_id)) {
    return { success: false, error: 'Unauthorized' }
  }

  const isOwnedByDriver = order.assigned_driver_id === user.id
  const isClaimable     = order.status === 'ready'
  if (!isOwnedByDriver && !isClaimable && !isManagerPlus(user.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const service = await createServiceClient()

  const { error } = await service
    .from('driver_order_issues')
    .insert({
      order_id:  orderId,
      driver_id: user.id,
      reason:    reason.trim(),
      notes:     notes?.trim() ?? null,
    })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function reportDeliveryFailure(
  orderId: string,
  reason:  string,
  notes?:  string,
): Promise<DriverActionResult> {
  const user = await getSession()
  // Audit fix #1: driver-only (expanded to Manager+ for supervision).
  if (!user || (!isDriver(user.role) && !isManagerPlus(user.role))) {
    return { success: false, error: 'Unauthorized' }
  }

  if (!reason.trim()) {
    return { success: false, error: 'Reason is required' }
  }

  const supabase = await createClient()

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, branch_id, order_type, assigned_driver_id, status, driver_notes')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) return { success: false, error: 'Order not found' }

  // Audit fix #3: delivery only.
  if (order.order_type !== 'delivery') {
    return { success: false, error: 'Order is not a delivery order' }
  }
  // Audit fix #5: status MUST be out_for_delivery for ALL callers.
  if (order.status !== 'out_for_delivery') {
    return { success: false, error: 'Order is not in transit — cannot mark as failed' }
  }
  // Branch guard (Owner/GM bypass).
  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  if (!isGlobalAdmin && (!user.branch_id || order.branch_id !== user.branch_id)) {
    return { success: false, error: 'Unauthorized: Order belongs to another branch' }
  }
  // Only the assigned driver may report failure (Managers bypass).
  if (order.assigned_driver_id !== user.id && !isManagerPlus(user.role)) {
    return { success: false, error: 'Unauthorized: Order is not assigned to you' }
  }

  const service = await createServiceClient()

  const failureNote = `[فشل التوصيل]: ${reason}${notes ? ` - ${notes}` : ''}`
  const updatedDriverNotes = order.driver_notes
    ? `${order.driver_notes}\n${failureNote}`
    : failureNote

  // Audit fix #5: pin to current status to detect concurrent change.
  const { data: updatedRows, error: updateError } = await service
    .from('orders')
    .update({
      status:       'delivery_failed',
      driver_notes: updatedDriverNotes,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'out_for_delivery')
    .select('id')

  if (updateError) return { success: false, error: updateError.message }
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: 'Order status changed — refresh and retry' }
  }

  await service
    .from('driver_order_issues')
    .insert({
      order_id:  orderId,
      driver_id: user.id,
      reason:    reason.trim(),
      notes:     notes?.trim() ?? null,
    })

  return { success: true }
}

export async function uploadDeliveryProof(
  orderId: string,
  imageFile: File
): Promise<DriverActionResult & { url?: string }> {
  const user = await getSession()
  if (!user || user.role !== 'driver') {
    return { success: false, error: 'Unauthorized' }
  }

  const supabase = await createClient()

  // 1. Verify driver is assigned
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, assigned_driver_id')
    .eq('id', orderId)
    .single()

  if (fetchErr || !order) return { success: false, error: 'Order not found' }
  if (order.assigned_driver_id !== user.id) {
    return { success: false, error: 'Unauthorized: Order not assigned to you' }
  }

  // 2. Upload image
  const timestamp = Date.now()
  const fileName  = `${orderId}/${timestamp}.jpg`
  const { error: uploadErr } = await supabase.storage
    .from('delivery-proofs')
    .upload(fileName, imageFile, {
      contentType: 'image/jpeg',
      upsert:      true,
    })

  if (uploadErr) return { success: false, error: `Upload failed: ${uploadErr.message}` }

  // 3. Get public URL (or signed URL if private)
  // Since the bucket is private (public: false in migration), we generate a signed URL.
  // We'll give it a long expiry (e.g. 10 years) for archival purposes,
  // or just store the path and let the UI handle signed URLs.
  // The user prompt said: "3. احصل على signed URL أو public URL"
  // For simplicity and to match "delivery_proof_url TEXT", we'll get a long-lived signed URL.
  const { data: signed } = await supabase.storage
    .from('delivery-proofs')
    .createSignedUrl(fileName, 315360000) // 10 years

  if (!signed?.signedUrl) return { success: false, error: 'Failed to generate access URL' }

  // 4. Update order
  const { error: updateErr } = await supabase
    .from('orders')
    .update({ delivery_proof_url: signed.signedUrl })
    .eq('id', orderId)

  if (updateErr) return { success: false, error: `Database update failed: ${updateErr.message}` }

  revalidatePath(`/[locale]/driver`, 'page')
  revalidatePath(`/[locale]/dashboard/orders/${orderId}`, 'page')

  return { success: true, url: signed.signedUrl }
}
