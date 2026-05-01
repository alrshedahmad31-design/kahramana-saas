'use client'

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { colors } from '@/lib/design-tokens'

const PIE_COLORS = [colors.gold, colors.error, colors.success, colors.muted, colors.border]

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { name: string; value: number } }>
  label?: string
}

function PieTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ background: colors.surface, borderColor: colors.border }}>
      <p className="font-satoshi text-xs text-brand-muted mb-1">{payload[0]?.payload?.name}</p>
      <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">BD {Number(payload[0]?.value).toFixed(3)}</p>
    </div>
  )
}

function LineTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ background: colors.surface, borderColor: colors.border }}>
      <p className="font-satoshi text-xs text-brand-muted mb-1">{label}</p>
      <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">BD {Number(payload[0]?.value).toFixed(3)}</p>
    </div>
  )
}

export function WasteByReasonChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <p className="font-cairo text-sm font-black text-brand-text mb-4">الهدر حسب السبب</p>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((_, index) => (
              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
          <Legend formatter={(value) => <span style={{ color: colors.muted, fontSize: 12 }}>{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WasteTrendChart({ data }: { data: { date: string; cost: number }[] }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <p className="font-cairo text-sm font-black text-brand-text mb-4">اتجاه تكلفة الهدر اليومي</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.surface2} />
          <XAxis dataKey="date" tick={{ fill: colors.muted, fontSize: 11 }} />
          <YAxis tick={{ fill: colors.muted, fontSize: 11 }} />
          <Tooltip content={<LineTooltip />} />
          <Line type="monotone" dataKey="cost" stroke={colors.gold} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
