'use client'

import { useTranslations } from 'next-intl'
import LightweightAreaChart from '@/components/charts/LightweightAreaChart'
import type { HourlyPoint } from '@/lib/dashboard/stats'

interface Props {
  hourlyPoints: HourlyPoint[]
  currency:     string
  isRTL:        boolean
}

// Only label every 4 hours
const LABELED_HOURS = new Set([0, 4, 8, 12, 16, 20])

export default function TodayRevenueChart({ hourlyPoints, currency }: Props) {
  const t = useTranslations('inventory.analytics')
  const maxRevenue = Math.max(...hourlyPoints.map(p => p.revenue))
  const totalToday = hourlyPoints.reduce((s, p) => s + p.revenue, 0)

  const peakPoint = hourlyPoints.reduce(
    (best, p) => p.revenue > best.revenue ? p : best,
    hourlyPoints[0] ?? { hour: 0, label: '', revenue: 0, orders: 0 },
  )

  // Trim trailing zeros from right to keep chart tidy
  const currentHourBH = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', hour12: false, timeZone: 'Asia/Bahrain',
  }).format(new Date())
  const currentH = parseInt(currentHourBH, 10) % 24
  const chartData = hourlyPoints.slice(0, currentH + 2)  // show up to 1 hour ahead
  const chartPoints = chartData.map((point) => ({ label: point.label, value: point.revenue }))

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-cairo font-black text-sm text-brand-muted uppercase tracking-wider">
            {t('revenue')}
          </h2>
          {totalToday > 0 && (
            <p className="font-satoshi font-black text-2xl text-brand-gold tabular-nums mt-1">
              {totalToday.toFixed(3)}
              <span className="text-sm font-medium text-brand-muted ms-1.5 font-satoshi">{currency}</span>
            </p>
          )}
        </div>

        {maxRevenue > 0 && peakPoint.revenue > 0 && (
          <div className="shrink-0 text-end">
            <p className="font-cairo text-xs text-brand-muted">
              {t('peak')}
            </p>
            <p className="font-satoshi text-sm font-bold text-brand-text tabular-nums">
              {peakPoint.label}
            </p>
            <p className="font-satoshi text-xs text-brand-gold tabular-nums">
              {peakPoint.revenue.toFixed(3)} {currency}
            </p>
          </div>
        )}
      </div>

      {maxRevenue === 0 ? (
        <div className="h-48 flex items-center justify-center">
          <p className="font-cairo text-sm text-brand-muted/40">
            {t('noRevenue')}
          </p>
        </div>
      ) : (
        <LightweightAreaChart
          points={chartPoints}
          currency={currency}
          height={200}
          gradientId="dashRevGrad"
          showAxes
          xTickFormatter={(label, index) => LABELED_HOURS.has(index) ? label : ''}
        />
      )}
    </div>
  )
}
