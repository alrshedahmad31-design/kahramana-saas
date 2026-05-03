'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { assertBranchScope, assertInventoryWriteAccess, getDashboardGuardErrorMessage, requireDashboardRole, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

const _WASTE_REASONS = [
  'expired', 'damaged', 'spillage', 'overproduction', 'quality',
  'returned', 'theft_suspected', 'prep_error', 'over_portioning', 'other',
] as const
type WasteReason = typeof _WASTE_REASONS[number]

export async function createWasteLog(formData: FormData): Promise<{ error?: string }> {
  const ingredient_id = formData.get('ingredient_id') as string
  const quantity      = Number(formData.get('quantity'))
  const reason        = formData.get('reason') as WasteReason
  const branch_id     = formData.get('branch_id') as string
  const notes         = formData.get('notes') as string | null
  const photo_url     = formData.get('photo_url') as string | null

  let session
  try {
    session = await requireDashboardSession()
    assertInventoryWriteAccess(session, branch_id)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (!ingredient_id || !quantity || !reason || !branch_id) {
    return { error: 'الحقول المطلوبة: الفرع، المكوّن، الكمية، السبب' }
  }

  const supabase = createServiceClient()

  // W1 FIX: calculate cost server-side — never trust client-submitted cost_bhd.
  // A malicious or buggy client could submit any value (negative, inflated, zero).
  const { data: ingredient, error: ingErr } = await supabase
    .from('ingredients')
    .select('cost_per_unit')
    .eq('id', ingredient_id)
    .single()

  if (ingErr || !ingredient) return { error: 'المكوّن غير موجود' }

  const cost_bhd = quantity * ingredient.cost_per_unit

  const { error } = await supabase.from('waste_log').insert({
    branch_id,
    ingredient_id,
    quantity,
    reason,
    cost_bhd,
    notes:       notes || null,
    photo_url:   photo_url || null,
    reported_by: session.id,
    reported_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/inventory/waste')
  return {}
}

export async function approveWaste(id: string): Promise<{ error?: string }> {
  let session
  try {
    session = await requireDashboardRole(['owner', 'general_manager', 'branch_manager'])
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }
  const supabase = createServiceClient()
  const { data: waste, error: fetchError } = await supabase
    .from('waste_log')
    .select('branch_id')
    .eq('id', id)
    .single()

  if (fetchError || !waste) return { error: 'Waste log not found' }

  try {
    assertBranchScope(session, waste.branch_id)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const { error } = await supabase
    .from('waste_log')
    .update({
      approved_by: session.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('approved_by', null)
    .is('rejected_by', null)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/inventory/waste')
  revalidatePath(`/ar/dashboard/inventory/waste/${id}`)
  revalidatePath(`/en/dashboard/inventory/waste/${id}`)
  return {}
}

export async function rejectWaste(id: string, rejection_note: string): Promise<{ error?: string }> {
  let session
  try {
    session = await requireDashboardRole(['owner', 'general_manager', 'branch_manager'])
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }
  const supabase = createServiceClient()
  const { data: waste, error: fetchError } = await supabase
    .from('waste_log')
    .select('branch_id')
    .eq('id', id)
    .single()

  if (fetchError || !waste) return { error: 'Waste log not found' }

  try {
    assertBranchScope(session, waste.branch_id)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const { error } = await supabase
    .from('waste_log')
    .update({
      rejected_by: session.id,
      rejected_at: new Date().toISOString(),
      rejection_note,
    })
    .eq('id', id)
    .is('approved_by', null)
    .is('rejected_by', null)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/inventory/waste')
  revalidatePath(`/ar/dashboard/inventory/waste/${id}`)
  revalidatePath(`/en/dashboard/inventory/waste/${id}`)
  return {}
}
