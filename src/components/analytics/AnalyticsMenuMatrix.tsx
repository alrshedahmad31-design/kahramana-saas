'use client'

import { useMemo, useState } from 'react'
import { colors, fonts } from '@/lib/design-tokens'
import { useLocale, useTranslations } from 'next-intl'
import type { AnalyticsMenuEngineeringRow } from '@/lib/analytics/queries'

interface Props {
  data:      AnalyticsMenuEngineeringRow[]
  isLoading?: boolean
}

function MatrixTooltip({ item, locale }: { item: AnalyticsMenuEngineeringRow; locale: string }) {
  return (
    <div className="bg-brand-surface border border-brand-gold/50 rounded-lg p-3 shadow-xl max-w-[200px]">
      <p className="font-satoshi text-xs text-brand-text font-bold mb-2">
        {locale === 'ar' ? item.name_ar : item.name_en}
      </p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-[10px] text-brand-muted uppercase">Qty</span>
          <span className="text-[10px] text-brand-text font-medium tabular-nums">{item.total_quantity}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[10px] text-brand-muted uppercase">Profit/Unit</span>
          <span className="text-[10px] text-brand-text font-medium tabular-nums">{item.profit_per_item.toFixed(3)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[10px] text-brand-muted uppercase">Total Profit</span>
          <span className="text-[10px] text-brand-gold font-bold tabular-nums">{item.total_profit.toFixed(3)} BD</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-brand-border/50">
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-gold/10 text-brand-gold border border-brand-gold/20 uppercase font-bold tracking-tighter">
          {item.classification}
        </span>
      </div>
    </div>
  )
}

export default function AnalyticsMenuMatrix({ data, isLoading }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const locale = useLocale()
  const t      = useTranslations('analytics.menuEngineering')
  const isAr   = locale === 'ar'
  const font   = isAr ? fonts.arBody : fonts.enBody
  const headingFont = isAr ? fonts.arHeading : fonts.enHeading
  const avgQty = data.length ? data.reduce((s, r) => s + r.total_quantity, 0) / data.length : 0
  const avgProfit = data.length ? data.reduce((s, r) => s + r.profit_per_item, 0) / data.length : 0
  const maxQty = Math.max(...data.map((item) => item.total_quantity), avgQty, 1)
  const maxProfit = Math.max(...data.map((item) => item.profit_per_item), avgProfit, 1)
  const maxTotalProfit = Math.max(...data.map((item) => item.total_profit), 1)
  const activeItem = activeIndex === null ? null : data[activeIndex] ?? null
  const chartPoints = useMemo(() => {
    const width = 400
    const height = 400
    const margin = { top: 20, right: 20, bottom: 42, left: 42 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    return data.map((item) => ({
      item,
      x: margin.left + (item.total_quantity / maxQty) * innerWidth,
      y: margin.top + innerHeight - (item.profit_per_item / maxProfit) * innerHeight,
      r: 5 + (item.total_profit / maxTotalProfit) * 12,
    }))
  }, [data, maxProfit, maxQty, maxTotalProfit])

  if (isLoading) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-brand-surface-2 rounded w-48 mb-6" />
        <div className="h-64 bg-brand-surface-2 rounded w-full" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 flex items-center justify-center h-64">
        <p className={`${font} text-brand-muted text-sm`}>{t('noData')}</p>
      </div>
    )
  }

  const getClassificationColor = (cls: string) => {
    switch (cls) {
      case 'Star':     return colors.success
      case 'Plowhorse': return colors.gold
      case 'Puzzle':    return colors.goldDark
      case 'Dog':       return colors.error
      default:          return colors.muted
    }
  }

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className={`${headingFont} text-brand-text font-semibold`}>
            {t('title')}
          </h3>
          <p className={`${font} text-[11px] text-brand-muted mt-1`}>
            {t('subtitle')}
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {['Star', 'Plowhorse', 'Puzzle', 'Dog'].map((cls) => (
            <div key={cls} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getClassificationColor(cls) }} />
              <span className={`${font} text-[10px] text-brand-text`}>{t(`class${cls}`)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[400px] w-full">
        <div className="relative h-full w-full" onMouseLeave={() => setActiveIndex(null)}>
          <svg width="100%" height="100%" viewBox="0 0 400 400" role="img" aria-hidden="true">
            {[0.25, 0.5, 0.75].map((ratio) => (
              <g key={ratio}>
                <line x1="42" x2="380" y1={20 + 338 * ratio} y2={20 + 338 * ratio} stroke={colors.border} strokeDasharray="3 3" />
                <line x1={42 + 338 * ratio} x2={42 + 338 * ratio} y1="20" y2="358" stroke={colors.border} strokeDasharray="3 3" />
              </g>
            ))}
            <line x1="42" x2="380" y1="358" y2="358" stroke={colors.border} />
            <line x1="42" x2="42" y1="20" y2="358" stroke={colors.border} />
            <line
              x1={42 + (avgQty / maxQty) * 338}
              x2={42 + (avgQty / maxQty) * 338}
              y1="20"
              y2="358"
              stroke={colors.goldDark}
              strokeDasharray="5 5"
              opacity="0.3"
            />
            <line
              x1="42"
              x2="380"
              y1={20 + 338 - (avgProfit / maxProfit) * 338}
              y2={20 + 338 - (avgProfit / maxProfit) * 338}
              stroke={colors.goldDark}
              strokeDasharray="5 5"
              opacity="0.3"
            />
            <text x="211" y="392" textAnchor="middle" fill={colors.muted} fontSize="10" fontFamily={fonts.numbers}>
              {t('xAxis')}
            </text>
            <text x="12" y="195" textAnchor="middle" fill={colors.muted} fontSize="10" fontFamily={fonts.numbers} transform="rotate(-90 12 195)">
              {t('yAxis')}
            </text>
            {[0, 0.5, 1].map((ratio) => (
              <g key={ratio}>
                <text x="34" y={358 - ratio * 338 + 3} textAnchor="end" fill={colors.muted} fontSize="10" fontFamily={fonts.numbers}>
                  {(maxProfit * ratio).toFixed(1)}
                </text>
                <text x={42 + ratio * 338} y="374" textAnchor="middle" fill={colors.muted} fontSize="10" fontFamily={fonts.numbers}>
                  {(maxQty * ratio).toFixed(0)}
                </text>
              </g>
            ))}
            {chartPoints.map((point, index) => {
              const color = getClassificationColor(point.item.classification)
              return (
                <circle
                  key={`${point.item.slug}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={point.r}
                  fill={color}
                  fillOpacity="0.7"
                  stroke={color}
                  strokeWidth="2"
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  tabIndex={-1}
                />
              )
            })}
          </svg>
          {activeItem && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: `${(chartPoints[activeIndex ?? 0]!.x / 400) * 100}%`,
                top: `${(chartPoints[activeIndex ?? 0]!.y / 400) * 100}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <MatrixTooltip item={activeItem} locale={locale} />
            </div>
          )}
        </div>
      </div>

      {/* Quadrant Legend Mobile/Info */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: 'Star', icon: '⭐', desc: t('descStar') },
          { key: 'Plowhorse', icon: '🐎', desc: t('descPlowhorse') },
          { key: 'Puzzle', icon: '🧩', desc: t('descPuzzle') },
          { key: 'Dog', icon: '🐕', desc: t('descDog') }
        ].map((item) => (
          <div key={item.key} className="p-3 rounded-lg border border-brand-border/30 bg-brand-surface-2/30">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm">{item.icon}</span>
              <span className={`${headingFont} text-[11px] font-bold`} style={{ color: getClassificationColor(item.key) }}>
                {t(`class${item.key}`)}
              </span>
            </div>
            <p className={`${font} text-[10px] text-brand-muted leading-relaxed`}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
