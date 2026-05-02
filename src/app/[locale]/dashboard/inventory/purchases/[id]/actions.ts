'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { assertInventoryWriteAccess, getDashboardGuardErrorMessage, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

interface ReceiveLine {
  id: string
  quantity_received: number
  lot_number?: string
  expiry_date?: string
  quality_rating?: number
  discrepancy_note?: string
}

export async function receivePurchaseOrder(
  poId: string,
  lines: ReceiveLine[],
): Promise<{ error?: string }> {
  let session
  try {
    session = await requireDashboardSession()
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }
  const supabase = createServiceClient()
  const { data: po, error: fetchError } = await supabase
    .from('purchase_orders')
    .select('branch_id')
    .eq('id', poId)
    .single()

  if (fetchError || !po) return { error: 'Purchase order not found' }

  try {
    assertInventoryWriteAccess(session, po.branch_id)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  // Cast to unknown first to satisfy Supabase Json constraint for RPC params
  const { error } = await supabase.rpc('rpc_receive_purchase_order', {
    p_po_id:       poId,
    p_received_by: session.id,
    p_lines:       lines as unknown as string,
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/inventory/purchases/${poId}`)
  revalidatePath('/dashboard/inventory/purchases')
  return {}
}
