'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { colors } from '@/lib/design-tokens'

const PIE_COLORS = [colors.gold, colors.error, colors.success, colors.muted, colors.border, colors.surface2]

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { name: string; value: number } }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ background: colors.surface, borderColor: colors.border }}>
      <p className="font-satoshi text-xs text-brand-muted mb-1">{payload[0]?.payload?.name}</p>
      <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">
        BD {Number(payload[0]?.value).toFixed(3)}
      </p>
    </div>
  )
}

export default function ValuationPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <p className="font-cairo text-sm font-black text-brand-text mb-4">التوزيع حسب الفئة</p>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={110}
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(value) => <span style={{ color: colors.muted, fontSize: 12 }}>{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
