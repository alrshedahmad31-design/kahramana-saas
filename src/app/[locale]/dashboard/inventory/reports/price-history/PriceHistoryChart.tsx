'use client'

import { useTranslations, useLocale } from 'next-intl'
import LightweightLineChart, { type LineSeries } from '@/components/charts/LightweightLineChart'
import { colors } from '@/lib/design-tokens'

const LINE_COLORS = [colors.gold, colors.success, colors.error, colors.muted, colors.border]

interface HistoryRow {
  id: string
  unit_cost: number
  effective_at: string
  supplier: { name_ar: string; name_en: string } | null
}

export default function PriceHistoryChart({ history }: { history: HistoryRow[] }) {
  const locale = useLocale()
  const t = useTranslations('inventory.reports.priceHistory')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const currency = tCommon('currency')

  // Group by supplier
  const supplierMap = new Map<string, Map<string, number>>()
  for (const row of history) {
    const supplier = (isAr ? row.supplier?.name_ar : row.supplier?.name_en) ?? t('unspecified')
    if (!supplierMap.has(supplier)) supplierMap.set(supplier, new Map())
    supplierMap.get(supplier)!.set(row.effective_at.slice(0, 10), row.unit_cost)
  }

  const suppliers = Array.from(supplierMap.keys())
  const dates = Array.from(new Set(history.map((r) => r.effective_at.slice(0, 10)))).sort()

  const series: LineSeries[] = suppliers.map((supplier, index) => ({
    key: supplier,
    label: supplier,
    color: LINE_COLORS[index % LINE_COLORS.length]!,
    values: dates.map((date) => ({
      label: date,
      value: supplierMap.get(supplier)?.get(date) ?? 0,
    })),
  }))

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-sm hover:shadow-md transition-all">
      <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text mb-6 uppercase tracking-wider`}>{t('title')}</h3>
      <div className="h-[300px] w-full">
        <LightweightLineChart
          series={series}
          locale={locale}
          height={300}
          currency={currency}
          dateLabels
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {series.map((item) => (
          <span key={item.key} className={`${isAr ? 'font-almarai' : 'font-satoshi'} inline-flex items-center gap-2 text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
