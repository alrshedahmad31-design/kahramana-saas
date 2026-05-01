'use client'

import { useState, useTransition } from 'react'
import type { ParDayType } from '@/lib/supabase/custom-types'

interface ParLevelRow {
  id: string
  branch_id: string
  ingredient_id: string
  day_type: ParDayType
  par_qty: number
  reorder_qty: number
  ingredient: { id: string; name_ar: string; unit: string } | null
  branch: { id: string; name_ar: string } | null
}

interface EditableRow extends ParLevelRow {
  dirty: boolean
}

interface Props {
  parLevels: ParLevelRow[]
  saveAction: (branchId: string, ingredientId: string, dayType: ParDayType, parQty: number, reorderQty: number) => Promise<{ error?: string }>
  locale: string
}

const DAY_TYPE_LABELS: Record<ParDayType, { ar: string; en: string }> = {
  default:  { ar: 'افتراضي',  en: 'Default' },
  weekend:  { ar: 'عطلة نهاية الأسبوع', en: 'Weekend' },
  ramadan:  { ar: 'رمضان',    en: 'Ramadan' },
  event:    { ar: 'مناسبة',   en: 'Event' },
  holiday:  { ar: 'إجازة',    en: 'Holiday' },
}

export default function ParLevelEditor({ parLevels, saveAction, locale }: Props) {
  const isAr = locale === 'ar'

  const [rows, setRows] = useState<EditableRow[]>(() =>
    parLevels.map((r) => ({ ...r, dirty: false }))
  )

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function updateRow(id: string, field: 'par_qty' | 'reorder_qty', value: number) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value, dirty: true } : r))
  }

  function saveAll() {
    const dirtyRows = rows.filter((r) => r.dirty)
    if (dirtyRows.length === 0) return

    startTransition(async () => {
      const newErrors: Record<string, string> = {}
      for (const row of dirtyRows) {
        const result = await saveAction(row.branch_id, row.ingredient_id, row.day_type, row.par_qty, row.reorder_qty)
        if (result.error) {
          newErrors[row.id] = result.error
        }
      }
      setErrors(newErrors)
      if (Object.keys(newErrors).length === 0) {
        setRows((prev) => prev.map((r) => ({ ...r, dirty: false })))
      }
    })
  }

  // Group by branch
  const byBranch = new Map<string, EditableRow[]>()
  for (const row of rows) {
    const branchId = row.branch_id
    const list = byBranch.get(branchId) ?? []
    list.push(row)
    byBranch.set(branchId, list)
  }

  const dirtyCount = rows.filter((r) => r.dirty).length

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {rows.length === 0 ? (
        <div className="border border-brand-border rounded-xl p-12 text-center">
          <p className="font-satoshi text-brand-muted">
            {isAr ? 'لا توجد مستويات Par محددة' : 'No par levels defined yet'}
          </p>
        </div>
      ) : (
        Array.from(byBranch.entries()).map(([branchId, branchRows]) => {
          const branchName = branchRows[0]?.branch?.name_ar ?? branchId
          return (
            <div key={branchId}>
              <h3 className="font-cairo text-base font-bold text-brand-text mb-3">{branchName}</h3>
              <div className="border border-brand-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-brand-surface-2">
                    <tr>
                      <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'المكوّن' : 'Ingredient'}</th>
                      <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'نوع اليوم' : 'Day Type'}</th>
                      <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'كمية Par' : 'Par Qty'}</th>
                      <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'كمية الإعادة' : 'Reorder Qty'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-t border-brand-border transition-colors ${row.dirty ? 'bg-brand-gold/5' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-satoshi text-sm text-brand-text">{row.ingredient?.name_ar ?? '—'}</p>
                          <p className="font-satoshi text-xs text-brand-muted">{row.ingredient?.unit ?? ''}</p>
                          {errors[row.id] && (
                            <p className="font-satoshi text-xs text-brand-error mt-0.5">{errors[row.id]}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium bg-brand-gold/10 text-brand-gold">
                            {isAr ? DAY_TYPE_LABELS[row.day_type].ar : DAY_TYPE_LABELS[row.day_type].en}
                          </span>
                        </td>
                        <td className="px-4 py-3 w-32">
                          <input
                            type="number"
                            value={row.par_qty}
                            onChange={(e) => updateRow(row.id, 'par_qty', Number(e.target.value))}
                            step="0.001"
                            min="0"
                            className="w-full rounded-lg border border-brand-border bg-brand-surface px-2 py-1.5 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
                          />
                        </td>
                        <td className="px-4 py-3 w-32">
                          <input
                            type="number"
                            value={row.reorder_qty}
                            onChange={(e) => updateRow(row.id, 'reorder_qty', Number(e.target.value))}
                            step="0.001"
                            min="0"
                            className="w-full rounded-lg border border-brand-border bg-brand-surface px-2 py-1.5 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}

      {dirtyCount > 0 && (
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-brand-border sticky bottom-0 bg-brand-surface py-3">
          <span className="font-satoshi text-sm text-brand-muted">
            {dirtyCount} {isAr ? 'تغيير معلق' : 'unsaved changes'}
          </span>
          <button
            type="button"
            onClick={saveAll}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 disabled:opacity-50 transition-colors"
          >
            {isPending
              ? (isAr ? 'جاري الحفظ...' : 'Saving...')
              : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
          </button>
        </div>
      )}
    </div>
  )
}
