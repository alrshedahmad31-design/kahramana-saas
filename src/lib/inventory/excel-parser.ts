import ExcelJS from 'exceljs'
import {
  INGREDIENT_UNITS,
  PREP_ITEM_UNITS,
  INGREDIENT_CATEGORIES,
  STORAGE_TEMPS,
  PREP_STORAGE_TEMPS,
  DAY_TYPES,
  ALLERGEN_VALUES,
} from './excel-template'

// ─── public types ─────────────────────────────────────────────────────────────

export interface ImportError {
  sheet: string
  row: number
  column: string
  message: string
}

export interface ImportWarning {
  sheet: string
  row: number
  column: string
  message: string
}

export interface ParsedIngredient {
  name_ar: string
  name_en: string
  unit: string
  purchase_unit: string | null
  purchase_unit_factor: number | null
  cost_per_unit: number
  default_yield_factor: number
  category: string | null
  reorder_point: number | null
  max_stock_level: number | null
  reorder_qty: number | null
  shelf_life_days: number | null
  storage_temp: string | null
  barcode: string | null
  supplier_name: string | null
  allergens: string[]
}

export interface ParsedPrepItem {
  name_ar: string
  name_en: string
  unit: string
  batch_yield_qty: number
  shelf_life_hours: number | null
  storage_temp: string | null
}

export interface ParsedPrepIngredient {
  prep_item_name_ar: string
  ingredient_name_ar: string
  quantity: number
  yield_factor_override: number | null
}

export interface ParsedRecipe {
  menu_item_slug: string
  ingredient_name_ar: string | null
  prep_item_name_ar: string | null
  quantity: number
  variant_key: string | null
  yield_factor_override: number | null
  is_optional: boolean
}

export interface ParsedOpeningStock {
  ingredient_name_ar: string
  branch_name: string
  on_hand: number
  reorder_point_override: number | null
  lot_number: string | null
  expiry_date: Date | null
  unit_cost: number | null
}

export interface ParsedParLevel {
  ingredient_name_ar: string
  branch_name: string
  day_type: string
  par_qty: number
  reorder_qty: number
}

export interface ImportResult {
  ingredients: ParsedIngredient[]
  prepItems: ParsedPrepItem[]
  prepIngredients: ParsedPrepIngredient[]
  recipes: ParsedRecipe[]
  openingStock: ParsedOpeningStock[]
  parLevels: ParsedParLevel[]
  errors: ImportError[]
  warnings: ImportWarning[]
}

// ─── cell value helpers ───────────────────────────────────────────────────────

function cellStr(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (v instanceof Date) return v.toISOString().split('T')[0]
  if (typeof v === 'object') {
    if ('richText' in v) {
      return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('').trim()
    }
    if ('result' in v && v.result !== undefined) {
      return cellStr(v.result as ExcelJS.CellValue)
    }
    if ('text' in v) {
      return String((v as { text: string }).text).trim()
    }
  }
  return String(v).trim()
}

function cellNum(v: ExcelJS.CellValue): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (v instanceof Date) return null
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, '').trim())
    return isNaN(n) ? null : n
  }
  if (typeof v === 'object' && 'result' in v && v.result !== undefined) {
    return cellNum(v.result as ExcelJS.CellValue)
  }
  return null
}

function cellDate(v: ExcelJS.CellValue): Date | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const s = cellStr(v)
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function isRowEmpty(row: ExcelJS.Row, numCols: number): boolean {
  for (let i = 1; i <= numCols; i++) {
    if (cellStr(row.getCell(i).value).length > 0) return false
  }
  return true
}

// ─── public: parse workbook buffer ───────────────────────────────────────────

