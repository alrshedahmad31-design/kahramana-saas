'use client'

import { useTranslations } from 'next-intl'
import LightweightPieChart from '@/components/charts/LightweightPieChart'
import { colors } from '@/lib/design-tokens'

const PIE_COLORS = [colors.gold, colors.error, colors.success, colors.muted, colors.border, colors.surface2]

export default function ValuationPieChart({ data, locale }: { data: { name: string; value: number }[]; locale: string }) {
  const t = useTranslations('inventory.reports.valuation')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-cairo' : 'font-satoshi'

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h3 className={`${font} text-sm font-black text-brand-text`}>{t('valueByCategory')}</h3>
      <div className="h-[300px] w-full">
        <LightweightPieChart
          data={data.map((entry, index) => ({ ...entry, color: PIE_COLORS[index % PIE_COLORS.length]! }))}
          locale={locale}
          showPercentLabels
        />
      </div>
    </div>
  )
}
