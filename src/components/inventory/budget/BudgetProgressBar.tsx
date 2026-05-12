'use client'

import { useTranslations } from 'next-intl'

interface Props {
  label:       string
  used:        number
  budget:      number
  unit?:       string
  colorClass?: string
  locale:      string
}

export default function BudgetProgressBar({
  label, used, budget, unit, colorClass = 'bg-brand-gold', locale,
}: Props) {
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const activeUnit = unit || tCommon('currency')
  const pct        = budget > 0 ? Math.min((used / budget) * 100, 100) : 0
  const overBudget = budget > 0 && used > budget

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`${font} text-sm text-brand-text font-medium`}>{label}</span>
        <span className={`font-satoshi text-sm tabular-nums font-bold ${overBudget ? 'text-brand-error' : 'text-brand-text'}`}>
          {used.toFixed(3)} / {budget.toFixed(3)} <span className="text-[10px] font-medium opacity-70">{activeUnit}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-brand-surface-2 overflow-hidden shadow-inner">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${overBudget ? 'bg-brand-error' : colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className={`${font} text-[10px] text-brand-muted font-medium`}>
          {pct.toFixed(1)}% {isAr ? 'مستخدم' : 'used'}
        </p>
        {overBudget && (
          <p className={`${font} text-[10px] text-brand-error font-bold animate-pulse`}>
             {isAr ? '⚠ تجاوز الميزانية' : '⚠ Over budget'}
          </p>
        )}
      </div>
    </div>
  )
}

