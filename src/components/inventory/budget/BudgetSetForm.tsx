'use client'

import { useState, useTransition } from 'react'
import { upsertBudget } from '@/app/[locale]/dashboard/inventory/budget/actions'

interface Props {
  branchId: string
  year:     number
  month:    number
  existing?: {
    purchase_budget_bhd:  number
    food_cost_target_pct: number
    waste_budget_bhd:     number
  }
  isAr?:    boolean
  onSaved?: () => void
}

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function BudgetSetForm({ branchId, year, month, existing, isAr = true, onSaved }: Props) {
  const [purchase, setPurchase]     = useState(existing?.purchase_budget_bhd?.toString()  ?? '0')
  const [foodCost, setFoodCost]     = useState(existing?.food_cost_target_pct?.toString() ?? '30')
  const [waste,    setWaste]        = useState(existing?.waste_budget_bhd?.toString()     ?? '0')
  const [error,    setError]        = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const monthName = isAr ? MONTHS_AR[month - 1] : MONTHS_EN[month - 1]

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

  const inputClass = 'w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none'
  const labelClass = 'font-satoshi text-xs text-brand-muted uppercase tracking-wide'

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-4">
      <h3 className="font-cairo font-bold text-sm text-brand-text">
        {isAr ? `ميزانية ${monthName} ${year}` : `Budget — ${monthName} ${year}`}
      </h3>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>{isAr ? 'ميزانية المشتريات (BD)' : 'Purchase Budget (BD)'}</label>
          <input type="number" min="0" step="0.001" value={purchase} onChange={(e) => setPurchase(e.target.value)} className={inputClass} dir="ltr" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>{isAr ? 'هدف تكلفة الطعام (%)' : 'Food Cost Target (%)'}</label>
          <input type="number" min="0" max="100" step="0.1" value={foodCost} onChange={(e) => setFoodCost(e.target.value)} className={inputClass} dir="ltr" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>{isAr ? 'ميزانية الهدر (BD)' : 'Waste Budget (BD)'}</label>
          <input type="number" min="0" step="0.001" value={waste} onChange={(e) => setWaste(e.target.value)} className={inputClass} dir="ltr" />
        </div>
      </div>

      {error && (
        <p className="font-satoshi text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-lg bg-brand-gold px-4 py-2.5 font-satoshi text-sm font-bold text-brand-black hover:bg-brand-goldLight disabled:opacity-50 transition-colors"
      >
        {isPending
          ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
          : (isAr ? 'حفظ الميزانية' : 'Save Budget')}
      </button>
    </div>
  )
}
