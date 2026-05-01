'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { colors } from '@/lib/design-tokens'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ background: colors.surface, borderColor: colors.border }}>
      <p className="font-satoshi text-xs text-brand-muted mb-1">{label}</p>
      <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">{payload[0]?.value?.toFixed(1)}%</p>
    </div>
  )
}

export default function FoodCostTrendChart({
  data,
  targetPct,
}: {
  data: { date: string; pct: number }[]
  targetPct: number
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <p className="font-cairo text-sm font-black text-brand-text mb-4">اتجاه نسبة تكلفة الغذاء اليومية</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.surface2} />
          <XAxis dataKey="date" tick={{ fill: colors.muted, fontSize: 11 }} />
          <YAxis
            tick={{ fill: colors.muted, fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={targetPct}
            stroke={colors.success}
            strokeDasharray="4 4"
            label={{ value: `هدف ${targetPct}%`, position: 'insideTopRight', fill: colors.success, fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="pct"
            stroke={colors.gold}
            strokeWidth={2}
            dot={false}
            name="نسبة تكلفة الغذاء"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
