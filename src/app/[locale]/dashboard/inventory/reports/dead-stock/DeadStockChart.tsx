'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
      <p className="font-satoshi text-xs text-brand-muted mb-1 max-w-[160px] truncate">{label}</p>
      <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">BD {payload[0]?.value?.toFixed(3)}</p>
    </div>
  )
}

export default function DeadStockBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <p className="font-cairo text-sm font-black text-brand-text mb-4">أعلى 10 أصناف راكدة بالقيمة</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.surface2} />
          <XAxis dataKey="name" tick={{ fill: colors.muted, fontSize: 11 }} />
          <YAxis tick={{ fill: colors.muted, fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" fill={colors.error} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
