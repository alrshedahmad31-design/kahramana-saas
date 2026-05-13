'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardGuardErrorMessage, requireDashboardRole } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

const STORAGE_TEMPS = ['frozen','chilled','ambient','dry'] as const

const requiredStr = z.string().trim().min(1)
const optionalStr = z.string().trim().transform((v) => (v === '' ? null : v)).nullable()

// Reject NaN, negatives, and empty required fields.
const prepItemSchema = z.object({
  name_ar: requiredStr,
  name_en: requiredStr,
  unit: requiredStr,
  batch_yield_qty: z.preprocess((v) => Number(v ?? 1), z.number().finite().positive()),
  shelf_life_hours: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().finite().positive().nullable(),
  ),
  storage_temp: z.enum(STORAGE_TEMPS).nullable(),
  is_active: z.boolean(),
  notes: optionalStr,
})

const prepIngredientSchema = z.object({
  ingredient_id: z.string().trim().min(1),
  quantity: z.number().finite().positive(),
  yield_factor: z.number().finite().positive().nullable(),
})

export async function upsertPrepItem(formData: FormData): Promise<{ error?: string; id?: string }> {
  try {
    await requireDashboardRole(['owner', 'general_manager'])
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const supabase = createServiceClient()
  const id = formData.get('id') as string | null

  const raw = {
    name_ar: formData.get('name_ar'),
    name_en: formData.get('name_en'),
    unit: formData.get('unit'),
    batch_yield_qty: formData.get('batch_yield_qty'),
    shelf_life_hours: formData.get('shelf_life_hours'),
    storage_temp: (formData.get('storage_temp') as string | null) || null,
    is_active: formData.get('is_active') === 'true',
    notes: formData.get('notes'),
  }

  const parsed = prepItemSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid payload' }
  }

  const payload = parsed.data

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
  revalidatePath('/en/dashboard/inventory/prep-items')
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
  try {
    await requireDashboardRole(['owner', 'general_manager'])
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (!prepItemId || prepItemId.trim() === '') {
    return { error: 'prep_item_id is required' }
  }

  const parsed = z.array(prepIngredientSchema).safeParse(rows)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid ingredient row' }
  }
  const validatedRows = parsed.data

  const supabase = createServiceClient()

  // Delete all existing ingredient rows for this prep item
  const { error: delError } = await supabase
    .from('prep_item_ingredients')
    .delete()
    .eq('prep_item_id', prepItemId)

  if (delError) return { error: delError.message }

  // Re-insert
  if (validatedRows.length > 0) {
    const { error: insError } = await supabase.from('prep_item_ingredients').insert(
      validatedRows.map((r) => ({
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
