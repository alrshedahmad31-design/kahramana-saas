'use client'

import { useTranslations } from 'next-intl'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { colors } from '@/lib/design-tokens'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
  locale: string
}

function CustomTooltip({ active, payload, label, locale }: TooltipProps) {
  if (!active || !payload?.length) return null
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90" style={{ borderColor: colors.border }}>
      <p className={`${font} text-[10px] text-brand-muted mb-1.5 uppercase tracking-widest font-bold`}>
        {new Date(label || '').toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short' })}
      </p>
      <p className="font-satoshi text-lg font-black text-brand-gold tabular-nums">
        {payload[0]?.value?.toFixed(1)}%
      </p>
    </div>
  )
}

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
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.surface2} vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 700 }}
              tickFormatter={(v) => new Date(v).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short' })}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 700 }}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              axisLine={false}
              tickLine={false}
              dx={-10}
            />
            <Tooltip content={<CustomTooltip locale={locale} />} cursor={{ stroke: colors.surface2, strokeWidth: 1 }} />
            <ReferenceLine
              y={targetPct}
              stroke={colors.success}
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: t('targetLabel', { pct: targetPct }),
                position: 'insideTopRight',
                fill: colors.success,
                fontSize: 10,
                fontWeight: 900,
                offset: 10
              }}
            />
            <Line
              type="monotone"
              dataKey="pct"
              stroke={colors.gold}
              strokeWidth={3}
              dot={{ fill: colors.gold, r: 0, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: colors.gold, stroke: colors.surface, strokeWidth: 2 }}
              name={t('foodCostPct')}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

