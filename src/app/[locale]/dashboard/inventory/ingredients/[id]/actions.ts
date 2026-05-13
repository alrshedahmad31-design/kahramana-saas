'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardGuardErrorMessage, requireDashboardRole } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

const INGREDIENT_UNITS = ['g','kg','ml','l','unit','tbsp','tsp','oz','lb','piece','portion','bottle','can','bag','box'] as const
const ABC_CLASSES      = ['A','B','C'] as const
const STORAGE_TEMPS    = ['frozen','chilled','ambient','dry'] as const
const INGREDIENT_CATEGORIES = [
  'protein','grain','vegetable','dairy','seafood','spice','oil','beverage','sauce','packaging','cleaning','disposable','other',
] as const

// Reject NaN, negative costs, empty strings. Coerces FormData strings to the
// right shape; nullable fields accept "" / missing as null.
const trimmed = z.string().trim()
const requiredStr = trimmed.min(1)
const optionalStr = trimmed.transform((v) => (v === '' ? null : v)).nullable()
const nonNegFinite = z.number().finite().min(0)
const posFinite    = z.number().finite().positive()
const optionalNonNeg = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().finite().min(0).nullable(),
)
const optionalPos = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().finite().positive().nullable(),
)

const ingredientSchema = z.object({
  name_ar: requiredStr,
  name_en: requiredStr,
  unit: z.enum(INGREDIENT_UNITS),
  purchase_unit: optionalStr,
  purchase_unit_factor: optionalPos,
  cost_per_unit: z.preprocess((v) => Number(v ?? 0), nonNegFinite),
  ideal_cost_pct: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().finite().min(0).max(100).nullable(),
  ),
  default_yield_factor: z.preprocess((v) => Number(v ?? 1), posFinite),
  category: z.enum(INGREDIENT_CATEGORIES).nullable(),
  abc_class: z.enum(ABC_CLASSES).default('C'),
  reorder_point: optionalNonNeg,
  max_stock_level: optionalNonNeg,
  reorder_qty: optionalNonNeg,
  shelf_life_days: optionalPos,
  storage_temp: z.enum(STORAGE_TEMPS).nullable(),
  barcode: optionalStr,
  supplier_id: optionalStr,
  is_active: z.boolean(),
  notes: optionalStr,
})

export async function upsertIngredient(formData: FormData): Promise<{ error?: string; id?: string }> {
  // Align with rbac-ui.ts inventory_ingredients section (inventory_manager has UI access).
  // deleteIngredient below stays stricter (owner/GM only) — destructive ops kept tight.
  try {
    await requireDashboardRole(['owner', 'general_manager', 'inventory_manager'])
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const supabase = createServiceClient()
  const id = formData.get('id') as string | null

  const raw = {
    name_ar: formData.get('name_ar'),
    name_en: formData.get('name_en'),
    unit: formData.get('unit'),
    purchase_unit: formData.get('purchase_unit'),
    purchase_unit_factor: formData.get('purchase_unit_factor'),
    cost_per_unit: formData.get('cost_per_unit'),
    ideal_cost_pct: formData.get('ideal_cost_pct'),
    default_yield_factor: formData.get('default_yield_factor'),
    category: (formData.get('category') as string | null) || null,
    abc_class: (formData.get('abc_class') as string | null) || 'C',
    reorder_point: formData.get('reorder_point'),
    max_stock_level: formData.get('max_stock_level'),
    reorder_qty: formData.get('reorder_qty'),
    shelf_life_days: formData.get('shelf_life_days'),
    storage_temp: (formData.get('storage_temp') as string | null) || null,
    barcode: formData.get('barcode'),
    supplier_id: formData.get('supplier_id'),
    is_active: formData.get('is_active') === 'true',
    notes: formData.get('notes'),
  }

  const parsed = ingredientSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid payload' }
  }

  const payload = { ...parsed.data, updated_at: new Date().toISOString() }

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

  // Handle allergens. Order matters here for food-safety: insert-new-first,
  // then delete-stale. If the second step fails, the ingredient ends up with
  // EXTRA allergens (over-warning customers — safe) rather than the old
  // delete-then-insert pattern, where a failed insert wiped all allergens
  // (under-warning — dangerous).
  // Validate against the CHECK-constrained set so the IN-list below is safe.
  const ALLOWED_ALLERGENS = new Set([
    'gluten','dairy','eggs','nuts','peanuts','soy','fish','shellfish',
    'sesame','mustard','celery','lupin','molluscs','sulphites',
  ])
  const rawAllergens = formData.getAll('allergens') as string[]
  const allergens = rawAllergens.filter((a) => ALLOWED_ALLERGENS.has(a))

  if (ingredientId) {
    if (allergens.length > 0) {
      const { error: aErr } = await supabase
        .from('ingredient_allergens')
        .upsert(
          allergens.map((a) => ({ ingredient_id: ingredientId!, allergen: a })),
          { onConflict: 'ingredient_id,allergen', ignoreDuplicates: true },
        )
      if (aErr) return { error: `Allergen update failed: ${aErr.message}` }
    }

    // Remove rows for allergens NOT in the new set. When new set is empty,
    // this collapses to "delete all allergens for this ingredient".
    let staleQ = supabase
      .from('ingredient_allergens')
      .delete()
      .eq('ingredient_id', ingredientId)
    if (allergens.length > 0) {
      staleQ = staleQ.not('allergen', 'in', `(${allergens.join(',')})`)
    }
    await staleQ
  }

  revalidatePath('/dashboard/inventory/ingredients')
  revalidatePath('/en/dashboard/inventory/ingredients')
  revalidatePath(`/dashboard/inventory/ingredients/${ingredientId}`)
  return { id: ingredientId ?? undefined }
}

export async function deleteIngredient(id: string): Promise<{ error?: string }> {
  try {
    await requireDashboardRole(['owner', 'general_manager'])
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('ingredients')
    .update({ is_active: false })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/inventory/ingredients')
  revalidatePath('/en/dashboard/inventory/ingredients')
  return {}
}
