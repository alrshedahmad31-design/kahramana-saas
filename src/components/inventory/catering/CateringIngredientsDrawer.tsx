'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { calcCateringIngredients } from '@/app/[locale]/dashboard/inventory/catering/actions'
import type { CateringIngredientSnapshot } from '@/lib/supabase/custom-types'

interface Props {
  orderId:  string
  snapshot: CateringIngredientSnapshot[] | null
  locale:   string
}

export default function CateringIngredientsDrawer({ orderId, snapshot: initial, locale }: Props) {
  const t = useTranslations('inventory.reports.catering')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

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
    <div className="mt-2 border-t border-brand-border/50 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${font} text-[11px] font-black text-brand-gold hover:text-brand-goldLight transition-all flex items-center gap-1.5 uppercase tracking-wider`}
      >
        <span className={`w-1.5 h-1.5 rounded-full bg-brand-gold shadow-[0_0_8px_rgba(200,146,42,0.4)] ${open ? 'scale-125' : 'scale-100 opacity-50'}`} />
        {open ? t('hideIngredients') : t('showIngredients')}
      </button>

      {open && (
        <div className="mt-4 bg-brand-surface-2 border border-brand-border rounded-xl p-5 flex flex-col gap-4 shadow-inner animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between gap-3 border-b border-brand-border/50 pb-3">
            <p className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold`}>
              {t('requiredIngredients')}
            </p>
            <button
              type="button"
              onClick={handleCalc}
              disabled={isPending}
              className={`${font} text-[10px] font-black text-brand-gold hover:text-brand-goldLight disabled:opacity-50 transition-all bg-brand-surface border border-brand-border px-3 py-1 rounded-full shadow-sm hover:border-brand-gold active:scale-95`}
            >
              {isPending ? t('calculating') : t('recalculate')}
            </button>
          </div>

          {error && (
            <p className={`${font} text-xs text-brand-error bg-brand-error/5 border border-brand-error/20 rounded-lg px-3 py-2 animate-pulse`}>
              {error}
            </p>
          )}

          {!snapshot || snapshot.length === 0 ? (
            <div className="py-8 text-center bg-brand-surface/30 rounded-lg border border-dashed border-brand-border/50">
              <p className={`${font} text-xs text-brand-muted italic px-6`}>
                {t('calcPrompt')}
              </p>
            </div>
          ) : (
            <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden shadow-sm">
              <table className="w-full text-start">
                <thead className="bg-brand-surface-2 border-b border-brand-border">
                  <tr>
                    <th className={`px-3 py-2 text-start ${font} text-[9px] font-bold text-brand-muted uppercase tracking-widest`}>
                      {t('ingredient')}
                    </th>
                    <th className={`px-3 py-2 text-end ${font} text-[9px] font-bold text-brand-muted uppercase tracking-widest`}>
                      {t('quantity')}
                    </th>
                    <th className={`px-3 py-2 text-end ${font} text-[9px] font-bold text-brand-muted uppercase tracking-widest`}>
                      {t('unit')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/30">
                  {snapshot.map((ing) => (
                    <tr key={ing.ingredient_id} className="hover:bg-brand-surface-2 transition-colors group">
                      <td className="px-3 py-2.5">
                        <p className={`${font} text-xs font-bold text-brand-text group-hover:text-brand-gold transition-colors`}>
                          {isAr ? ing.name_ar : (ing.name_en || ing.name_ar)}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <span className="font-satoshi text-xs font-black text-brand-gold tabular-nums">
                          {ing.qty_needed.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <span className={`${font} text-[10px] text-brand-muted font-bold`}>
                          {ing.unit}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

