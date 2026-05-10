'use client'

import { colors, fonts } from '@/lib/design-tokens'
import { useLocale, useTranslations } from 'next-intl'
import type { AnalyticsMenuEngineeringRow } from '@/lib/analytics/queries'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'

interface Props {
  data:      AnalyticsMenuEngineeringRow[]
  isLoading?: boolean
}

interface CustomTooltipProps {
  active?:  boolean
  // Recharts threads each scatter point's row through `payload[i].payload`.
  // We only read index 0, and the row shape is exactly AnalyticsMenuEngineeringRow.
  payload?: Array<{ payload: AnalyticsMenuEngineeringRow }>
  locale:   string
}

function CustomTooltip({ active, payload, locale }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  if (!item) return null

  const t = (key: string) => key // Placeholder for tooltip specific translations if needed

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
  const locale = useLocale()
  const t      = useTranslations('analytics.menuEngineering')
  const isAr   = locale === 'ar'
  const font   = isAr ? fonts.arBody : fonts.enBody
  const headingFont = isAr ? fonts.arHeading : fonts.enHeading

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

  // Calculate mid points for axes (average of all items in view)
  const avgQty = data.reduce((s, r) => s + r.total_quantity, 0) / data.length
  const avgProfit = data.reduce((s, r) => s + r.profit_per_item, 0) / data.length

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
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
            <XAxis 
              type="number" 
              dataKey="total_quantity" 
              name="Popularity" 
              unit="" 
              label={{ value: t('xAxis'), position: 'insideBottom', offset: -10, fill: colors.muted, fontSize: 10, fontFamily: fonts.numbers }}
              tick={{ fill: colors.muted, fontSize: 10, fontFamily: fonts.numbers }}
              axisLine={{ stroke: colors.border }}
            />
            <YAxis 
              type="number" 
              dataKey="profit_per_item" 
              name="Profitability" 
              unit=" BD" 
              label={{ value: t('yAxis'), angle: -90, position: 'insideLeft', offset: 0, fill: colors.muted, fontSize: 10, fontFamily: fonts.numbers }}
              tick={{ fill: colors.muted, fontSize: 10, fontFamily: fonts.numbers }}
              axisLine={{ stroke: colors.border }}
            />
            <ZAxis type="number" dataKey="total_profit" range={[50, 400]} />
            <Tooltip content={<CustomTooltip locale={locale} />} cursor={{ strokeDasharray: '3 3' }} />
            
            {/* Reference lines to mark the quadrants */}
            <ReferenceLine x={avgQty} stroke={colors.goldDark} strokeDasharray="5 5" opacity={0.3} />
            <ReferenceLine y={avgProfit} stroke={colors.goldDark} strokeDasharray="5 5" opacity={0.3} />

            <Scatter name="Menu Items" data={data}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getClassificationColor(entry.classification)} 
                  fillOpacity={0.7}
                  stroke={getClassificationColor(entry.classification)}
                  strokeWidth={2}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
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
