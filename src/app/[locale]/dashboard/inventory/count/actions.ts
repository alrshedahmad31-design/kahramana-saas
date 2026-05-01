'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function submitCountSession(
  sessionName: string,
  branchId: string,
  counts: { ingredient_id: string; system_qty: number; actual_qty: number }[],
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) return { error: 'Forbidden' }

  if (!sessionName || !branchId || counts.length === 0) {
    return { error: 'البيانات غير مكتملة' }
  }

  const supabase = createServiceClient()

  const rows = counts.map((c) => ({
    branch_id:      branchId,
    ingredient_id:  c.ingredient_id,
    system_qty:     c.system_qty,
    actual_qty:     c.actual_qty,
    counted_by:     session.id,
    count_session:  sessionName,
    counted_at:     new Date().toISOString(),
  }))

  const { error } = await supabase.from('inventory_counts').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/inventory/count')
  return {}
}

export async function approveCountSession(
  sessionName: string,
  branchId: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const allowed = ['owner', 'general_manager', 'branch_manager']
  if (!allowed.includes(session.role ?? '')) return { error: 'Forbidden' }

  const supabase = createServiceClient()

  const { data: rows, error: fetchErr } = await supabase
    .from('inventory_counts')
    .select('id')
    .eq('count_session', sessionName)
    .eq('branch_id', branchId)
    .is('approved_by', null)

  if (fetchErr) return { error: fetchErr.message }

  for (const row of rows ?? []) {
    const { error } = await supabase.rpc('rpc_inventory_count_submit', {
      p_count_id:    row.id,
      p_approved_by: session.id,
    })
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/inventory/count')
  return {}
}
