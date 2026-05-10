'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'

interface Props {
  spendVariance: number
  wasteVariance: number
  locale: string
}

export default function BudgetAlertBanner({ spendVariance, wasteVariance, locale }: Props) {
  const t = useTranslations('inventory.reports.budget')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  const overSpend = spendVariance > 0
  const overWaste = wasteVariance > 0

  if (!overSpend && !overWaste) return null

  return (
    <div className="flex flex-col gap-2">
      {overSpend && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-error/20 bg-brand-error/5 p-4 text-brand-error shadow-sm animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className={`${font} text-sm font-medium`}>
            {t('overPurchase', { val: `${Number(spendVariance).toFixed(3)} ${tCommon('currency')}` })}
          </p>
        </div>
      )}
      {overWaste && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-error/20 bg-brand-error/5 p-4 text-brand-error shadow-sm animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className={`${font} text-sm font-medium`}>
            {t('overWaste', { val: `${Number(wasteVariance).toFixed(3)} ${tCommon('currency')}` })}
          </p>
        </div>
      )}
    </div>
  )
}


