'use client'

import { colors, fonts } from '@/lib/design-tokens'
import { useLocale, useTranslations } from 'next-intl'
import type { LaborCostMetrics } from '@/lib/analytics/queries'
import { formatCurrency } from '@/lib/analytics/calculations'

interface Props {
  data:      LaborCostMetrics | null
  isLoading?: boolean
}

export default function LaborCostWidget({ data, isLoading }: Props) {
  const locale = useLocale()
  const t      = useTranslations('analytics.labor')
  const common = useTranslations('common')
  const isAr   = locale === 'ar'
  const font   = isAr ? fonts.arBody : fonts.enBody
  const headingFont = isAr ? fonts.arHeading : fonts.enHeading

  if (isLoading) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-brand-surface-2 rounded w-32 mb-4" />
        <div className="flex items-center gap-8">
          <div className="h-20 w-20 rounded-full bg-brand-surface-2" />
          <div className="flex-1 space-y-3">
            <div className="h-6 bg-brand-surface-2 rounded w-full" />
            <div className="h-4 bg-brand-surface-2 rounded w-2/3" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 flex items-center justify-center h-48">
        <p className={`${font} text-brand-muted text-sm`}>{t('noData')}</p>
      </div>
    )
  }

  const percentage = data.labor_cost_percentage
  const statusColor = 
    percentage < 20 ? colors.success : 
    percentage <= 30 ? colors.gold : 
    colors.error

  const strokeDasharray = 251.2 // 2 * PI * 40
  const offset = strokeDasharray - (percentage / 100) * strokeDasharray

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-6 transition-all hover:border-brand-gold/30">
      <div className="flex items-center justify-between mb-6">
        <h3 className={`${headingFont} text-brand-text font-semibold`}>
          {t('title')}
        </h3>
        <span className={`${font} text-[10px] px-2 py-0.5 rounded-full border tabular-nums`}
              style={{ borderColor: statusColor, color: statusColor, backgroundColor: `${statusColor}10` }}>
          {percentage < 20 ? t('statusGood') : percentage <= 30 ? t('statusWarning') : t('statusCritical')}
        </span>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8">
        {/* Radial Gauge */}
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="40"
              stroke={colors.surface2}
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r="40"
              stroke={statusColor}
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={strokeDasharray}
              style={{ 
                strokeDashoffset: Math.max(0, offset),
                transition: 'stroke-dashoffset 1s ease-out' 
              }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-satoshi text-xl font-bold text-brand-text tabular-nums">
              {percentage.toFixed(1)}%
            </span>
            <span className={`${font} text-[9px] text-brand-muted uppercase`}>
              {t('ofRevenue')}
            </span>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="flex-1 grid grid-cols-2 gap-4 w-full">
          <div className="space-y-1">
            <p className={`${font} text-[10px] text-brand-muted uppercase tracking-wider`}>
              {t('totalRevenue')}
            </p>
            <p className="font-satoshi text-lg font-bold text-brand-text tabular-nums">
              {formatCurrency(data.total_revenue)} <span className="text-xs font-normal text-brand-muted">{common('currency')}</span>
            </p>
          </div>
          <div className="space-y-1">
            <p className={`${font} text-[10px] text-brand-muted uppercase tracking-wider`}>
              {t('laborCost')}
            </p>
            <p className="font-satoshi text-lg font-bold text-brand-text tabular-nums" style={{ color: statusColor }}>
              {formatCurrency(data.total_labor_cost)} <span className="text-xs font-normal text-brand-muted">{common('currency')}</span>
            </p>
          </div>
          <div className="space-y-1">
            <p className={`${font} text-[10px] text-brand-muted uppercase tracking-wider`}>
              {t('staffCount')}
            </p>
            <p className="font-satoshi text-lg font-bold text-brand-text tabular-nums">
              {data.staff_count}
            </p>
          </div>
          <div className="space-y-1">
            <p className={`${font} text-[10px] text-brand-muted uppercase tracking-wider`}>
              {t('orders')}
            </p>
            <p className="font-satoshi text-lg font-bold text-brand-text tabular-nums">
              {data.order_count}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-brand-border/50">
        <p className={`${font} text-[11px] text-brand-muted leading-relaxed`}>
          {percentage < 20 ? t('insightGood') : percentage <= 30 ? t('insightWarning') : t('insightCritical')}
        </p>
      </div>
    </div>
  )
}
