'use client'

import { useTranslations } from 'next-intl'
import LightweightLineChart from '@/components/charts/LightweightLineChart'
import { colors } from '@/lib/design-tokens'

export default function FoodCostTrendChart({
  data,
  targetPct,
  locale
}: {
  data: { date: string; pct: number }[]
  targetPct: number
  locale: string
}) {
  const t = useTranslations('inventory.reports.foodCost')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-cairo' : 'font-satoshi'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className={`${font} text-sm font-black text-brand-text`}>{t('dailyTrend')}</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
            <span className={`${isAr ? 'font-almarai' : 'font-satoshi'} text-[10px] text-brand-muted font-bold uppercase tracking-widest`}>{t('foodCostPct')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            <span className={`${isAr ? 'font-almarai' : 'font-satoshi'} text-[10px] text-brand-muted font-bold uppercase tracking-widest`}>{t('target')}</span>
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <LightweightLineChart
          series={[{
            key: 'pct',
            label: t('foodCostPct'),
            color: colors.gold,
            values: data.map((point) => ({ label: point.date, value: point.pct })),
          }]}
          locale={locale}
          height={300}
          valueSuffix="%"
          dateLabels
          target={{ value: targetPct, label: t('targetLabel', { pct: targetPct }), color: colors.success }}
        />
      </div>
    </div>
  )
}
