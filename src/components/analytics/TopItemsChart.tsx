'use client'

import { useState } from 'react'
import { colors } from '@/lib/design-tokens'
import type { TopItemRow } from '@/lib/analytics/queries'

interface Props {
  data:   TopItemRow[]
  locale: string
}

export default function TopItemsChart({ data, locale }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center">
        <p className="font-satoshi text-sm text-brand-muted">No data for this period</p>
      </div>
    )
  }

  const top10 = data.slice(0, 10)
  const maxOrders = Math.max(...top10.map((item) => item.total_quantity), 1)
  const height = Math.max(220, top10.length * 36)
  const chartData = top10.map((r) => ({
    name:    locale === 'ar'
      ? (r.name_ar.length > 18 ? r.name_ar.slice(0, 18) + '…' : r.name_ar)
      : (r.name_en.length > 18 ? r.name_en.slice(0, 18) + '…' : r.name_en),
    nameAr:  r.name_ar,
    nameEn:  r.name_en,
    orders:  r.total_quantity,
    revenue: r.total_revenue_bhd,
  }))
  const activeItem = activeIndex === null ? null : chartData[activeIndex] ?? null

  return (
    <div
      className="relative w-full"
      style={{ height }}
      onMouseLeave={() => setActiveIndex(null)}
    >
      <svg width="100%" height={height} viewBox={`0 0 400 ${height}`} role="img" aria-hidden="true">
        {chartData.map((item, index) => {
          const y = 10 + index * 36
          const width = (item.orders / maxOrders) * 230
          const fill = index === 0 ? colors.gold : index === 1 ? colors.goldDark : colors.surface2
          return (
            <g
              key={item.name}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              tabIndex={-1}
            >
              <text x="0" y={y + 17} fill={colors.text} fontFamily="Satoshi" fontSize="11">
                {item.name}
              </text>
              <rect x="138" y={y + 4} width="240" height="20" rx="4" fill={colors.surface2} opacity="0.35" />
              <rect x="138" y={y + 4} width={width} height="20" rx="4" fill={fill} />
              <text x="386" y={y + 18} fill={colors.muted} fontFamily="Satoshi" fontSize="11" textAnchor="end">
                {item.orders}
              </text>
            </g>
          )
        })}
      </svg>

      {activeItem && (
        <div
          className="pointer-events-none absolute rounded-lg border px-3 py-2 shadow-lg max-w-[180px]"
          style={{
            background: colors.surface,
            borderColor: colors.goldDark,
            left: 170,
            top: 10 + (activeIndex ?? 0) * 36,
            transform: 'translateY(-85%)',
          }}
        >
          <p className="font-satoshi text-xs text-brand-text font-medium mb-1 truncate">
            {locale === 'ar' ? activeItem.nameAr : activeItem.nameEn}
          </p>
          <p className="font-satoshi text-xs text-brand-gold tabular-nums">
            {activeItem.orders} orders
          </p>
          <p className="font-satoshi text-xs text-brand-muted tabular-nums">
            {activeItem.revenue.toFixed(3)} BD
          </p>
        </div>
      )}
    </div>
  )
}
