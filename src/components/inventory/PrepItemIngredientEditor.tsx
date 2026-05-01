'use client'

import { useState, useTransition } from 'react'

interface Ingredient {
  id: string
  name_ar: string
  unit: string
  cost_per_unit: number
}

interface IngRow {
  key: string
  ingredient_id: string
  quantity: number
  yield_factor: number
}

interface ExistingRow {
  id: string
  ingredient_id: string
  quantity: number
  yield_factor: number | null
  ingredient: Ingredient | null
}

interface PrepIngredientInput {
  ingredient_id: string
  quantity: number
  yield_factor: number | null
}

interface Props {
  prepItemId: string
  existingRows: ExistingRow[]
  allIngredients: Ingredient[]
  saveAction: (prepItemId: string, rows: PrepIngredientInput[]) => Promise<{ error?: string }>
  locale: string
}

let keyCounter = 0
function nextKey() { return `pi${++keyCounter}` }

const inputSm = 'rounded-lg border border-brand-border bg-brand-surface px-2 py-1.5 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors w-full'
const selectSm = 'rounded-lg border border-brand-border bg-brand-surface px-2 py-1.5 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors w-full'

export default function PrepItemIngredientEditor({ prepItemId, existingRows, allIngredients, saveAction, locale }: Props) {
  const isAr = locale === 'ar'

  const [rows, setRows] = useState<IngRow[]>(() =>
    existingRows.map((r) => ({
      key: nextKey(),
      ingredient_id: r.ingredient_id,
      quantity: r.quantity,
      yield_factor: r.yield_factor ?? 1,
    }))
  )

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function addRow() {
    const first = allIngredients[0]
    if (!first) return
    setRows((r) => [...r, { key: nextKey(), ingredient_id: first.id, quantity: 1, yield_factor: 1 }])
  }

  function removeRow(key: string) {
    setRows((r) => r.filter((x) => x.key !== key))
  }

  function updateRow(key: string, patch: Partial<IngRow>) {
    setRows((r) => r.map((x) => x.key === key ? { ...x, ...patch } : x))
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveAction(prepItemId, rows.map((r) => ({
        ingredient_id: r.ingredient_id,
        quantity: r.quantity,
        yield_factor: r.yield_factor,
      })))
      if (result.error) {
        setError(result.error)
      } else {
        setError(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-cairo text-base font-bold text-brand-text">
          {isAr ? 'مكونات هذا الـ Prep' : 'Prep Ingredients'}
        </h3>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-3 py-1.5 font-satoshi text-sm text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
        >
          + {isAr ? 'إضافة مكوّن' : 'Add Ingredient'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
          <p className="font-satoshi text-sm text-brand-error">{error}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="font-satoshi text-sm text-brand-muted italic">
          {isAr ? 'لا مكونات محددة' : 'No ingredients added yet'}
        </p>
      ) : (
        <div className="border border-brand-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-brand-surface-2">
              <tr>
                <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'المكوّن' : 'Ingredient'}</th>
                <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الكمية' : 'Qty'}</th>
                <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الهدر' : 'Yield'}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-brand-border">
                  <td className="px-3 py-2 min-w-[160px]">
                    <select
                      value={row.ingredient_id}
                      onChange={(e) => updateRow(row.key, { ingredient_id: e.target.value })}
                      className={selectSm}
                    >
                      {allIngredients.map((i) => (
                        <option key={i.id} value={i.id}>{i.name_ar} ({i.unit})</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 w-28">
                    <input
                      type="number"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.key, { quantity: Number(e.target.value) })}
                      step="0.001"
                      min="0"
                      className={inputSm}
                    />
                  </td>
                  <td className="px-3 py-2 w-28">
                    <input
                      type="number"
                      value={row.yield_factor}
                      onChange={(e) => updateRow(row.key, { yield_factor: Number(e.target.value) })}
                      step="0.001"
                      min="0.001"
                      max="1"
                      className={inputSm}
                    />
                  </td>
                  <td className="px-3 py-2 w-10">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="text-brand-muted hover:text-brand-error transition-colors"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 disabled:opacity-50 transition-colors"
        >
          {isPending
            ? (isAr ? 'جاري الحفظ...' : 'Saving...')
            : (isAr ? 'حفظ المكونات' : 'Save Ingredients')}
        </button>
      </div>
    </div>
  )
}
