import type { IngredientUnit, PrepUnit } from '@/lib/supabase/custom-types'

type AnyUnit = IngredientUnit | PrepUnit | string

const UNIT_AR: Record<string, string> = {
  g:       'غرام',
  kg:      'كغم',
  ml:      'مل',
  l:       'لتر',
  unit:    'وحدة',
  tbsp:    'ملعقة كبيرة',
  tsp:     'ملعقة صغيرة',
  oz:      'أوقية',
  lb:      'رطل',
  piece:   'قطعة',
  portion: 'حصة',
  bottle:  'زجاجة',
  can:     'علبة',
  bag:     'كيس',
  box:     'صندوق',
  batch:   'دفعة',
}

const UNIT_EN: Record<string, string> = {
  g:       'g',
  kg:      'kg',
  ml:      'ml',
  l:       'L',
  unit:    'unit',
  tbsp:    'tbsp',
  tsp:     'tsp',
  oz:      'oz',
  lb:      'lb',
  piece:   'piece',
  portion: 'portion',
  bottle:  'bottle',
  can:     'can',
  bag:     'bag',
  box:     'box',
  batch:   'batch',
}

export function translateUnit(unit: AnyUnit | null | undefined, isAr: boolean): string {
  if (!unit) return ''
  return isAr ? (UNIT_AR[unit] ?? unit) : (UNIT_EN[unit] ?? unit)
}
