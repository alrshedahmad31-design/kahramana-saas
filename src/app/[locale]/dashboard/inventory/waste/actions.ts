'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const WASTE_REASONS = [
  'expired', 'damaged', 'spillage', 'overproduction', 'quality',
  'returned', 'theft_suspected', 'prep_error', 'over_portioning', 'other',
] as const
type WasteReason = typeof WASTE_REASONS[number]

export async function createWasteLog(formData: FormData): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const allowed = ['owner', 'general_manager', 'branch_manager', 'kitchen', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) return { error: 'Forbidden' }

  const supabase = createServiceClient()

  const ingredient_id = formData.get('ingredient_id') as string
  const quantity      = Number(formData.get('quantity'))
  const reason        = formData.get('reason') as WasteReason
  const branch_id     = formData.get('branch_id') as string
  const notes         = formData.get('notes') as string | null
  const photo_url     = formData.get('photo_url') as string | null
  const cost_bhd      = Number(formData.get('cost_bhd') || 0)

  if (!ingredient_id || !quantity || !reason || !branch_id) {
    return { error: 'الحقول المطلوبة: الفرع، المكوّن، الكمية، السبب' }
  }

  const { error } = await supabase.from('waste_log').insert({
    branch_id,
    ingredient_id,
    quantity,
    reason,
    cost_bhd,
    notes: notes || null,
    photo_url: photo_url || null,
    reported_by: session.id,
    reported_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/inventory/waste')
  return {}
}

export async function approveWaste(id: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const allowed = ['owner', 'general_manager', 'branch_manager']
  if (!allowed.includes(session.role ?? '')) return { error: 'Forbidden' }

  const supabase = createServiceClient()
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
  return {}
}

export async function rejectWaste(id: string, rejection_note: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const allowed = ['owner', 'general_manager', 'branch_manager']
  if (!allowed.includes(session.role ?? '')) return { error: 'Forbidden' }

  const supabase = createServiceClient()
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
  return {}
}
