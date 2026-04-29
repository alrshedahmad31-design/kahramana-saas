'use client'

import { formatPercentage } from '@/lib/analytics/calculations'
import { colors } from '@/lib/design-tokens'

interface Props {
  title:      string
  value:      string
  unit?:      string
  change?:    number  // percentage growth vs prev period
  isLoading?: boolean
}

export default function MetricCard({ title, value, unit, change, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 animate-pulse">
        <div className="h-3 bg-brand-surface-2 rounded w-24 mb-3" />
        <div className="h-8 bg-brand-surface-2 rounded w-32 mb-2" />
        <div className="h-3 bg-brand-surface-2 rounded w-16" />
      </div>
    )
  }

  const trendColor =
    change === undefined || change === 0
      ? colors.muted
      : change > 0
      ? colors.success
      : colors.error

  const trendArrow = change === undefined || change === 0 ? '' : change > 0 ? '↑' : '↓'

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
      <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide mb-2">
        {title}
      </p>

      <p className="font-satoshi text-2xl font-bold text-brand-text tabular-nums">
        {value}
        {unit && (
          <span className="text-sm font-normal text-brand-muted ms-1">{unit}</span>
        )}
      </p>

      {change !== undefined && (
        <p
          className="font-satoshi text-xs mt-1.5 tabular-nums"
          style={{ color: trendColor }}
        >
          {trendArrow} {formatPercentage(change)}
          <span className="text-brand-muted ms-1 font-normal" style={{ color: colors.muted }}>
            vs prev period
          </span>
        </p>
      )}
    </div>
  )
}
