'use client'

import { useTranslations, useLocale } from 'next-intl'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { colors } from '@/lib/design-tokens'

interface VendorPerformanceRow {
  id: string
  name_ar: string
  name_en: string | null
  total_orders: number
  total_spent_bhd: number
  delivery_accuracy_pct: number | null
  avg_quality_rating: number | null
  avg_delay_days: number | null
  cancelled_orders: number
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string; payload: any }>
  label?: string
  locale: string
}

function CustomTooltip({ active, payload, label, locale }: TooltipProps) {
  if (!active || !payload?.length) return null
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90" style={{ borderColor: colors.border }}>
      <p className={`${font} text-[10px] text-brand-muted mb-2 uppercase tracking-widest font-bold`}>{label}</p>
      <div className="space-y-1.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className={`${font} text-xs font-bold text-brand-muted`}>{p.name}</span>
            <span className="font-satoshi text-sm font-black tabular-nums" style={{ color: p.color }}>
              {p.value.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const RADAR_COLORS = [colors.brand.gold, colors.brand.success, colors.brand.error, colors.brand.muted, colors.brand.border]

export default function VendorRadarChart({ vendors }: { vendors: VendorPerformanceRow[] }) {
  const locale = useLocale()
  const t = useTranslations('inventory.reports.vendorPerformance')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  const top5 = vendors.slice(0, 5)
  const metrics = [
    { key: 'accuracy', label: t('accuracyLabel') },
    { key: 'quality', label: t('qualityLabel') },
    { key: 'timing', label: t('delayLabel') }
  ]

  // Build data: each metric is a row, each vendor is a key
  const data = metrics.map((m) => {
    const row: Record<string, number | string> = { metric: m.label }
    top5.forEach((v) => {
      const vendorName = isAr ? v.name_ar : (v.name_en ?? v.name_ar)
      if (m.key === 'accuracy') {
        row[vendorName] = v.delivery_accuracy_pct ?? 0
      } else if (m.key === 'quality') {
        row[vendorName] = (v.avg_quality_rating ?? 0) * 20
      } else {
        row[vendorName] = Math.max(0, 100 - Math.min((v.avg_delay_days ?? 0) * 10, 100))
      }
    })
    return row
  })

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-sm hover:shadow-md transition-all">
      <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text mb-6 uppercase tracking-wider`}>
        {isAr ? 'مقارنة أفضل 5 موردين (0-100)' : 'Top 5 Vendors Comparison (0-100)'}
      </h3>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke={colors.border} opacity={0.3} />
            <PolarAngleAxis 
              dataKey="metric" 
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 700 }} 
            />
            <PolarRadiusAxis 
              domain={[0, 100]} 
              tick={{ fill: colors.muted, fontSize: 8, fontWeight: 600 }} 
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip locale={locale} />} />
            <Legend 
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              formatter={(value) => <span className={`${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{value}</span>} 
            />
            {top5.map((v, i) => {
              const vendorName = isAr ? v.name_ar : (v.name_en ?? v.name_ar)
              return (
                <Radar
                  key={v.id}
                  name={vendorName}
                  dataKey={vendorName}
                  stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
                  fill={RADAR_COLORS[i % RADAR_COLORS.length]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  animationDuration={1500}
                />
              )
            })}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
