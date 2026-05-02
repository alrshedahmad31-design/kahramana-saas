'use client'

import { useState, useTransition } from 'react'
import { calcCateringIngredients } from '@/app/[locale]/dashboard/inventory/catering/actions'
import type { CateringIngredientSnapshot } from '@/lib/supabase/custom-types'

interface Props {
  orderId:  string
  snapshot: CateringIngredientSnapshot[] | null
  isAr?:    boolean
}

export default function CateringIngredientsDrawer({ orderId, snapshot: initial, isAr = true }: Props) {
  const [open, setOpen]         = useState(false)
  const [snapshot, setSnapshot] = useState<CateringIngredientSnapshot[] | null>(initial)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCalc() {
    setError(null)
    startTransition(async () => {
      const result = await calcCateringIngredients(orderId)
      if (result.error) {
        setError(result.error)
      } else {
        setSnapshot(result.snapshot as CateringIngredientSnapshot[])
      }
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-satoshi text-xs text-brand-gold hover:text-brand-goldLight transition-colors"
      >
        {isAr ? (open ? 'إخفاء المكونات' : 'عرض المكونات') : (open ? 'Hide ingredients' : 'Show ingredients')}
      </button>

      {open && (
        <div className="mt-3 bg-brand-surface-2 border border-brand-border rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
              {isAr ? 'قائمة المكونات المطلوبة' : 'Required Ingredients'}
            </p>
            <button
              type="button"
              onClick={handleCalc}
              disabled={isPending}
              className="font-satoshi text-xs text-brand-gold hover:text-brand-goldLight disabled:opacity-50 transition-colors"
            >
              {isPending
                ? (isAr ? 'جارٍ الحساب...' : 'Calculating...')
                : (isAr ? 'إعادة الحساب' : 'Recalculate')}
            </button>
          </div>

          {error && (
            <p className="font-satoshi text-xs text-red-400">{error}</p>
          )}

          {!snapshot || snapshot.length === 0 ? (
            <p className="font-satoshi text-sm text-brand-muted text-center py-3">
              {isAr ? 'اضغط "إعادة الحساب" لحساب المكونات من الباقة' : 'Click "Recalculate" to compute ingredients from the package'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="pb-2 text-start font-satoshi text-xs text-brand-muted">{isAr ? 'المكوّن' : 'Ingredient'}</th>
                  <th className="pb-2 text-end font-satoshi text-xs text-brand-muted">{isAr ? 'الكمية' : 'Quantity'}</th>
                  <th className="pb-2 text-end font-satoshi text-xs text-brand-muted">{isAr ? 'الوحدة' : 'Unit'}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.map((ing) => (
                  <tr key={ing.ingredient_id} className="border-b border-brand-border/50 last:border-0">
                    <td className="py-1.5 font-satoshi text-sm text-brand-text">
                      {isAr ? ing.name_ar : ing.name_en}
                    </td>
                    <td className="py-1.5 font-satoshi text-sm text-brand-text text-end tabular-nums">
                      {ing.qty_needed.toFixed(3)}
                    </td>
                    <td className="py-1.5 font-satoshi text-xs text-brand-muted text-end">
                      {ing.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
