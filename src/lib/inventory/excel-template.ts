import ExcelJS from 'exceljs'

// ─── allowed value lists (must match DB CHECK constraints) ───────────────────

export const INGREDIENT_UNITS = [
  'g','kg','ml','l','unit','tbsp','tsp','oz','lb','piece','portion','bottle','can','bag','box',
] as const

export const PREP_ITEM_UNITS = [
  'g','kg','ml','l','unit','portion','batch',
] as const

export const INGREDIENT_CATEGORIES = [
  'protein','grain','vegetable','dairy','seafood','spice','oil',
  'beverage','sauce','packaging','cleaning','disposable','other',
] as const

export const STORAGE_TEMPS = ['frozen','chilled','ambient','dry'] as const
export const PREP_STORAGE_TEMPS = ['frozen','chilled','ambient'] as const
export const DAY_TYPES = ['default','weekend','ramadan','event','holiday'] as const
export const ALLERGEN_VALUES = [
  'gluten','dairy','eggs','nuts','peanuts','soy','fish','shellfish',
  'sesame','mustard','celery','lupin','molluscs','sulphites',
] as const

// ─── styles ──────────────────────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' },
}

const EXAMPLE_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' },
}

// ─── types ───────────────────────────────────────────────────────────────────

interface ColDef {
  ar: string
  en: string
  key: string
  width: number
  required?: boolean
  dropdown?: readonly string[]
}

// ─── helper: add a sheet ─────────────────────────────────────────────────────

function addSheet(
  wb: ExcelJS.Workbook,
  tabName: string,
  cols: ColDef[],
  exampleValues: (string | number | null)[],
) {
  const ws = wb.addWorksheet(tabName)

  ws.columns = cols.map((c) => ({
    header: `${c.ar}${c.required ? '*' : ''}\n${c.en}${c.required ? '*' : ''}`,
    key: c.key,
    width: c.width,
  }))

  // Style header row
  const hRow = ws.getRow(1)
  hRow.height = 42
  hRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 10 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFCCA000' } },
    }
  })

  // Example data row
  const eRow = ws.addRow(exampleValues)
  eRow.eachCell((cell) => {
    cell.fill = EXAMPLE_FILL
    cell.font = { italic: true, color: { argb: 'FF777777' }, name: 'Arial', size: 10 }
    cell.alignment = { vertical: 'middle' }
  })

  // Freeze first row
  ws.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }]

  // Dropdowns via cell-level dataValidation (ExcelJS 4.x types don't expose ws.dataValidations)
  // Apply to rows 2–100 which covers typical import sizes
  cols.forEach((c, idx) => {
    if (!c.dropdown?.length) return
    const rule: ExcelJS.DataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${c.dropdown.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'قيمة غير صحيحة',
      error: `اختر قيمة: ${c.dropdown.slice(0, 6).join(', ')}`,
    }
    for (let row = 2; row <= 100; row++) {
      ws.getCell(row, idx + 1).dataValidation = rule
    }
  })

  return ws
}

// ─── public: generate the workbook buffer ────────────────────────────────────

