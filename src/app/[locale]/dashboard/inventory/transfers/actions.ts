'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { assertInventoryWriteAccess, getDashboardGuardErrorMessage, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

export async function createTransfer(formData: FormData): Promise<{ error?: string }> {
  const from_branch_id = formData.get('from_branch_id') as string
  const to_branch_id   = formData.get('to_branch_id') as string
  const ingredient_id  = formData.get('ingredient_id') as string
  const quantity       = Number(formData.get('quantity'))
  const notes          = formData.get('notes') as string | null

  if (!from_branch_id || !to_branch_id || !ingredient_id || !quantity) {
    return { error: 'الحقول المطلوبة: من فرع، إلى فرع، المكوّن، الكمية' }
  }
  if (from_branch_id === to_branch_id) {
    return { error: 'لا يمكن التحويل للفرع نفسه' }
  }

  let session
  try {
    session = await requireDashboardSession()
    assertInventoryWriteAccess(session, from_branch_id)
    assertInventoryWriteAccess(session, to_branch_id)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const { error: insertErr } = await supabase.from('inventory_transfers').insert({
    from_branch_id,
    to_branch_id,
    ingredient_id,
    quantity,
    status:          'received',
    transferred_by:  session.id,
    received_by:     session.id,
    transferred_at:  now,
    received_at:     now,
    notes:           notes || null,
  })
  if (insertErr) return { error: insertErr.message }

  const { error: rpcErr } = await supabase.rpc('rpc_transfer_stock', {
    p_from_branch:  from_branch_id,
    p_to_branch:    to_branch_id,
    p_ingredient:   ingredient_id,
    p_quantity:     quantity,
    p_staff_id:     session.id,
  })
  if (rpcErr) return { error: rpcErr.message }

  revalidatePath('/dashboard/inventory/transfers')
  return {}
}
