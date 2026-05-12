'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
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

interface RadarSeries {
  id: string
  name: string
  color: string
  values: number[]
}

function CustomTooltip({ metric, series, locale }: { metric: string; series: RadarSeries[]; locale: string }) {
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90" style={{ borderColor: colors.border }}>
      <p className={`${font} text-[10px] text-brand-muted mb-2 uppercase tracking-widest font-bold`}>{metric}</p>
      <div className="space-y-1.5">
        {series.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4">
            <span className={`${font} text-xs font-bold text-brand-muted`}>{item.name}</span>
            <span className="font-satoshi text-sm font-black tabular-nums" style={{ color: item.color }}>
              {item.values[0]?.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const RADAR_COLORS = [colors.gold, colors.success, colors.error, colors.muted, colors.border]

export default function VendorRadarChart({ vendors }: { vendors: VendorPerformanceRow[] }) {
  const [activeMetric, setActiveMetric] = useState<number | null>(null)
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

  const series: RadarSeries[] = top5.map((vendor, index) => {
    const vendorName = isAr ? vendor.name_ar : (vendor.name_en ?? vendor.name_ar)
    return {
      id: vendor.id,
      name: vendorName,
      color: RADAR_COLORS[index % RADAR_COLORS.length]!,
      values: metrics.map((metric) => {
        if (metric.key === 'accuracy') return vendor.delivery_accuracy_pct ?? 0
        if (metric.key === 'quality') return (vendor.avg_quality_rating ?? 0) * 20
        return Math.max(0, 100 - Math.min((vendor.avg_delay_days ?? 0) * 10, 100))
      }),
    }
  })
  const center = { x: 160, y: 145 }
  const radius = 105
  const axisPoints = metrics.map((metric, index) => {
    const angle = -90 + index * (360 / metrics.length)
    const radians = angle * Math.PI / 180
    return {
      ...metric,
      x: center.x + radius * Math.cos(radians),
      y: center.y + radius * Math.sin(radians),
      labelX: center.x + (radius + 26) * Math.cos(radians),
      labelY: center.y + (radius + 26) * Math.sin(radians),
    }
  })
  const activeSeries = activeMetric === null
    ? []
    : series.map((item) => ({ ...item, values: [item.values[activeMetric] ?? 0] }))

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-sm hover:shadow-md transition-all">
      <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text mb-6 uppercase tracking-wider`}>
        {isAr ? 'مقارنة أفضل 5 موردين (0-100)' : 'Top 5 Vendors Comparison (0-100)'}
      </h3>
      <div className="h-[320px] w-full">
        <div className="relative h-full w-full" onMouseLeave={() => setActiveMetric(null)}>
          <svg width="100%" height="100%" viewBox="0 0 320 320" role="img" aria-hidden="true">
            {[0.33, 0.66, 1].map((ratio) => {
              const points = axisPoints.map((point) => `${center.x + (point.x - center.x) * ratio},${center.y + (point.y - center.y) * ratio}`).join(' ')
              return <polygon key={ratio} points={points} fill="none" stroke={colors.border} opacity="0.3" />
            })}
            {axisPoints.map((point, index) => (
              <g key={point.key} onMouseEnter={() => setActiveMetric(index)} onFocus={() => setActiveMetric(index)} tabIndex={-1}>
                <line x1={center.x} y1={center.y} x2={point.x} y2={point.y} stroke={colors.border} opacity="0.3" />
                <text x={point.labelX} y={point.labelY} textAnchor="middle" fill={colors.muted} fontSize="10" fontWeight="700">
                  {point.label}
                </text>
              </g>
            ))}
            {[0, 50, 100].map((tick) => (
              <text key={tick} x={center.x + 4} y={center.y - (tick / 100) * radius} fill={colors.muted} fontSize="8" fontWeight="600">
                {tick}
              </text>
            ))}
            {series.map((item) => {
              const points = item.values.map((value, index) => {
                const axis = axisPoints[index]!
                const ratio = value / 100
                return `${center.x + (axis.x - center.x) * ratio},${center.y + (axis.y - center.y) * ratio}`
              }).join(' ')
              return (
                <polygon
                  key={item.id}
                  points={points}
                  fill={item.color}
                  fillOpacity="0.1"
                  stroke={item.color}
                  strokeWidth="2"
                />
              )
            })}
          </svg>
          {activeMetric !== null && (
            <div className="pointer-events-none absolute" style={{ left: '50%', top: 20, transform: 'translateX(-50%)' }}>
              <CustomTooltip metric={metrics[activeMetric]!.label} series={activeSeries} locale={locale} />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {series.map((item) => (
          <span key={item.id} className={`${font} inline-flex items-center gap-2 text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
    </div>
  )
}