export async function generateExcelTemplate(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Kahramana Baghdad'
  wb.created = new Date()

  // ── Sheet 1: ingredients ─────────────────────────────────────────────────
  addSheet(wb, 'المكونات', [
    { ar: 'الاسم بالعربية',         en: 'name_ar',               key: 'name_ar',               width: 24, required: true },
    { ar: 'الاسم بالإنجليزية',       en: 'name_en',               key: 'name_en',               width: 24, required: true },
    { ar: 'وحدة القياس',             en: 'unit',                  key: 'unit',                  width: 12, required: true, dropdown: INGREDIENT_UNITS },
    { ar: 'وحدة الشراء',             en: 'purchase_unit',         key: 'purchase_unit',         width: 14 },
    { ar: 'معامل وحدة الشراء',       en: 'purchase_unit_factor',  key: 'purchase_unit_factor',  width: 18 },
    { ar: 'تكلفة الوحدة (BHD)',      en: 'cost_per_unit',         key: 'cost_per_unit',         width: 18, required: true },
    { ar: 'معامل الهالك الافتراضي',  en: 'default_yield_factor',  key: 'default_yield_factor',  width: 20 },
    { ar: 'التصنيف',                 en: 'category',              key: 'category',              width: 16, dropdown: INGREDIENT_CATEGORIES },
    { ar: 'نقطة إعادة الطلب',        en: 'reorder_point',         key: 'reorder_point',         width: 18 },
    { ar: 'الحد الأقصى للمخزون',     en: 'max_stock_level',       key: 'max_stock_level',       width: 20 },
    { ar: 'كمية إعادة الطلب',        en: 'reorder_qty',           key: 'reorder_qty',           width: 18 },
    { ar: 'مدة الصلاحية (أيام)',      en: 'shelf_life_days',       key: 'shelf_life_days',       width: 18 },
    { ar: 'درجة حرارة التخزين',      en: 'storage_temp',          key: 'storage_temp',          width: 20, dropdown: STORAGE_TEMPS },
    { ar: 'الباركود',                en: 'barcode',               key: 'barcode',               width: 16 },
    { ar: 'اسم المورد',              en: 'supplier_name',         key: 'supplier_name',         width: 20 },
    { ar: 'مسببات الحساسية (فاصلة)', en: 'allergens',             key: 'allergens',             width: 28 },
  ], [
    'دجاج طازج', 'Fresh Chicken', 'kg', 'kg', 1, 1.500, 1.050, 'protein',
    5, 50, 10, 3, 'chilled', null, 'مورد الدجاج', 'dairy,gluten',
  ])

  // ── Sheet 2: prep_items ──────────────────────────────────────────────────
  addSheet(wb, 'Prep Items', [
    { ar: 'الاسم بالعربية',    en: 'name_ar',         key: 'name_ar',         width: 28, required: true },
    { ar: 'الاسم بالإنجليزية', en: 'name_en',         key: 'name_en',         width: 28, required: true },
    { ar: 'وحدة القياس',       en: 'unit',            key: 'unit',            width: 14, required: true, dropdown: PREP_ITEM_UNITS },
    { ar: 'كمية الدفعة',       en: 'batch_yield_qty', key: 'batch_yield_qty', width: 16, required: true },
    { ar: 'صلاحية (ساعات)',    en: 'shelf_life_hours',key: 'shelf_life_hours',width: 16 },
    { ar: 'درجة التخزين',      en: 'storage_temp',    key: 'storage_temp',    width: 18, dropdown: PREP_STORAGE_TEMPS },
  ], ['صلصة طماطم', 'Tomato Sauce', 'kg', 10, 48, 'chilled'])

  // ── Sheet 3: prep_ingredients ────────────────────────────────────────────
  addSheet(wb, 'مكونات Prep', [
    { ar: 'اسم Prep Item (عربي)',  en: 'prep_item_name_ar',     key: 'prep_item_name_ar',     width: 28, required: true },
    { ar: 'اسم المكون (عربي)',     en: 'ingredient_name_ar',    key: 'ingredient_name_ar',    width: 28, required: true },
    { ar: 'الكمية',                en: 'quantity',               key: 'quantity',              width: 12, required: true },
    { ar: 'معامل الهالك (اختياري)',en: 'yield_factor_override',  key: 'yield_factor_override', width: 22 },
  ], ['صلصة طماطم', 'طماطم طازجة', 8, null])

  // ── Sheet 4: recipes ─────────────────────────────────────────────────────
  addSheet(wb, 'الوصفات', [
    { ar: 'رمز الوجبة (slug)',     en: 'menu_item_slug',        key: 'menu_item_slug',        width: 28, required: true },
    { ar: 'اسم المكون (عربي)',     en: 'ingredient_name_ar',    key: 'ingredient_name_ar',    width: 24 },
    { ar: 'اسم Prep Item (عربي)', en: 'prep_item_name_ar',     key: 'prep_item_name_ar',     width: 24 },
    { ar: 'الكمية',                en: 'quantity',               key: 'quantity',              width: 12, required: true },
    { ar: 'رمز الحجم',             en: 'variant_key',            key: 'variant_key',           width: 14 },
    { ar: 'معامل الهالك',          en: 'yield_factor_override',  key: 'yield_factor_override', width: 18 },
    { ar: 'اختياري؟ (yes/no)',     en: 'is_optional',            key: 'is_optional',           width: 16, dropdown: ['yes','no'] },
  ], ['chicken-machboos', 'دجاج طازج', null, 0.5, null, null, 'no'])

  // ── Sheet 5: opening_stock ───────────────────────────────────────────────
  addSheet(wb, 'المخزون الافتتاحي', [
    { ar: 'اسم المكون (عربي)',     en: 'ingredient_name_ar',    key: 'ingredient_name_ar',    width: 28, required: true },
    { ar: 'اسم الفرع',             en: 'branch_name',            key: 'branch_name',           width: 20, required: true },
    { ar: 'الكمية الحالية',        en: 'on_hand',                key: 'on_hand',               width: 16, required: true },
    { ar: 'نقطة الطلب (تجاوز)',    en: 'reorder_point_override', key: 'reorder_point_override',width: 20 },
    { ar: 'رقم الدفعة',            en: 'lot_number',             key: 'lot_number',            width: 16 },
    { ar: 'تاريخ الانتهاء',        en: 'expiry_date',            key: 'expiry_date',           width: 18 },
    { ar: 'تكلفة الوحدة (BHD)',    en: 'unit_cost',              key: 'unit_cost',             width: 18 },
  ], ['دجاج طازج', 'الرفاع', 25, null, 'LOT-001', '2026-08-15', 1.500])

  // ── Sheet 6: par_levels ──────────────────────────────────────────────────
  addSheet(wb, 'مستويات Par', [
    { ar: 'اسم المكون (عربي)', en: 'ingredient_name_ar', key: 'ingredient_name_ar', width: 28, required: true },
    { ar: 'اسم الفرع',         en: 'branch_name',         key: 'branch_name',        width: 20, required: true },
    { ar: 'نوع اليوم',         en: 'day_type',            key: 'day_type',           width: 14, required: true, dropdown: DAY_TYPES },
    { ar: 'كمية Par',          en: 'par_qty',             key: 'par_qty',            width: 14, required: true },
    { ar: 'كمية إعادة الطلب',  en: 'reorder_qty',         key: 'reorder_qty',        width: 18, required: true },
  ], ['دجاج طازج', 'الرفاع', 'default', 10, 5])

  // ExcelJS declares `interface Buffer extends ArrayBuffer {}` with no extra members,
  // making any ExcelJS.Buffer structurally compatible with ArrayBuffer for BodyInit.
  const raw = await wb.xlsx.writeBuffer()
  return raw as ArrayBuffer
}
