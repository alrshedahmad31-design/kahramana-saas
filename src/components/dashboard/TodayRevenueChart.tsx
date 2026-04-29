'use client'

import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { colors } from '@/lib/design-tokens'
import type { HourlyPoint } from '@/lib/dashboard/stats'

interface Props {
  hourlyPoints: HourlyPoint[]
  currency:     string
  isRTL:        boolean
}

// Only label every 4 hours
const LABELED_HOURS = new Set([0, 4, 8, 12, 16, 20])

interface TooltipPayload { value: number }
interface TooltipProps { active?: boolean; payload?: TooltipPayload[]; label?: string; currency: string }

function CustomTooltip({ active, payload, label, currency }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg text-start"
      style={{ background: colors.surface, borderColor: colors.goldDark }}
    >
      <p className="font-satoshi text-xs text-brand-muted mb-1">{label}</p>
      <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">
        {(payload[0]?.value ?? 0).toFixed(3)} {currency}
      </p>
    </div>
  )
}

export default function TodayRevenueChart({ hourlyPoints, currency, isRTL }: Props) {
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

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className={`font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider ${isRTL ? 'font-almarai' : ''}`}>
            {isRTL ? 'الإيرادات اليوم' : "Today's Revenue"}
          </h2>
          {totalToday > 0 && (
            <p className="font-satoshi font-black text-2xl text-brand-gold tabular-nums mt-1">
              {totalToday.toFixed(3)}
              <span className="text-sm font-medium text-brand-muted ms-1.5">{currency}</span>
            </p>
          )}
        </div>

        {maxRevenue > 0 && peakPoint.revenue > 0 && (
          <div className="shrink-0 text-end">
            <p className="font-satoshi text-xs text-brand-muted">
              {isRTL ? 'الذروة' : 'Peak'}
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
          <p className="font-satoshi text-sm text-brand-muted/40">
            {isRTL ? 'لا توجد إيرادات بعد' : 'No revenue yet today'}
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={colors.gold} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colors.gold} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke={colors.surface2}
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.muted, fontSize: 11, fontFamily: 'Satoshi' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              tickFormatter={(v: string, i: number) => LABELED_HOURS.has(i) ? v : ''}
            />
            <YAxis
              tick={{ fill: colors.muted, fontSize: 11, fontFamily: 'Satoshi' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v > 0 ? v.toFixed(0) : ''}
              width={36}
            />
            <Tooltip content={<CustomTooltip currency={currency} />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={colors.gold}
              strokeWidth={2.5}
              fill="url(#dashRevGrad)"
              dot={false}
              activeDot={{ r: 4, fill: colors.gold, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
