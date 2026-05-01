'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { colors } from '@/lib/design-tokens'

const LINE_COLORS = [colors.gold, colors.success, colors.error, colors.muted, colors.border]

interface HistoryRow {
  id: string
  unit_cost: number
  effective_at: string
  supplier: { name_ar: string } | null
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ background: colors.surface, borderColor: colors.border }}>
      <p className="font-satoshi text-xs text-brand-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-satoshi text-xs tabular-nums" style={{ color: p.color }}>
          {p.name}: BD {Number(p.value).toFixed(3)}
        </p>
      ))}
    </div>
  )
}

export default function PriceHistoryChart({ history }: { history: HistoryRow[] }) {
  // Group by supplier
  const supplierMap = new Map<string, Map<string, number>>()
  for (const row of history) {
    const supplier = row.supplier?.name_ar ?? 'غير محدد'
    if (!supplierMap.has(supplier)) supplierMap.set(supplier, new Map())
    supplierMap.get(supplier)!.set(row.effective_at.slice(0, 10), row.unit_cost)
  }

  const suppliers = Array.from(supplierMap.keys())
  const dates = Array.from(new Set(history.map((r) => r.effective_at.slice(0, 10)))).sort()

  const chartData = dates.map((date) => {
    const row: Record<string, number | string> = { date }
    suppliers.forEach((s) => {
      row[s] = supplierMap.get(s)?.get(date) ?? 0
    })
    return row
  })

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <p className="font-cairo text-sm font-black text-brand-text mb-4">تاريخ الأسعار حسب المورد</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.surface2} />
          <XAxis dataKey="date" tick={{ fill: colors.muted, fontSize: 11 }} />
          <YAxis tick={{ fill: colors.muted, fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(value) => <span style={{ color: colors.muted, fontSize: 11 }}>{value}</span>} />
          {suppliers.map((s, i) => (
            <Line
              key={s}
              type="monotone"
              dataKey={s}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
