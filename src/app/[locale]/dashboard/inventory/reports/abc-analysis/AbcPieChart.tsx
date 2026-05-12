'use client'

import { useLocale, useTranslations } from 'next-intl'
import LightweightPieChart from '@/components/charts/LightweightPieChart'
import { colors } from '@/lib/design-tokens'

const ABC_COLORS: Record<string, string> = {
  A: colors.error,
  B: colors.gold,
  C: colors.success,
}

export default function AbcPieChart({ data }: { data: { name: string; value: number }[] }) {
  const locale = useLocale()
  const t = useTranslations('inventory.reports.abcAnalysis')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const currency = tCommon('currency')

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-sm hover:shadow-md transition-all">
      <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text mb-6 uppercase tracking-wider`}>{t('chartTitle')}</h3>
      <div className="h-[300px] w-full">
        <LightweightPieChart
          data={data.map((entry) => ({ ...entry, color: ABC_COLORS[entry.name] ?? colors.muted }))}
          locale={locale}
          currency={currency}
        />
      </div>
    </div>
  )
}

