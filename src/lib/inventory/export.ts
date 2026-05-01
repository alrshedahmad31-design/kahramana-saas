import ExcelJS from 'exceljs'
import { createServiceClient } from '@/lib/supabase/server'

// ─── styles (mirrors excel-template.ts) ──────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' },
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 36
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 10 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: 'FFCCA000' } } }
  })
}

function setColumnWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }]
}

// ─── public: export current DB data to workbook buffer ───────────────────────

export async function exportInventoryExcel(): Promise<ArrayBuffer> {
  const db = createServiceClient()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Kahramana Baghdad'
  wb.created = new Date()

  // ── Sheet 1: ingredients ─────────────────────────────────────────────────
  const wsIng = wb.addWorksheet('المكونات')
  wsIng.columns = [
    { header: 'الاسم بالعربية*\nname_ar*', key: 'name_ar', width: 24 },
    { header: 'الاسم بالإنجليزية*\nname_en*', key: 'name_en', width: 24 },
    { header: 'وحدة القياس*\nunit*', key: 'unit', width: 12 },
    { header: 'وحدة الشراء\npurchase_unit', key: 'purchase_unit', width: 14 },
    { header: 'معامل وحدة الشراء\npurchase_unit_factor', key: 'purchase_unit_factor', width: 18 },
    { header: 'تكلفة الوحدة (BHD)*\ncost_per_unit*', key: 'cost_per_unit', width: 18 },
    { header: 'معامل الهالك\ndefault_yield_factor', key: 'default_yield_factor', width: 20 },
    { header: 'التصنيف\ncategory', key: 'category', width: 16 },
    { header: 'نقطة إعادة الطلب\nreorder_point', key: 'reorder_point', width: 18 },
    { header: 'الحد الأقصى\nmax_stock_level', key: 'max_stock_level', width: 18 },
    { header: 'كمية إعادة الطلب\nreorder_qty', key: 'reorder_qty', width: 18 },
    { header: 'مدة الصلاحية (أيام)\nshelf_life_days', key: 'shelf_life_days', width: 18 },
    { header: 'درجة التخزين\nstorage_temp', key: 'storage_temp', width: 18 },
    { header: 'الباركود\nbarcode', key: 'barcode', width: 16 },
    { header: 'اسم المورد\nsupplier_name', key: 'supplier_name', width: 20 },
    { header: 'مسببات الحساسية\nallergens', key: 'allergens', width: 28 },
  ]
  styleHeader(wsIng.getRow(1))

  const { data: ingRows } = await db
    .from('ingredients')
    .select(`
      name_ar, name_en, unit, purchase_unit, purchase_unit_factor,
      cost_per_unit, default_yield_factor, category,
      reorder_point, max_stock_level, reorder_qty, shelf_life_days,
      storage_temp, barcode,
      suppliers(name_ar),
      ingredient_allergens(allergen)
    `)
    .eq('is_active', true)
    .order('name_ar')

  for (const r of ingRows ?? []) {
    const supplierData = r.suppliers as { name_ar: string } | null
    const allergensData = r.ingredient_allergens as { allergen: string }[]
    wsIng.addRow({
      name_ar: r.name_ar,
      name_en: r.name_en,
      unit: r.unit,
      purchase_unit: r.purchase_unit ?? '',
      purchase_unit_factor: r.purchase_unit_factor ?? '',
      cost_per_unit: r.cost_per_unit,
      default_yield_factor: r.default_yield_factor,
      category: r.category ?? '',
      reorder_point: r.reorder_point ?? '',
      max_stock_level: r.max_stock_level ?? '',
      reorder_qty: r.reorder_qty ?? '',
      shelf_life_days: r.shelf_life_days ?? '',
      storage_temp: r.storage_temp ?? '',
      barcode: r.barcode ?? '',
      supplier_name: supplierData?.name_ar ?? '',
      allergens: allergensData?.map((a) => a.allergen).join(',') ?? '',
    })
  }

  // ── Sheet 2: prep_items ──────────────────────────────────────────────────
  const wsPrep = wb.addWorksheet('Prep Items')
  wsPrep.columns = [
    { header: 'الاسم بالعربية*\nname_ar*', key: 'name_ar', width: 28 },
    { header: 'الاسم بالإنجليزية*\nname_en*', key: 'name_en', width: 28 },
    { header: 'وحدة القياس*\nunit*', key: 'unit', width: 14 },
    { header: 'كمية الدفعة*\nbatch_yield_qty*', key: 'batch_yield_qty', width: 16 },
    { header: 'صلاحية (ساعات)\nshelf_life_hours', key: 'shelf_life_hours', width: 16 },
    { header: 'درجة التخزين\nstorage_temp', key: 'storage_temp', width: 18 },
  ]
  styleHeader(wsPrep.getRow(1))
  setColumnWidths(wsPrep, [28, 28, 14, 16, 16, 18])

  const { data: prepRows } = await db
    .from('prep_items')
    .select('name_ar, name_en, unit, batch_yield_qty, shelf_life_hours, storage_temp')
    .eq('is_active', true)
    .order('name_ar')

  for (const r of prepRows ?? []) {
    wsPrep.addRow({
      name_ar: r.name_ar, name_en: r.name_en, unit: r.unit,
      batch_yield_qty: r.batch_yield_qty,
      shelf_life_hours: r.shelf_life_hours ?? '',
      storage_temp: r.storage_temp ?? '',
    })
  }

  // ── Sheet 3: prep_ingredients ─────────────────────────────────────────────
  const wsPrepIng = wb.addWorksheet('مكونات Prep')
  wsPrepIng.columns = [
    { header: 'اسم Prep Item (عربي)*\nprep_item_name_ar*', key: 'prep_item_name_ar', width: 28 },
    { header: 'اسم المكون (عربي)*\ningredient_name_ar*', key: 'ingredient_name_ar', width: 28 },
    { header: 'الكمية*\nquantity*', key: 'quantity', width: 12 },
    { header: 'معامل الهالك\nyield_factor_override', key: 'yield_factor_override', width: 22 },
  ]
  styleHeader(wsPrepIng.getRow(1))
  setColumnWidths(wsPrepIng, [28, 28, 12, 22])

  const { data: pIngRows } = await db
    .from('prep_item_ingredients')
    .select('quantity, yield_factor, prep_items(name_ar), ingredients(name_ar)')
    .order('prep_item_id')

  for (const r of pIngRows ?? []) {
    const pItem = r.prep_items as { name_ar: string } | null
    const ing   = r.ingredients as { name_ar: string } | null
    wsPrepIng.addRow({
      prep_item_name_ar: pItem?.name_ar ?? '',
      ingredient_name_ar: ing?.name_ar ?? '',
      quantity: r.quantity,
      yield_factor_override: r.yield_factor ?? '',
    })
  }

  // ── Sheet 4: recipes ──────────────────────────────────────────────────────
  const wsRec = wb.addWorksheet('الوصفات')
  wsRec.columns = [
    { header: 'رمز الوجبة (slug)*\nmenu_item_slug*', key: 'menu_item_slug', width: 28 },
    { header: 'اسم المكون (عربي)\ningredient_name_ar', key: 'ingredient_name_ar', width: 24 },
    { header: 'اسم Prep Item (عربي)\nprep_item_name_ar', key: 'prep_item_name_ar', width: 24 },
    { header: 'الكمية*\nquantity*', key: 'quantity', width: 12 },
    { header: 'رمز الحجم\nvariant_key', key: 'variant_key', width: 14 },
    { header: 'معامل الهالك\nyield_factor_override', key: 'yield_factor_override', width: 18 },
    { header: 'اختياري؟\nis_optional', key: 'is_optional', width: 14 },
  ]
  styleHeader(wsRec.getRow(1))
  setColumnWidths(wsRec, [28, 24, 24, 12, 14, 18, 14])

  const { data: recRows } = await db
    .from('recipes')
    .select('menu_item_slug, quantity, variant_key, yield_factor, is_optional, ingredients(name_ar), prep_items(name_ar)')
    .order('menu_item_slug')

  for (const r of recRows ?? []) {
    const ing   = r.ingredients as { name_ar: string } | null
    const pItem = r.prep_items  as { name_ar: string } | null
    wsRec.addRow({
      menu_item_slug: r.menu_item_slug,
      ingredient_name_ar: ing?.name_ar ?? '',
      prep_item_name_ar: pItem?.name_ar ?? '',
      quantity: r.quantity,
      variant_key: r.variant_key ?? '',
      yield_factor_override: r.yield_factor ?? '',
      is_optional: r.is_optional ? 'yes' : 'no',
    })
  }

  // ── Sheet 5: opening_stock ────────────────────────────────────────────────
  const wsStock = wb.addWorksheet('المخزون الافتتاحي')
  wsStock.columns = [
    { header: 'اسم المكون (عربي)*\ningredient_name_ar*', key: 'ingredient_name_ar', width: 28 },
    { header: 'اسم الفرع*\nbranch_name*', key: 'branch_name', width: 20 },
    { header: 'الكمية الحالية*\non_hand*', key: 'on_hand', width: 16 },
    { header: 'نقطة الطلب (تجاوز)\nreorder_point_override', key: 'reorder_point_override', width: 22 },
  ]
  styleHeader(wsStock.getRow(1))
  setColumnWidths(wsStock, [28, 20, 16, 22])

  const { data: stockRows } = await db
    .from('inventory_stock')
    .select('on_hand, reorder_point, ingredients(name_ar), branches(name_ar)')
    .order('ingredient_id')

  for (const r of stockRows ?? []) {
    const ing    = r.ingredients as { name_ar: string } | null
    const branch = r.branches    as { name_ar: string } | null
    wsStock.addRow({
      ingredient_name_ar: ing?.name_ar ?? '',
      branch_name: branch?.name_ar ?? '',
      on_hand: r.on_hand,
      reorder_point_override: r.reorder_point ?? '',
    })
  }

  // ── Sheet 6: par_levels ───────────────────────────────────────────────────
  const wsPar = wb.addWorksheet('مستويات Par')
  wsPar.columns = [
    { header: 'اسم المكون (عربي)*\ningredient_name_ar*', key: 'ingredient_name_ar', width: 28 },
    { header: 'اسم الفرع*\nbranch_name*', key: 'branch_name', width: 20 },
    { header: 'نوع اليوم*\nday_type*', key: 'day_type', width: 14 },
    { header: 'كمية Par*\npar_qty*', key: 'par_qty', width: 14 },
    { header: 'كمية إعادة الطلب*\nreorder_qty*', key: 'reorder_qty', width: 18 },
  ]
  styleHeader(wsPar.getRow(1))
  setColumnWidths(wsPar, [28, 20, 14, 14, 18])

  const { data: parRows } = await db
    .from('par_levels')
    .select('day_type, par_qty, reorder_qty, ingredients(name_ar), branches(name_ar)')
    .order('ingredient_id')

  for (const r of parRows ?? []) {
    const ing    = r.ingredients as { name_ar: string } | null
    const branch = r.branches    as { name_ar: string } | null
    wsPar.addRow({
      ingredient_name_ar: ing?.name_ar ?? '',
      branch_name: branch?.name_ar ?? '',
      day_type: r.day_type,
      par_qty: r.par_qty,
      reorder_qty: r.reorder_qty,
    })
  }

  const raw = await wb.xlsx.writeBuffer()
  return raw as ArrayBuffer
}
