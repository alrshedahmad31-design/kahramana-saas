'use client'

import { useTranslations, useLocale } from 'next-intl'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { colors } from '@/lib/design-tokens'

const LINE_COLORS = [colors.brand.gold, colors.brand.success, colors.brand.error, colors.brand.muted, colors.brand.border]

interface HistoryRow {
  id: string
  unit_cost: number
  effective_at: string
  supplier: { name_ar: string; name_en: string } | null
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
  currency: string
  locale: string
}

function CustomTooltip({ active, payload, label, currency, locale }: TooltipProps) {
  if (!active || !payload?.length) return null
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90" style={{ borderColor: colors.border }}>
      <p className={`${font} text-[10px] text-brand-muted mb-2 uppercase tracking-widest font-bold`}>{label}</p>
      <div className="space-y-1.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className={`${font} text-xs font-bold text-brand-muted truncate max-w-[120px]`}>{p.name}</span>
            <span className="font-satoshi text-sm font-black tabular-nums" style={{ color: p.color }}>
              {Number(p.value).toFixed(3)}
              <span className="text-[10px] ms-1 opacity-70 font-medium">{currency}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
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

  const chartData = dates.map((date) => {
    const row: Record<string, number | string> = { date }
    suppliers.forEach((s) => {
      row[s] = supplierMap.get(s)?.get(date) ?? 0
    })
    return row
  })

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-sm hover:shadow-md transition-all">
      <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text mb-6 uppercase tracking-wider`}>{t('title')}</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} opacity={0.3} />
            <XAxis 
              dataKey="date" 
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 600 }} 
              axisLine={{ stroke: colors.border, opacity: 0.5 }}
              tickLine={false}
              tickFormatter={(val) => new Date(val).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', { day: '2-digit', month: '2-digit' })}
            />
            <YAxis 
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 600 }}
              axisLine={{ stroke: colors.border, opacity: 0.5 }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip currency={currency} locale={locale} />} />
            <Legend 
              verticalAlign="top" 
              align="right"
              iconType="circle"
              formatter={(value) => <span className={`${isAr ? 'font-almarai' : 'font-satoshi'} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{value}</span>} 
            />
            {suppliers.map((s, i) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: colors.surface }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls
                animationDuration={1500}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

