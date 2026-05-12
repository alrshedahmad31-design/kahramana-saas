'use client'

import { useTranslations } from 'next-intl'
import LightweightAreaChart from '@/components/charts/LightweightAreaChart'
import type { InventoryValuationRow } from '@/lib/supabase/custom-types'

interface DailyPoint {
  date:  string
  value: number
}

interface Props {
  valuations:  InventoryValuationRow[]
  trendPoints: DailyPoint[]
  currency:    string
  locale:      string
}

export default function StockValueWidget({ valuations, trendPoints, currency, locale }: Props) {
  const t = useTranslations('inventory.valuation')
  const totalValue = valuations.reduce((s, r) => s + r.total_value_bhd, 0)
  const isAr = locale === 'ar'
  const chartPoints = trendPoints.map((point) => ({ label: point.date, value: point.value }))

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand-surface-2 border border-brand-border flex items-center justify-center text-brand-gold shrink-0">
          <ChartIcon />
        </div>
        <h3 className="font-cairo font-bold text-sm text-brand-text">
          {t('title')}
        </h3>
      </div>

      {/* Total */}
      <div>
        <p className="font-cairo text-xs text-brand-muted uppercase tracking-wider mb-1">
          {isAr ? 'الإجمالي' : 'Total'}
        </p>
        <p className="font-satoshi font-black text-3xl text-brand-gold tabular-nums leading-none">
          {totalValue.toFixed(3)}
          <span className="text-sm font-medium text-brand-muted ms-1.5">{currency}</span>
        </p>
      </div>

      {/* Branch breakdown */}
      {valuations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {valuations.map(b => (
            <div key={b.branch_id} className="flex items-center justify-between gap-2">
              <span className="font-cairo text-xs text-brand-muted truncate">
                {isAr ? b.branch_name_ar : (b.branch_name_en || b.branch_name_ar)}
              </span>
              <span className="font-satoshi text-xs font-medium text-brand-text tabular-nums shrink-0">
                {b.total_value_bhd.toFixed(3)} {currency}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Mini trend chart */}
      {trendPoints.length > 1 && (
        <div className="mt-auto">
          <p className="font-cairo text-xs text-brand-muted mb-2">
            {isAr ? 'آخر 14 يوم' : 'Last 14 days'}
          </p>
          <LightweightAreaChart
            points={chartPoints}
            currency={currency}
            height={80}
            gradientId="stockValGrad"
          />
        </div>
      )}
    </div>
  )
}


function ChartIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
