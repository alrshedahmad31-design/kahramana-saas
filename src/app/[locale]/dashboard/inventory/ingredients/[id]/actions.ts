'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import type { AbcClass, IngredientUnit, IngredientCategory, StorageTemp } from '@/lib/supabase/custom-types'

const ALLOWED_WRITE_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen'] as const

export async function upsertIngredient(formData: FormData): Promise<{ error?: string; id?: string }> {
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
    unit: formData.get('unit') as IngredientUnit,
    purchase_unit: (formData.get('purchase_unit') as string) || null,
    purchase_unit_factor: formData.get('purchase_unit_factor')
      ? Number(formData.get('purchase_unit_factor'))
      : null,
    cost_per_unit: Number(formData.get('cost_per_unit') || 0),
    ideal_cost_pct: formData.get('ideal_cost_pct')
      ? Number(formData.get('ideal_cost_pct'))
      : null,
    default_yield_factor: Number(formData.get('default_yield_factor') || 1),
    category: ((formData.get('category') as string) || null) as IngredientCategory | null,
    abc_class: ((formData.get('abc_class') as string) || 'C') as AbcClass,
    reorder_point: formData.get('reorder_point')
      ? Number(formData.get('reorder_point'))
      : null,
    max_stock_level: formData.get('max_stock_level')
      ? Number(formData.get('max_stock_level'))
      : null,
    reorder_qty: formData.get('reorder_qty')
      ? Number(formData.get('reorder_qty'))
      : null,
    shelf_life_days: formData.get('shelf_life_days')
      ? Number(formData.get('shelf_life_days'))
      : null,
    storage_temp: ((formData.get('storage_temp') as string) || null) as StorageTemp | null,
    barcode: (formData.get('barcode') as string) || null,
    supplier_id: (formData.get('supplier_id') as string) || null,
    is_active: formData.get('is_active') === 'true',
    notes: (formData.get('notes') as string) || null,
    updated_at: new Date().toISOString(),
  }

  // Validate required fields
  if (!payload.name_ar || !payload.name_en || !payload.unit) {
    return { error: 'اسم المكوّن والوحدة مطلوبة' }
  }

  let ingredientId = id

  if (id) {
    const { error } = await supabase.from('ingredients').update(payload).eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await supabase
      .from('ingredients')
      .insert(payload)
      .select('id')
      .single()
    if (error) return { error: error.message }
    ingredientId = data.id as string
  }

  // Handle allergens
  const allergens = formData.getAll('allergens') as string[]
  if (ingredientId) {
    await supabase
      .from('ingredient_allergens')
      .delete()
      .eq('ingredient_id', ingredientId)

    if (allergens.length > 0) {
      await supabase
        .from('ingredient_allergens')
        .insert(allergens.map((a) => ({ ingredient_id: ingredientId!, allergen: a })))
    }
  }

  revalidatePath('/dashboard/inventory/ingredients')
  revalidatePath(`/dashboard/inventory/ingredients/${ingredientId}`)
  return { id: ingredientId ?? undefined }
}

export async function deleteIngredient(id: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || !['owner', 'general_manager'].includes(session.role ?? '')) {
    return { error: 'Forbidden' }
  }
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('ingredients')
    .update({ is_active: false })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/inventory/ingredients')
  return {}
}
