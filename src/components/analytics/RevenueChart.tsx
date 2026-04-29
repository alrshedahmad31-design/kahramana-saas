'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { colors } from '@/lib/design-tokens'
import { formatDateShort } from '@/lib/analytics/calculations'
import type { DailySalesRow } from '@/lib/analytics/queries'

interface Props {
  data:     DailySalesRow[]
  currency: string
}

interface TooltipPayloadItem {
  value: number
}

interface CustomTooltipProps {
  active?:   boolean
  payload?:  TooltipPayloadItem[]
  label?:    string
  currency:  string
}

function CustomTooltip({ active, payload, label, currency }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{ background: colors.surface, borderColor: colors.goldDark }}
    >
      <p className="font-satoshi text-xs text-brand-muted mb-1">{label}</p>
      <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">
        {(payload[0]?.value ?? 0).toFixed(3)} {currency}
      </p>
    </div>
  )
}

export default function RevenueChart({ data, currency }: Props) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center">
        <p className="font-satoshi text-sm text-brand-muted">No data for this period</p>
      </div>
    )
  }

  const chartData = data.map((r) => ({
    date:    formatDateShort(r.order_date),
    revenue: parseFloat(r.total_revenue_bhd.toFixed(3)),
    orders:  r.order_count,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={colors.gold} stopOpacity={0.3} />
            <stop offset="100%" stopColor={colors.gold} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={colors.surface2} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: colors.muted, fontSize: 11, fontFamily: 'Satoshi' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: colors.muted, fontSize: 11, fontFamily: 'Satoshi' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v.toFixed(0)}
        />
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={colors.gold}
          strokeWidth={2}
          fill="url(#revenueGrad)"
          dot={false}
          activeDot={{ r: 4, fill: colors.gold }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
