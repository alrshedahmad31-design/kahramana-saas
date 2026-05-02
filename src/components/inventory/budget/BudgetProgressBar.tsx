interface Props {
  label:       string
  used:        number
  budget:      number
  unit?:       string
  colorClass?: string
  isAr?:       boolean
}

export default function BudgetProgressBar({
  label, used, budget, unit = 'BD', colorClass = 'bg-brand-gold', isAr = true,
}: Props) {
  const pct        = budget > 0 ? Math.min((used / budget) * 100, 100) : 0
  const overBudget = budget > 0 && used > budget

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-satoshi text-sm text-brand-text">{label}</span>
        <span className={`font-satoshi text-sm tabular-nums ${overBudget ? 'text-red-400' : 'text-brand-text'}`}>
          {used.toFixed(3)} / {budget.toFixed(3)} {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-brand-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${overBudget ? 'bg-red-500' : colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="font-satoshi text-xs text-brand-muted text-end">
        {pct.toFixed(1)}% {isAr ? 'مستخدم' : 'used'}
        {overBudget && (
          <span className="text-red-400 ms-2">
            {isAr ? '⚠ تجاوز الميزانية' : '⚠ Over budget'}
          </span>
        )}
      </p>
    </div>
  )
}
