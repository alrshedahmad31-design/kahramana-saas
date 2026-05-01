'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { colors } from '@/lib/design-tokens'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { name: string; value: number } }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ background: colors.surface, borderColor: colors.border }}>
      <p className="font-satoshi text-xs text-brand-muted mb-1">{payload[0]?.payload?.name}</p>
      <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">BD {Number(payload[0]?.value).toFixed(3)}</p>
    </div>
  )
}

const ABC_COLORS: Record<string, string> = {
  A: colors.error,
  B: colors.gold,
  C: colors.success,
}

export default function AbcPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <p className="font-cairo text-sm font-black text-brand-text mb-4">توزيع القيمة حسب التصنيف</p>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={110}
            label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={ABC_COLORS[entry.name] ?? colors.muted} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(value) => <span style={{ color: colors.muted, fontSize: 12 }}>{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
