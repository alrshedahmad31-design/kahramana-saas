'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardGuardErrorMessage, requireDashboardRole } from '@/lib/auth/dashboard-guards'
import { parseRecipeImportExcel, type RecipeRowError } from '@/lib/inventory/recipe-import-parser'

export interface RecipeImportRowResult {
  row: number
  menu_item_slug: string
  ingredient_id: string
  reason_ar: string
  reason_en: string
}

export interface RecipeImportSummary {
  total: number
  inserted: number
  skipped: number
  failed: number
}

export interface RecipeImportActionResult {
  ok: boolean
  imported: boolean
  summary: RecipeImportSummary
  errors: RecipeRowError[]
  skipped: RecipeImportRowResult[]
  failed: RecipeImportRowResult[]
  fatal_ar?: string
  fatal_en?: string
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'inventory_manager'] as const

function blank(): RecipeImportActionResult {
  return {
    ok: false,
    imported: false,
    summary: { total: 0, inserted: 0, skipped: 0, failed: 0 },
    errors: [],
    skipped: [],
    failed: [],
  }
}

export async function importRecipesExcel(
  formData: FormData,
): Promise<RecipeImportActionResult> {
  let session
  try {
    session = await requireDashboardRole(ALLOWED_ROLES)
  } catch (err) {
    return {
      ...blank(),
      fatal_ar: 'صلاحيات غير كافية',
      fatal_en: getDashboardGuardErrorMessage(err),
    }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return {
      ...blank(),
      fatal_ar: 'لم يتم إرفاق ملف',
      fatal_en: 'No file attached',
    }
  }

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return {
      ...blank(),
      fatal_ar: 'يجب أن يكون الملف بصيغة .xlsx',
      fatal_en: 'File must be a .xlsx workbook',
    }
  }

  if (file.size > 10 * 1024 * 1024) {
    return {
      ...blank(),
      fatal_ar: 'حجم الملف يتجاوز 10 MB',
      fatal_en: 'File size exceeds 10 MB',
    }
  }

  const mode = (formData.get('mode') as string | null) ?? 'analyze'

  const arrayBuf = await file.arrayBuffer()

  let parsed
  try {
    parsed = await parseRecipeImportExcel(arrayBuf)
  } catch {
    return {
      ...blank(),
      fatal_ar: 'تعذّر قراءة ملف Excel — تأكّد أنه ملف .xlsx صالح',
      fatal_en: 'Could not read Excel file — make sure it is a valid .xlsx',
    }
  }

  const { rows, errors } = parsed

  const db = createServiceClient()

  // Validate slugs and ingredient ids exist in the DB.
  const slugSet = new Set(rows.map((r) => r.menu_item_slug))
  const idSet = new Set(rows.map((r) => r.ingredient_id))

  const [slugRes, ingRes] = await Promise.all([
    slugSet.size > 0
      ? db.from('menu_items_sync').select('slug').in('slug', Array.from(slugSet))
      : Promise.resolve({ data: [] as Array<{ slug: string }>, error: null }),
    idSet.size > 0
      ? db.from('ingredients').select('id, unit').in('id', Array.from(idSet))
      : Promise.resolve({ data: [] as Array<{ id: string; unit: string }>, error: null }),
  ])

  const validSlugs = new Set((slugRes.data ?? []).map((r) => r.slug))
  const ingredientUnit = new Map(
    (ingRes.data ?? []).map((r) => [r.id, r.unit] as const),
  )

  // Existing recipes for the (slug, ingredient_id) pairs we care about — used
  // to detect duplicates without depending on the table's NULLS-NOT-DISTINCT
  // composite key (which also includes prep_item_id + variant_key).
  const { data: existingRows } = slugSet.size > 0
    ? await db
        .from('recipes')
        .select('menu_item_slug, ingredient_id')
        .in('menu_item_slug', Array.from(slugSet))
    : { data: [] as Array<{ menu_item_slug: string; ingredient_id: string | null }> }

  const existingKey = new Set(
    (existingRows ?? [])
      .filter((r) => r.ingredient_id !== null)
      .map((r) => `${r.menu_item_slug}::${r.ingredient_id}`),
  )

  const failed: RecipeImportRowResult[] = []
  const skipped: RecipeImportRowResult[] = []
  const toInsert: typeof rows = []

  // De-duplicate within the workbook itself — first occurrence wins, the rest
  // are reported as skipped so the chef can clean their sheet.
  const seenInBatch = new Set<string>()

  for (const r of rows) {
    if (!validSlugs.has(r.menu_item_slug)) {
      failed.push({
        row: r.row_num,
        menu_item_slug: r.menu_item_slug,
        ingredient_id: r.ingredient_id,
        reason_ar: `الـ slug غير موجود في قائمة الطعام: ${r.menu_item_slug}`,
        reason_en: `Slug not found in menu items: ${r.menu_item_slug}`,
      })
      continue
    }
    if (!ingredientUnit.has(r.ingredient_id)) {
      failed.push({
        row: r.row_num,
        menu_item_slug: r.menu_item_slug,
        ingredient_id: r.ingredient_id,
        reason_ar: `معرّف المكوّن غير موجود في جدول المكونات`,
        reason_en: `ingredient_id not found in ingredients table`,
      })
      continue
    }

    const key = `${r.menu_item_slug}::${r.ingredient_id}`
    if (existingKey.has(key)) {
      skipped.push({
        row: r.row_num,
        menu_item_slug: r.menu_item_slug,
        ingredient_id: r.ingredient_id,
        reason_ar: 'وصفة موجودة مسبقًا',
        reason_en: 'Recipe already exists',
      })
      continue
    }
    if (seenInBatch.has(key)) {
      skipped.push({
        row: r.row_num,
        menu_item_slug: r.menu_item_slug,
        ingredient_id: r.ingredient_id,
        reason_ar: 'سطر مكرر داخل نفس الملف',
        reason_en: 'Duplicate row in the same workbook',
      })
      continue
    }

    seenInBatch.add(key)
    toInsert.push(r)
  }

  const summary: RecipeImportSummary = {
    total: rows.length,
    inserted: toInsert.length,
    skipped: skipped.length,
    failed: failed.length + errors.length,
  }

  // Analyze-only or blocking parse errors → return preview without writing.
  if (mode !== 'import' || errors.length > 0) {
    return {
      ok: true,
      imported: false,
      summary,
      errors,
      skipped,
      failed,
    }
  }

  if (toInsert.length > 0) {
    const insertRows = toInsert.map((r) => ({
      menu_item_slug: r.menu_item_slug,
      ingredient_id: r.ingredient_id,
      prep_item_id: null,
      quantity: r.quantity_used,
      variant_key: null,
      yield_factor: null,
      is_optional: false,
      updated_by: session.id,
      updated_at: new Date().toISOString(),
    }))

    const { error: insError } = await db.from('recipes').insert(insertRows)
    if (insError) {
      return {
        ...blank(),
        fatal_ar: `فشل إدراج الوصفات: ${insError.message}`,
        fatal_en: `Recipe insert failed: ${insError.message}`,
      }
    }
  }

  await db.from('audit_logs').insert({
    table_name: 'recipes',
    record_id: session.id,
    action: 'INSERT',
    user_id: session.id,
    actor_role: session.role,
    changes: {
      source: 'chef_excel_import',
      total: summary.total,
      inserted: summary.inserted,
      skipped: summary.skipped,
      failed: summary.failed,
    },
  })

  revalidatePath('/dashboard/inventory/recipes')
  revalidatePath('/dashboard/inventory')

  return {
    ok: true,
    imported: true,
    summary,
    errors: [],
    skipped,
    failed,
  }
}
