'use client'

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { colors } from '@/lib/design-tokens'

interface VendorPerformanceRow {
  id: string
  name_ar: string
  name_en: string | null
  total_orders: number
  total_spent_bhd: number
  delivery_accuracy_pct: number | null
  avg_quality_rating: number | null
  avg_delay_days: number | null
  cancelled_orders: number
}

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
      {payload.map((p, i) => (
        <p key={i} className="font-satoshi text-xs tabular-nums" style={{ color: colors.gold }}>{p.name}: {p.value.toFixed(0)}</p>
      ))}
    </div>
  )
}

const RADAR_COLORS = [colors.gold, colors.success, colors.error, colors.muted, colors.border]

export default function VendorRadarChart({ vendors }: { vendors: VendorPerformanceRow[] }) {
  const top5 = vendors.slice(0, 5)

  const metrics = ['دقة التسليم', 'الجودة', 'التوقيت']

  // Build data: each metric is a row, each vendor is a key
  const data = metrics.map((metric) => {
    const row: Record<string, number | string> = { metric }
    top5.forEach((v) => {
      if (metric === 'دقة التسليم') {
        row[v.name_ar] = v.delivery_accuracy_pct ?? 0
      } else if (metric === 'الجودة') {
        row[v.name_ar] = (v.avg_quality_rating ?? 0) * 20
      } else {
        row[v.name_ar] = Math.max(0, 100 - Math.min((v.avg_delay_days ?? 0) * 10, 100))
      }
    })
    return row
  })

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <p className="font-cairo text-sm font-black text-brand-text mb-4">مقارنة أفضل 5 موردين (0-100)</p>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data}>
          <PolarGrid stroke={colors.surface2} />
          <PolarAngleAxis dataKey="metric" tick={{ fill: colors.muted, fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: colors.muted, fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(value) => <span style={{ color: colors.muted, fontSize: 11 }}>{value}</span>} />
          {top5.map((v, i) => (
            <Radar
              key={v.id}
              name={v.name_ar}
              dataKey={v.name_ar}
              stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
              fill={RADAR_COLORS[i % RADAR_COLORS.length]}
              fillOpacity={0.15}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
