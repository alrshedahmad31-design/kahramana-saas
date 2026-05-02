interface Props {
  spendVariance: number
  wasteVariance: number
  isAr?: boolean
}

export default function BudgetAlertBanner({ spendVariance, wasteVariance, isAr = true }: Props) {
  const overSpend = spendVariance > 0
  const overWaste = wasteVariance > 0

  if (!overSpend && !overWaste) return null

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
        <p className="font-satoshi font-bold text-sm text-red-400">
          {isAr ? 'تجاوز الميزانية' : 'Budget Exceeded'}
        </p>
      </div>
      {overSpend && (
        <p className="font-satoshi text-xs text-red-400 ms-4">
          {isAr
            ? `تجاوز المشتريات: +${spendVariance.toFixed(3)} BD`
            : `Overspend: +${spendVariance.toFixed(3)} BD`}
        </p>
      )}
      {overWaste && (
        <p className="font-satoshi text-xs text-red-400 ms-4">
          {isAr
            ? `تجاوز ميزانية الهدر: +${wasteVariance.toFixed(3)} BD`
            : `Over waste budget: +${wasteVariance.toFixed(3)} BD`}
        </p>
      )}
    </div>
  )
}
