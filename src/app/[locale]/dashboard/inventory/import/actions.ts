'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardGuardErrorMessage, requireDashboardRole } from '@/lib/auth/dashboard-guards'
import { parseInventoryExcel } from '@/lib/inventory/excel-parser'
import type { ImportError, ImportWarning, ParsedIngredient } from '@/lib/inventory/excel-parser'
import type { TablesInsert } from '@/lib/supabase/custom-types'

export interface ImportSummary {
  ingredients: number
  suppliers: number
  allergens: number
  prepItems: number
  prepIngredients: number
  recipes: number
  openingStock: number
  lots: number
  movements: number
  parLevels: number
}

export interface ImportActionResult {
  success: boolean
  imported: boolean
  summary: ImportSummary
  errors: ImportError[]
  warnings: ImportWarning[]
}

export async function importInventoryExcel(formData: FormData): Promise<ImportActionResult> {
  const blank: ImportSummary = {
    ingredients: 0, suppliers: 0, allergens: 0, prepItems: 0,
    prepIngredients: 0, recipes: 0, openingStock: 0, lots: 0,
    movements: 0, parLevels: 0,
  }

  let session
  try {
    session = await requireDashboardRole(['owner', 'general_manager'])
  } catch (error) {
    return { success: false, imported: false, summary: blank, errors: [{ sheet: '-', row: 0, column: '-', message: getDashboardGuardErrorMessage(error) }], warnings: [] }
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return { success: false, imported: false, summary: blank, errors: [{ sheet: '-', row: 0, column: '-', message: 'لم يتم إرفاق ملف' }], warnings: [] }
  }

  if (file.size > 10 * 1024 * 1024) {
    return { success: false, imported: false, summary: blank, errors: [{ sheet: '-', row: 0, column: '-', message: 'حجم الملف يتجاوز 10 MB' }], warnings: [] }
  }

  if (!file.name.endsWith('.xlsx')) {
    return { success: false, imported: false, summary: blank, errors: [{ sheet: '-', row: 0, column: '-', message: 'يجب أن يكون الملف بصيغة .xlsx' }], warnings: [] }
  }

  const mode = formData.get('mode') as string | null

  const db = createServiceClient()

  // Fetch reference data for validation
  const [{ data: branches }, { data: slugRows }] = await Promise.all([
    db.from('branches').select('id, name_ar').eq('is_active', true),
    db.from('menu_items_sync').select('slug'),
  ])

  const branchNames    = (branches ?? []).map((b) => b.name_ar)
  const branchNameToId = new Map((branches ?? []).map((b) => [b.name_ar, b.id]))
  const menuSlugs      = (slugRows ?? []).map((r) => r.slug)

  const arrayBuf = await file.arrayBuffer()

  let parsed
  try {
    parsed = await parseInventoryExcel(arrayBuf, { menuSlugs, branchNames })
  } catch {
    return { success: false, imported: false, summary: blank, errors: [{ sheet: '-', row: 0, column: '-', message: 'فشل في قراءة الملف — تأكد أن الملف .xlsx صحيح' }], warnings: [] }
  }

  const { ingredients, prepItems, prepIngredients, recipes, openingStock, parLevels, errors, warnings } = parsed

  // Always return analysis result
  const summary: ImportSummary = {
    ingredients:    ingredients.length,
    suppliers:      countUniqueSuppliers(ingredients),
    allergens:      ingredients.reduce((acc, i) => acc + i.allergens.length, 0),
    prepItems:      prepItems.length,
    prepIngredients: prepIngredients.length,
    recipes:        recipes.length,
    openingStock:   openingStock.length,
    lots:           openingStock.filter((s) => s.lot_number || s.expiry_date).length,
    movements:      openingStock.length,
    parLevels:      parLevels.length,
  }

  if (errors.length > 0 || mode !== 'import') {
    return { success: true, imported: false, summary, errors, warnings }
  }

  // ── IMPORT ───────────────────────────────────────────────────────────────

  // a. Upsert suppliers
  const supplierNames = [...new Set(ingredients.map((i) => i.supplier_name).filter(Boolean))] as string[]
  const supplierNameToId = new Map<string, string>()

  if (supplierNames.length > 0) {
    const { data: existingSuppliers } = await db.from('suppliers').select('id, name_ar').in('name_ar', supplierNames)
    for (const s of existingSuppliers ?? []) supplierNameToId.set(s.name_ar, s.id)

    const newNames = supplierNames.filter((n) => !supplierNameToId.has(n))
    if (newNames.length > 0) {
      const { data: newSuppliers } = await db
        .from('suppliers')
        .insert(newNames.map((name) => ({ name_ar: name, is_active: true })))
        .select('id, name_ar')
      for (const s of newSuppliers ?? []) supplierNameToId.set(s.name_ar, s.id)
    }
  }

  // b. Upsert ingredients
  const ingredientNameToId = new Map<string, string>()
  const { data: existingIng } = await db.from('ingredients').select('id, name_ar')
  for (const r of existingIng ?? []) ingredientNameToId.set(r.name_ar, r.id)

  const ingToInsert = ingredients.filter((i) => !ingredientNameToId.has(i.name_ar))
  const ingToUpdate = ingredients.filter((i) => ingredientNameToId.has(i.name_ar))

  if (ingToInsert.length > 0) {
    const { data: inserted } = await db
      .from('ingredients')
      .insert(ingToInsert.map((i) => buildIngredientRecord(i, supplierNameToId)))
      .select('id, name_ar')
    for (const r of inserted ?? []) ingredientNameToId.set(r.name_ar, r.id)
  }

  if (ingToUpdate.length > 0) {
    await Promise.all(
      ingToUpdate.map((i) =>
        db.from('ingredients')
          .update(buildIngredientRecord(i, supplierNameToId))
          .eq('id', ingredientNameToId.get(i.name_ar)!),
      ),
    )
  }

  // c. ingredient_allergens — delete and re-insert
  const ingIdsWithAllergens = ingredients
    .filter((i) => i.allergens.length > 0 && ingredientNameToId.has(i.name_ar))
    .map((i) => ingredientNameToId.get(i.name_ar)!)

  if (ingIdsWithAllergens.length > 0) {
    await db.from('ingredient_allergens').delete().in('ingredient_id', ingIdsWithAllergens)
    const allergenRows = ingredients.flatMap((i) =>
      i.allergens
        .filter(() => ingredientNameToId.has(i.name_ar))
        .map((a) => ({ ingredient_id: ingredientNameToId.get(i.name_ar)!, allergen: a })),
    )
    if (allergenRows.length > 0) {
      await db.from('ingredient_allergens').insert(allergenRows)
    }
  }

  // d. Upsert prep_items
  const prepItemNameToId = new Map<string, string>()
  const { data: existingPrep } = await db.from('prep_items').select('id, name_ar')
  for (const r of existingPrep ?? []) prepItemNameToId.set(r.name_ar, r.id)

  const prepToInsert = prepItems.filter((p) => !prepItemNameToId.has(p.name_ar))
  const prepToUpdate = prepItems.filter((p) => prepItemNameToId.has(p.name_ar))

  if (prepToInsert.length > 0) {
    const { data: inserted } = await db.from('prep_items').insert(prepToInsert).select('id, name_ar')
    for (const r of inserted ?? []) prepItemNameToId.set(r.name_ar, r.id)
  }

  if (prepToUpdate.length > 0) {
    await Promise.all(
      prepToUpdate.map((p) =>
        db.from('prep_items').update(p).eq('id', prepItemNameToId.get(p.name_ar)!),
      ),
    )
  }

  // e. Upsert prep_item_ingredients (delete existing for each prep_item first)
  const affectedPrepIds = [...new Set(prepIngredients.map((pi) => pi.prep_item_name_ar))]
    .filter((n) => prepItemNameToId.has(n))
    .map((n) => prepItemNameToId.get(n)!)

  if (affectedPrepIds.length > 0) {
    await db.from('prep_item_ingredients').delete().in('prep_item_id', affectedPrepIds)
  }

  const prepIngRows = prepIngredients
    .filter((pi) => prepItemNameToId.has(pi.prep_item_name_ar) && ingredientNameToId.has(pi.ingredient_name_ar))
    .map((pi) => ({
      prep_item_id:  prepItemNameToId.get(pi.prep_item_name_ar)!,
      ingredient_id: ingredientNameToId.get(pi.ingredient_name_ar)!,
      quantity:      pi.quantity,
      yield_factor:  pi.yield_factor_override,
    }))

  if (prepIngRows.length > 0) {
    await db.from('prep_item_ingredients').insert(prepIngRows)
  }

  // f. Upsert recipes
  const recipeRows = recipes
    .filter((r) => {
      if (r.ingredient_name_ar && !ingredientNameToId.has(r.ingredient_name_ar)) return false
      if (r.prep_item_name_ar  && !prepItemNameToId.has(r.prep_item_name_ar)) return false
      return true
    })
    .map((r) => ({
      menu_item_slug: r.menu_item_slug,
      ingredient_id:  r.ingredient_name_ar ? ingredientNameToId.get(r.ingredient_name_ar) ?? null : null,
      prep_item_id:   r.prep_item_name_ar  ? prepItemNameToId.get(r.prep_item_name_ar) ?? null : null,
      quantity:       r.quantity,
      variant_key:    r.variant_key,
      yield_factor:   r.yield_factor_override,
      is_optional:    r.is_optional,
    }))

  if (recipeRows.length > 0) {
    await db.from('recipes').upsert(recipeRows, {
      onConflict: 'menu_item_slug,ingredient_id,prep_item_id,variant_key',
      ignoreDuplicates: false,
    })
  }

  // g. Upsert inventory_stock opening balances + h. lots + i. movements
  for (const s of openingStock) {
    const ingredientId = ingredientNameToId.get(s.ingredient_name_ar)
    const branchId     = branchNameToId.get(s.branch_name)
    if (!ingredientId || !branchId) continue

    const { data: stockRow } = await db
      .from('inventory_stock')
      .upsert(
        {
          branch_id: branchId,
          ingredient_id: ingredientId,
          on_hand: s.on_hand,
          ...(s.reorder_point_override !== null ? { reorder_point: s.reorder_point_override } : {}),
        },
        { onConflict: 'branch_id,ingredient_id', ignoreDuplicates: false },
      )
      .select('id')
      .single()

    // Insert lot if lot_number or expiry_date provided
    if (s.lot_number || s.expiry_date) {
      const { data: lot } = await db
        .from('inventory_lots')
        .insert({
          branch_id:         branchId,
          ingredient_id:     ingredientId,
          lot_number:        s.lot_number,
          quantity_received: s.on_hand,
          quantity_remaining: s.on_hand,
          unit_cost:         s.unit_cost ?? 0,
          expires_at:        s.expiry_date ? s.expiry_date.toISOString().split('T')[0] : null,
        })
        .select('id')
        .single()

      // Insert opening_balance movement
      await db.from('inventory_movements').insert({
        branch_id:     branchId,
        ingredient_id: ingredientId,
        lot_id:        lot?.id ?? null,
        movement_type: 'opening_balance',
        quantity:      Math.max(s.on_hand, 0.0001),
        unit_cost:     s.unit_cost,
        notes:         'استيراد رصيد افتتاحي من Excel',
      })
    } else if (s.on_hand > 0) {
      await db.from('inventory_movements').insert({
        branch_id:     branchId,
        ingredient_id: ingredientId,
        lot_id:        null,
        movement_type: 'opening_balance',
        quantity:      s.on_hand,
        unit_cost:     s.unit_cost,
        notes:         'استيراد رصيد افتتاحي من Excel',
      })
    }

    void stockRow // used for conflict resolution only
  }

  // j. Upsert par_levels
  const parRows = parLevels
    .filter((p) => ingredientNameToId.has(p.ingredient_name_ar) && branchNameToId.has(p.branch_name))
    .map((p) => ({
      branch_id:     branchNameToId.get(p.branch_name)!,
      ingredient_id: ingredientNameToId.get(p.ingredient_name_ar)!,
      day_type:      p.day_type,
      par_qty:       p.par_qty,
      reorder_qty:   p.reorder_qty,
    }))

  if (parRows.length > 0) {
    await db.from('par_levels').upsert(parRows, {
      onConflict: 'branch_id,ingredient_id,day_type',
      ignoreDuplicates: false,
    })
  }

  // Trigger ABC classification update
  await db.rpc('rpc_update_abc_classification')

  const auditSummary: Record<string, number> = {
    ingredients: summary.ingredients,
    suppliers: summary.suppliers,
    allergens: summary.allergens,
    prepItems: summary.prepItems,
    prepIngredients: summary.prepIngredients,
    recipes: summary.recipes,
    openingStock: summary.openingStock,
    lots: summary.lots,
    movements: summary.movements,
    parLevels: summary.parLevels,
  }

  await db.from('audit_logs').insert({
    table_name: 'inventory_import',
    record_id: session.id,
    action: 'INSERT',
    user_id: session.id,
    actor_role: session.role,
    changes: { summary: auditSummary, mode: 'import' },
  })

  return { success: true, imported: true, summary, errors: [], warnings }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function countUniqueSuppliers(ingredients: ParsedIngredient[]): number {
  return new Set(ingredients.map((i) => i.supplier_name).filter(Boolean)).size
}

function buildIngredientRecord(
  i: ParsedIngredient,
  supplierNameToId: Map<string, string>,
): TablesInsert<'ingredients'> {
  return {
    name_ar:              i.name_ar,
    name_en:              i.name_en,
    unit:                 i.unit as TablesInsert<'ingredients'>['unit'],
    purchase_unit:        i.purchase_unit,
    purchase_unit_factor: i.purchase_unit_factor,
    cost_per_unit:        i.cost_per_unit,
    default_yield_factor: i.default_yield_factor,
    category:             i.category as TablesInsert<'ingredients'>['category'],
    reorder_point:        i.reorder_point,
    max_stock_level:      i.max_stock_level,
    reorder_qty:          i.reorder_qty,
    shelf_life_days:      i.shelf_life_days,
    storage_temp:         i.storage_temp as TablesInsert<'ingredients'>['storage_temp'],
    barcode:              i.barcode,
    supplier_id:          i.supplier_name ? (supplierNameToId.get(i.supplier_name) ?? null) : null,
    is_active:            true,
  }
}