export async function parseInventoryExcel(
  data: ArrayBuffer,
  opts: {
    menuSlugs: string[]
    branchNames: string[]
  },
): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook()
  // ExcelJS.Buffer extends ArrayBuffer with no extra members — structurally compatible
  await wb.xlsx.load(data as ExcelJS.Buffer)

  const errors: ImportError[] = []
  const warnings: ImportWarning[] = []

  // ── Sheet 1: ingredients ──────────────────────────────────────────────────
  const ingredients: ParsedIngredient[] = []
  const wsIng = wb.getWorksheet('المكونات')

  if (!wsIng) {
    errors.push({ sheet: 'المكونات', row: 0, column: '-', message: 'ورقة المكونات غير موجودة في الملف' })
  } else {
    wsIng.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return
      if (isRowEmpty(row, 16)) return

      const name_ar = cellStr(row.getCell(1).value)
      const name_en = cellStr(row.getCell(2).value)
      const unit    = cellStr(row.getCell(3).value)

      if (!name_ar) errors.push({ sheet: 'المكونات', row: rowNum, column: 'name_ar', message: 'الاسم بالعربية مطلوب' })
      if (!name_en) errors.push({ sheet: 'المكونات', row: rowNum, column: 'name_en', message: 'الاسم بالإنجليزية مطلوب' })

      if (!unit) {
        errors.push({ sheet: 'المكونات', row: rowNum, column: 'unit', message: 'وحدة القياس مطلوبة' })
      } else if (!(INGREDIENT_UNITS as readonly string[]).includes(unit)) {
        errors.push({ sheet: 'المكونات', row: rowNum, column: 'unit', message: `وحدة القياس "${unit}" غير صحيحة` })
      }

      const cost_per_unit_raw = cellNum(row.getCell(6).value)
      if (cost_per_unit_raw === null) {
        errors.push({ sheet: 'المكونات', row: rowNum, column: 'cost_per_unit', message: 'تكلفة الوحدة مطلوبة ويجب أن تكون رقمًا' })
      } else if (cost_per_unit_raw < 0) {
        errors.push({ sheet: 'المكونات', row: rowNum, column: 'cost_per_unit', message: 'تكلفة الوحدة يجب أن تكون >= 0' })
      }

      const default_yield_factor_raw = cellNum(row.getCell(7).value)
      if (default_yield_factor_raw !== null && default_yield_factor_raw < 1) {
        errors.push({ sheet: 'المكونات', row: rowNum, column: 'default_yield_factor', message: 'معامل الهالك يجب أن يكون >= 1.000' })
      }
      if (default_yield_factor_raw === null && cellStr(row.getCell(7).value) === '') {
        warnings.push({ sheet: 'المكونات', row: rowNum, column: 'default_yield_factor', message: 'معامل الهالك فارغ، سيُستخدم 1.000' })
      }

      const category = cellStr(row.getCell(8).value) || null
      if (category && !(INGREDIENT_CATEGORIES as readonly string[]).includes(category)) {
        errors.push({ sheet: 'المكونات', row: rowNum, column: 'category', message: `التصنيف "${category}" غير صحيح` })
      }

      const storage_temp = cellStr(row.getCell(13).value) || null
      if (storage_temp && !(STORAGE_TEMPS as readonly string[]).includes(storage_temp)) {
        errors.push({ sheet: 'المكونات', row: rowNum, column: 'storage_temp', message: `درجة حرارة التخزين "${storage_temp}" غير صحيحة` })
      }

      const allergensRaw = cellStr(row.getCell(16).value)
      const allergens = allergensRaw ? allergensRaw.split(',').map((a) => a.trim()).filter(Boolean) : []
      for (const a of allergens) {
        if (!(ALLERGEN_VALUES as readonly string[]).includes(a)) {
          errors.push({ sheet: 'المكونات', row: rowNum, column: 'allergens', message: `مسبب حساسية "${a}" غير صحيح` })
        }
      }

      const purchase_unit_factor = cellNum(row.getCell(5).value)
      if (purchase_unit_factor !== null && purchase_unit_factor < 0) {
        errors.push({ sheet: 'المكونات', row: rowNum, column: 'purchase_unit_factor', message: 'معامل وحدة الشراء يجب أن يكون >= 0' })
      }

      if (!name_ar || !name_en || !unit || cost_per_unit_raw === null) return

      ingredients.push({
        name_ar,
        name_en,
        unit,
        purchase_unit: cellStr(row.getCell(4).value) || null,
        purchase_unit_factor,
        cost_per_unit: cost_per_unit_raw,
        default_yield_factor: default_yield_factor_raw ?? 1.000,
        category,
        reorder_point: cellNum(row.getCell(9).value),
        max_stock_level: cellNum(row.getCell(10).value),
        reorder_qty: cellNum(row.getCell(11).value),
        shelf_life_days: cellNum(row.getCell(12).value) !== null ? Math.round(cellNum(row.getCell(12).value)!) : null,
        storage_temp,
        barcode: cellStr(row.getCell(14).value) || null,
        supplier_name: cellStr(row.getCell(15).value) || null,
        allergens,
      })
    })
  }

  // ── Sheet 2: prep_items ───────────────────────────────────────────────────
  const prepItems: ParsedPrepItem[] = []
  const wsPrep = wb.getWorksheet('Prep Items')

  if (wsPrep) {
    wsPrep.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return
      if (isRowEmpty(row, 6)) return

      const name_ar = cellStr(row.getCell(1).value)
      const name_en = cellStr(row.getCell(2).value)
      const unit    = cellStr(row.getCell(3).value)
      const batch_yield_qty = cellNum(row.getCell(4).value)

      if (!name_ar) errors.push({ sheet: 'Prep Items', row: rowNum, column: 'name_ar', message: 'الاسم بالعربية مطلوب' })
      if (!name_en) errors.push({ sheet: 'Prep Items', row: rowNum, column: 'name_en', message: 'الاسم بالإنجليزية مطلوب' })

      if (!unit) {
        errors.push({ sheet: 'Prep Items', row: rowNum, column: 'unit', message: 'وحدة القياس مطلوبة' })
      } else if (!(PREP_ITEM_UNITS as readonly string[]).includes(unit)) {
        errors.push({ sheet: 'Prep Items', row: rowNum, column: 'unit', message: `وحدة القياس "${unit}" غير صحيحة لـ Prep Items` })
      }

      if (batch_yield_qty === null || batch_yield_qty <= 0) {
        errors.push({ sheet: 'Prep Items', row: rowNum, column: 'batch_yield_qty', message: 'كمية الدفعة مطلوبة ويجب أن تكون > 0' })
      }

      const storage_temp = cellStr(row.getCell(6).value) || null
      if (storage_temp && !(PREP_STORAGE_TEMPS as readonly string[]).includes(storage_temp)) {
        errors.push({ sheet: 'Prep Items', row: rowNum, column: 'storage_temp', message: `درجة حرارة التخزين "${storage_temp}" غير صحيحة` })
      }

      if (!name_ar || !name_en || !unit || batch_yield_qty === null || batch_yield_qty <= 0) return

      prepItems.push({
        name_ar,
        name_en,
        unit,
        batch_yield_qty,
        shelf_life_hours: cellNum(row.getCell(5).value) !== null ? Math.round(cellNum(row.getCell(5).value)!) : null,
        storage_temp,
      })
    })
  }

  // Lookup sets for cross-sheet validation
  const ingredientNameSet = new Set(ingredients.map((i) => i.name_ar))
  const prepItemNameSet   = new Set(prepItems.map((p) => p.name_ar))
  const branchNameSet     = new Set(opts.branchNames)
  const menuSlugSet       = new Set(opts.menuSlugs)

  // ── Sheet 3: prep_ingredients ─────────────────────────────────────────────
  const prepIngredients: ParsedPrepIngredient[] = []
  const wsPrepIng = wb.getWorksheet('مكونات Prep')

  if (wsPrepIng) {
    wsPrepIng.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return
      if (isRowEmpty(row, 4)) return

      const prep_item_name_ar   = cellStr(row.getCell(1).value)
      const ingredient_name_ar  = cellStr(row.getCell(2).value)
      const quantity            = cellNum(row.getCell(3).value)

      if (!prep_item_name_ar) errors.push({ sheet: 'مكونات Prep', row: rowNum, column: 'prep_item_name_ar', message: 'اسم Prep Item مطلوب' })
      if (!ingredient_name_ar) errors.push({ sheet: 'مكونات Prep', row: rowNum, column: 'ingredient_name_ar', message: 'اسم المكون مطلوب' })
      if (quantity === null || quantity <= 0) errors.push({ sheet: 'مكونات Prep', row: rowNum, column: 'quantity', message: 'الكمية مطلوبة ويجب أن تكون > 0' })

      if (prep_item_name_ar && !prepItemNameSet.has(prep_item_name_ar)) {
        errors.push({ sheet: 'مكونات Prep', row: rowNum, column: 'prep_item_name_ar', message: `Prep Item "${prep_item_name_ar}" غير موجود في ورقة Prep Items` })
      }
      if (ingredient_name_ar && !ingredientNameSet.has(ingredient_name_ar)) {
        errors.push({ sheet: 'مكونات Prep', row: rowNum, column: 'ingredient_name_ar', message: `المكون "${ingredient_name_ar}" غير موجود في ورقة المكونات` })
      }

      const yield_factor_override = cellNum(row.getCell(4).value)
      if (yield_factor_override !== null && yield_factor_override < 1) {
        errors.push({ sheet: 'مكونات Prep', row: rowNum, column: 'yield_factor_override', message: 'معامل الهالك يجب أن يكون >= 1.000' })
      }

      if (!prep_item_name_ar || !ingredient_name_ar || quantity === null || quantity <= 0) return

      prepIngredients.push({
        prep_item_name_ar,
        ingredient_name_ar,
        quantity,
        yield_factor_override,
      })
    })
  }

  // ── Sheet 4: recipes ──────────────────────────────────────────────────────
  const recipes: ParsedRecipe[] = []
  const wsRecipes = wb.getWorksheet('الوصفات')

  if (wsRecipes) {
    wsRecipes.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return
      if (isRowEmpty(row, 7)) return

      const menu_item_slug      = cellStr(row.getCell(1).value)
      const ingredient_name_ar  = cellStr(row.getCell(2).value) || null
      const prep_item_name_ar   = cellStr(row.getCell(3).value) || null
      const quantity            = cellNum(row.getCell(4).value)

      if (!menu_item_slug) errors.push({ sheet: 'الوصفات', row: rowNum, column: 'menu_item_slug', message: 'رمز الوجبة مطلوب' })
      if (quantity === null || quantity <= 0) errors.push({ sheet: 'الوصفات', row: rowNum, column: 'quantity', message: 'الكمية مطلوبة ويجب أن تكون > 0' })

      if (menu_item_slug && !menuSlugSet.has(menu_item_slug)) {
        errors.push({ sheet: 'الوصفات', row: rowNum, column: 'menu_item_slug', message: `slug "${menu_item_slug}" غير موجود في قائمة الوجبات` })
      }

      if (!ingredient_name_ar && !prep_item_name_ar) {
        errors.push({ sheet: 'الوصفات', row: rowNum, column: 'ingredient_name_ar', message: 'يجب تحديد مكون أو Prep Item (ليس كلاهما فارغًا)' })
      }
      if (ingredient_name_ar && prep_item_name_ar) {
        errors.push({ sheet: 'الوصفات', row: rowNum, column: 'ingredient_name_ar', message: 'لا يمكن تحديد مكون وPrep Item في نفس السطر' })
      }

      if (ingredient_name_ar && !ingredientNameSet.has(ingredient_name_ar)) {
        errors.push({ sheet: 'الوصفات', row: rowNum, column: 'ingredient_name_ar', message: `المكون "${ingredient_name_ar}" غير موجود في ورقة المكونات` })
      }
      if (prep_item_name_ar && !prepItemNameSet.has(prep_item_name_ar)) {
        errors.push({ sheet: 'الوصفات', row: rowNum, column: 'prep_item_name_ar', message: `Prep Item "${prep_item_name_ar}" غير موجود في ورقة Prep Items` })
      }

      const yield_factor_override = cellNum(row.getCell(6).value)
      if (yield_factor_override !== null && yield_factor_override < 1) {
        errors.push({ sheet: 'الوصفات', row: rowNum, column: 'yield_factor_override', message: 'معامل الهالك يجب أن يكون >= 1.000' })
      }

      if (!menu_item_slug || quantity === null || quantity <= 0) return

      const isOptRaw = cellStr(row.getCell(7).value).toLowerCase()
      const is_optional = isOptRaw === 'yes' || isOptRaw === 'true' || isOptRaw === '1'

      recipes.push({
        menu_item_slug,
        ingredient_name_ar,
        prep_item_name_ar,
        quantity,
        variant_key: cellStr(row.getCell(5).value) || null,
        yield_factor_override,
        is_optional,
      })
    })
  }

  // ── Sheet 5: opening_stock ────────────────────────────────────────────────
  const openingStock: ParsedOpeningStock[] = []
  const wsStock = wb.getWorksheet('المخزون الافتتاحي')

  if (wsStock) {
    wsStock.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return
      if (isRowEmpty(row, 7)) return

      const ingredient_name_ar = cellStr(row.getCell(1).value)
      const branch_name        = cellStr(row.getCell(2).value)
      const on_hand            = cellNum(row.getCell(3).value)

      if (!ingredient_name_ar) errors.push({ sheet: 'المخزون الافتتاحي', row: rowNum, column: 'ingredient_name_ar', message: 'اسم المكون مطلوب' })
      if (!branch_name) errors.push({ sheet: 'المخزون الافتتاحي', row: rowNum, column: 'branch_name', message: 'اسم الفرع مطلوب' })
      if (on_hand === null || on_hand < 0) errors.push({ sheet: 'المخزون الافتتاحي', row: rowNum, column: 'on_hand', message: 'الكمية الحالية مطلوبة ويجب أن تكون >= 0' })

      if (ingredient_name_ar && !ingredientNameSet.has(ingredient_name_ar)) {
        errors.push({ sheet: 'المخزون الافتتاحي', row: rowNum, column: 'ingredient_name_ar', message: `المكون "${ingredient_name_ar}" غير موجود في ورقة المكونات` })
      }
      if (branch_name && !branchNameSet.has(branch_name)) {
        errors.push({ sheet: 'المخزون الافتتاحي', row: rowNum, column: 'branch_name', message: `الفرع "${branch_name}" غير موجود في النظام` })
      }

      const expiryDate = cellDate(row.getCell(6).value)
      if (row.getCell(6).value !== null && cellStr(row.getCell(6).value) !== '' && expiryDate === null) {
        errors.push({ sheet: 'المخزون الافتتاحي', row: rowNum, column: 'expiry_date', message: 'تاريخ الانتهاء غير صحيح' })
      }
      if (expiryDate && expiryDate < new Date()) {
        errors.push({ sheet: 'المخزون الافتتاحي', row: rowNum, column: 'expiry_date', message: 'تاريخ الانتهاء يجب أن يكون في المستقبل' })
      }

      const lot_number = cellStr(row.getCell(5).value) || null
      if (!lot_number && expiryDate) {
        warnings.push({ sheet: 'المخزون الافتتاحي', row: rowNum, column: 'lot_number', message: 'لا رقم دفعة لهذه الكمية المنتهية الصلاحية' })
      }

      const unit_cost = cellNum(row.getCell(7).value)
      if (unit_cost !== null && unit_cost < 0) {
        errors.push({ sheet: 'المخزون الافتتاحي', row: rowNum, column: 'unit_cost', message: 'تكلفة الوحدة يجب أن تكون >= 0' })
      }

      if (!ingredient_name_ar || !branch_name || on_hand === null || on_hand < 0) return

      openingStock.push({
        ingredient_name_ar,
        branch_name,
        on_hand,
        reorder_point_override: cellNum(row.getCell(4).value),
        lot_number,
        expiry_date: expiryDate,
        unit_cost,
      })
    })
  }

  // ── Sheet 6: par_levels ───────────────────────────────────────────────────
  const parLevels: ParsedParLevel[] = []
  const wsPar = wb.getWorksheet('مستويات Par')

  if (wsPar) {
    wsPar.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return
      if (isRowEmpty(row, 5)) return

      const ingredient_name_ar = cellStr(row.getCell(1).value)
      const branch_name        = cellStr(row.getCell(2).value)
      const day_type           = cellStr(row.getCell(3).value)
      const par_qty            = cellNum(row.getCell(4).value)
      const reorder_qty        = cellNum(row.getCell(5).value)

      if (!ingredient_name_ar) errors.push({ sheet: 'مستويات Par', row: rowNum, column: 'ingredient_name_ar', message: 'اسم المكون مطلوب' })
      if (!branch_name) errors.push({ sheet: 'مستويات Par', row: rowNum, column: 'branch_name', message: 'اسم الفرع مطلوب' })
      if (!day_type) errors.push({ sheet: 'مستويات Par', row: rowNum, column: 'day_type', message: 'نوع اليوم مطلوب' })
      else if (!(DAY_TYPES as readonly string[]).includes(day_type)) {
        errors.push({ sheet: 'مستويات Par', row: rowNum, column: 'day_type', message: `نوع اليوم "${day_type}" غير صحيح` })
      }
      if (par_qty === null || par_qty < 0) errors.push({ sheet: 'مستويات Par', row: rowNum, column: 'par_qty', message: 'كمية Par مطلوبة ويجب أن تكون >= 0' })
      if (reorder_qty === null || reorder_qty < 0) errors.push({ sheet: 'مستويات Par', row: rowNum, column: 'reorder_qty', message: 'كمية إعادة الطلب مطلوبة ويجب أن تكون >= 0' })

      if (ingredient_name_ar && !ingredientNameSet.has(ingredient_name_ar)) {
        errors.push({ sheet: 'مستويات Par', row: rowNum, column: 'ingredient_name_ar', message: `المكون "${ingredient_name_ar}" غير موجود في ورقة المكونات` })
      }
      if (branch_name && !branchNameSet.has(branch_name)) {
        errors.push({ sheet: 'مستويات Par', row: rowNum, column: 'branch_name', message: `الفرع "${branch_name}" غير موجود في النظام` })
      }

      if (!ingredient_name_ar || !branch_name || !day_type || par_qty === null || reorder_qty === null) return

      parLevels.push({
        ingredient_name_ar,
        branch_name,
        day_type,
        par_qty,
        reorder_qty,
      })
    })
  }

  return { ingredients, prepItems, prepIngredients, recipes, openingStock, parLevels, errors, warnings }
}
