import ExcelJS from 'exceljs'

export interface RecipeRowError {
  row: number
  column: string
  message_ar: string
  message_en: string
}

export interface ParsedRecipeRow {
  row_num: number
  menu_item_slug: string
  ingredient_id: string
  quantity_used: number
  unit: string | null
}

export interface RecipeParseResult {
  rows: ParsedRecipeRow[]
  errors: RecipeRowError[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

export async function parseRecipeImportExcel(
  buffer: ArrayBuffer,
): Promise<RecipeParseResult> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const ws = wb.worksheets[0]
  if (!ws) {
    return {
      rows: [],
      errors: [{
        row: 0,
        column: '-',
        message_ar: 'الملف لا يحتوي على أوراق عمل',
        message_en: 'Workbook contains no worksheets',
      }],
    }
  }

  const rows: ParsedRecipeRow[] = []
  const errors: RecipeRowError[] = []

  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return

    const slug = cellStr(row.getCell(1).value)
    const ingredient_id = cellStr(row.getCell(2).value)
    const quantity = cellNum(row.getCell(3).value)
    const unit = cellStr(row.getCell(4).value) || null

    const allEmpty = !slug && !ingredient_id && quantity === null && !unit
    if (allEmpty) return

    if (!slug) {
      errors.push({
        row: rowNum,
        column: 'menu_item_slug',
        message_ar: 'رمز الوجبة (slug) مطلوب',
        message_en: 'menu_item_slug is required',
      })
    }

    if (!ingredient_id) {
      errors.push({
        row: rowNum,
        column: 'ingredient_id',
        message_ar: 'معرّف المكوّن (UUID) مطلوب',
        message_en: 'ingredient_id (UUID) is required',
      })
    } else if (!UUID_RE.test(ingredient_id)) {
      errors.push({
        row: rowNum,
        column: 'ingredient_id',
        message_ar: `معرّف المكوّن غير صالح: "${ingredient_id}"`,
        message_en: `Invalid ingredient_id: "${ingredient_id}"`,
      })
    }

    if (quantity === null) {
      errors.push({
        row: rowNum,
        column: 'quantity_used',
        message_ar: 'الكمية مطلوبة',
        message_en: 'quantity_used is required',
      })
    } else if (quantity <= 0) {
      errors.push({
        row: rowNum,
        column: 'quantity_used',
        message_ar: 'الكمية يجب أن تكون أكبر من الصفر',
        message_en: 'quantity_used must be greater than zero',
      })
    }

    if (!slug || !ingredient_id || !UUID_RE.test(ingredient_id) || quantity === null || quantity <= 0) {
      return
    }

    rows.push({
      row_num: rowNum,
      menu_item_slug: slug,
      ingredient_id: ingredient_id.toLowerCase(),
      quantity_used: quantity,
      unit,
    })
  })

  return { rows, errors }
}
