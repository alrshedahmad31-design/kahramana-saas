'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const ALLOWED_WRITE_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen'] as const

export async function upsertPrepItem(formData: FormData): Promise<{ error?: string; id?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!ALLOWED_WRITE_ROLES.includes(session.role as typeof ALLOWED_WRITE_ROLES[number])) {
    return { error: 'Forbidden' }
  }

  const supabase = createServiceClient()
  const id = formData.get('id') as string | null

  const payload = {
    name_ar: formData.get('name_ar') as string,
    name_en: formData.get('name_en') as string,
    unit: formData.get('unit') as string,
    batch_yield_qty: Number(formData.get('batch_yield_qty') || 1),
    shelf_life_hours: formData.get('shelf_life_hours')
      ? Number(formData.get('shelf_life_hours'))
      : null,
    storage_temp: (formData.get('storage_temp') as string) || null,
    is_active: formData.get('is_active') === 'true',
    notes: (formData.get('notes') as string) || null,
  }

  if (!payload.name_ar || !payload.name_en || !payload.unit) {
    return { error: 'الاسم والوحدة مطلوبان' }
  }

  let prepId = id

  if (id) {
    const { error } = await supabase.from('prep_items').update(payload).eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await supabase
      .from('prep_items')
      .insert(payload)
      .select('id')
      .single()
    if (error) return { error: error.message }
    prepId = data.id as string
  }

  revalidatePath('/dashboard/inventory/prep-items')
  revalidatePath(`/dashboard/inventory/prep-items/${prepId}`)
  return { id: prepId ?? undefined }
}

interface PrepIngredientInput {
  ingredient_id: string
  quantity: number
  yield_factor: number | null
}

export async function savePrepItemIngredients(
  prepItemId: string,
  rows: PrepIngredientInput[]
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!ALLOWED_WRITE_ROLES.includes(session.role as typeof ALLOWED_WRITE_ROLES[number])) {
    return { error: 'Forbidden' }
  }

  const supabase = createServiceClient()

  // Delete all existing ingredient rows for this prep item
  const { error: delError } = await supabase
    .from('prep_item_ingredients')
    .delete()
    .eq('prep_item_id', prepItemId)

  if (delError) return { error: delError.message }

  // Re-insert
  if (rows.length > 0) {
    const { error: insError } = await supabase.from('prep_item_ingredients').insert(
      rows.map((r) => ({
        prep_item_id: prepItemId,
        ingredient_id: r.ingredient_id,
        quantity: r.quantity,
        yield_factor: r.yield_factor,
      }))
    )
    if (insError) return { error: insError.message }
  }

  revalidatePath(`/dashboard/inventory/prep-items/${prepItemId}`)
  return {}
}
