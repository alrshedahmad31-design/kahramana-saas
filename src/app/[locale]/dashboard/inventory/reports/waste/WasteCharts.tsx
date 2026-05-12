'use client'

import { useTranslations } from 'next-intl'
import LightweightLineChart from '@/components/charts/LightweightLineChart'
import LightweightPieChart from '@/components/charts/LightweightPieChart'
import { colors } from '@/lib/design-tokens'

const PIE_COLORS = [colors.gold, colors.error, colors.success, colors.muted, colors.border]

export function WasteByReasonChart({ data, locale }: { data: { name: string; value: number }[]; locale: string }) {
  const t = useTranslations('inventory.reports.wasteReport')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-cairo' : 'font-satoshi'

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h3 className={`${font} text-sm font-black text-brand-text`}>{t('byReason')}</h3>
      <div className="h-[280px] w-full">
        <LightweightPieChart
          data={data.map((entry, index) => ({ ...entry, color: PIE_COLORS[index % PIE_COLORS.length]! }))}
          locale={locale}
          showPercentLabels
        />
      </div>
    </div>
  )
}

export function WasteTrendChart({ data, locale }: { data: { date: string; cost: number }[]; locale: string }) {
  const t = useTranslations('inventory.reports.wasteReport')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-cairo' : 'font-satoshi'

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
      <h3 className={`${font} text-sm font-black text-brand-text`}>{t('dailyTrend')}</h3>
      <div className="h-[280px] w-full">
        <LightweightLineChart
          series={[{
            key: 'cost',
            label: t('dailyTrend'),
            color: colors.gold,
            values: data.map((point) => ({ label: point.date, value: point.cost })),
          }]}
          locale={locale}
          height={280}
          currency="BD"
          dateLabels
        />
      </div>
    </div>
  )
}
