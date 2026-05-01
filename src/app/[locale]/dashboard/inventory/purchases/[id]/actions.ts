'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
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
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) return { error: 'Forbidden' }

  const supabase = createServiceClient()
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
