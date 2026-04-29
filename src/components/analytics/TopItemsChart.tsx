'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { colors } from '@/lib/design-tokens'
import type { TopItemRow } from '@/lib/analytics/queries'

interface Props {
  data:   TopItemRow[]
  locale: string
}

interface CustomTooltipProps {
  active?:  boolean
  payload?: Array<{ value: number; payload: { nameAr: string; nameEn: string; revenue: number } }>
  locale:   string
}

function CustomTooltip({ active, payload, locale }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  if (!item) return null

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg max-w-[180px]"
      style={{ background: colors.surface, borderColor: colors.goldDark }}
    >
      <p className="font-satoshi text-xs text-brand-text font-medium mb-1 truncate">
        {locale === 'ar' ? item.nameAr : item.nameEn}
      </p>
      <p className="font-satoshi text-xs text-brand-gold tabular-nums">
        {payload[0]?.value ?? 0} orders
      </p>
      <p className="font-satoshi text-xs text-brand-muted tabular-nums">
        {item.revenue.toFixed(3)} BD
      </p>
    </div>
  )
}

export default function TopItemsChart({ data, locale }: Props) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center">
        <p className="font-satoshi text-sm text-brand-muted">No data for this period</p>
      </div>
    )
  }

  const top10 = data.slice(0, 10)
  const chartData = top10.map((r) => ({
    name:    locale === 'ar'
      ? (r.name_ar.length > 18 ? r.name_ar.slice(0, 18) + '…' : r.name_ar)
      : (r.name_en.length > 18 ? r.name_en.slice(0, 18) + '…' : r.name_en),
    nameAr:  r.name_ar,
    nameEn:  r.name_en,
    orders:  r.total_quantity,
    revenue: r.total_revenue_bhd,
  }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, top10.length * 36)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid stroke={colors.surface2} strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: colors.muted, fontSize: 11, fontFamily: 'Satoshi' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fill: colors.text, fontSize: 11, fontFamily: 'Satoshi' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip locale={locale} />} />
        <Bar dataKey="orders" radius={[0, 4, 4, 0]}>
          {chartData.map((_, i) => (
            <Cell
              key={i}
              fill={i === 0 ? colors.gold : i === 1 ? colors.goldDark : colors.surface2}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
