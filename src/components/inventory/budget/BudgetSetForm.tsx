'use client'

import { useState, useTransition } from 'react'
import { upsertBudget } from '@/app/[locale]/dashboard/inventory/budget/actions'
import { useTranslations } from 'next-intl'

interface Props {
  branchId: string
  year:     number
  month:    number
  existing?: {
    purchase_budget_bhd:  number
    food_cost_target_pct: number
    waste_budget_bhd:     number
  }
  locale:   string
  onSaved?: () => void
}

export default function BudgetSetForm({ branchId, year, month, existing, locale, onSaved }: Props) {
  const t = useTranslations('inventory.reports.budget')
  const tCommon = useTranslations('common')
  const [purchase, setPurchase]     = useState(existing?.purchase_budget_bhd?.toString()  ?? '0')
  const [foodCost, setFoodCost]     = useState(existing?.food_cost_target_pct?.toString() ?? '30')
  const [waste,    setWaste]        = useState(existing?.waste_budget_bhd?.toString()     ?? '0')
  const [error,    setError]        = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const monthName = t(`months.${month}`)

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await upsertBudget({
        branch_id:            branchId,
        year,
        month,
        purchase_budget_bhd:  parseFloat(purchase)  || 0,
        food_cost_target_pct: parseFloat(foodCost)  || 30,
        waste_budget_bhd:     parseFloat(waste)     || 0,
      })
      if (result.error) {
        setError(result.error)
      } else {
        onSaved?.()
      }
    })
  }

  const inputClass = `w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-all shadow-sm`
  const labelClass = `${font} text-[10px] text-brand-muted uppercase tracking-wider font-bold mb-1`

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-5 shadow-sm">
      <div className="border-b border-brand-border pb-3">
        <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} font-black text-sm text-brand-text`}>
          {t('setBudget')}
        </h3>
        <p className={`${font} text-[11px] text-brand-muted mt-0.5`}>{monthName} {year}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <label className={labelClass}>{t('purchaseBudget')} ({tCommon('currency')})</label>
          <input type="number" min="0" step="0.001" value={purchase} onChange={(e) => setPurchase(e.target.value)} className={inputClass} dir="ltr" />
        </div>
        <div className="flex flex-col">
          <label className={labelClass}>{t('foodCostTarget')}</label>
          <input type="number" min="0" max="100" step="0.1" value={foodCost} onChange={(e) => setFoodCost(e.target.value)} className={inputClass} dir="ltr" />
        </div>
        <div className="flex flex-col">
          <label className={labelClass}>{t('wasteBudget')} ({tCommon('currency')})</label>
          <input type="number" min="0" step="0.001" value={waste} onChange={(e) => setWaste(e.target.value)} className={inputClass} dir="ltr" />
        </div>
      </div>

      {error && (
        <p className={`${font} text-xs text-brand-error bg-brand-error/5 border border-brand-error/20 rounded-lg px-3 py-2`}>{error}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className={`rounded-lg bg-brand-gold px-4 py-3 ${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-black hover:bg-brand-goldLight disabled:opacity-50 transition-all shadow-md active:scale-95`}
      >
        {isPending ? t('saving') : t('save')}
      </button>
    </div>
  )
}


