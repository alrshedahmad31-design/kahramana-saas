'use client'

import { useState } from 'react'
import type { MenuItemPerformanceRow } from '@/lib/analytics/queries'
import { colors } from '@/lib/design-tokens'

type SortKey = 'total_revenue' | 'total_quantity' | 'estimated_profit' | 'avg_price'

interface Props {
  items:  MenuItemPerformanceRow[]
  isRTL:  boolean
}

export default function ItemProfitability({ items, isRTL }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total_revenue')
  const [asc,     setAsc]     = useState(false)

  const sorted = [...items].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey]
    return asc ? diff : -diff
  })

  const totalRevenue = items.reduce((s, i) => s + i.total_revenue, 0)

  const currency = isRTL ? 'د.ب' : 'BD'

  function ColHead({ label, field }: { label: string; field: SortKey }) {
    const active = sortKey === field
    return (
      <th
        className={`pb-2 pt-1 px-3 text-xs font-medium cursor-pointer select-none
                    ${isRTL ? 'font-almarai text-end' : 'font-satoshi text-start'}
                    ${active ? 'text-brand-gold' : 'text-brand-muted hover:text-brand-text'}`}
        onClick={() => {
          if (sortKey === field) setAsc(!asc)
          else { setSortKey(field); setAsc(false) }
        }}
      >
        {label} {active ? (asc ? '↑' : '↓') : ''}
      </th>
    )
  }

  if (!items.length) {
    return (
      <p className={`text-sm text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
        {isRTL ? 'لا توجد بيانات' : 'No menu data yet — run migration 018'}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-border">
            <th className={`pb-2 pt-1 px-3 text-xs font-medium text-brand-muted ${isRTL ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
              {isRTL ? 'الصنف' : 'Item'}
            </th>
            <ColHead label={isRTL ? 'الكمية' : 'Units'} field="total_quantity" />
            <ColHead label={isRTL ? 'الإيرادات' : 'Revenue'} field="total_revenue" />
            <ColHead label={isRTL ? 'الربح (تقدير)' : 'Est. Profit'} field="estimated_profit" />
            <ColHead label={isRTL ? 'السعر الوسطي' : 'Avg Price'} field="avg_price" />
            <th className={`pb-2 pt-1 px-3 text-xs font-medium text-brand-muted ${isRTL ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
              {isRTL ? 'المساهمة' : 'Contribution'}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 30).map((item, idx) => {
            const contrib = totalRevenue > 0 ? (item.total_revenue / totalRevenue) * 100 : 0
            const isTop3  = idx < 3

            return (
              <tr
                key={item.item_id}
                className="border-b border-brand-border/40 hover:bg-brand-surface-2 transition-colors"
              >
                <td className="px-3 py-2.5">
                  <p className={`text-brand-text font-medium truncate max-w-[180px]
                                 ${isRTL ? 'font-almarai' : 'font-satoshi'}
                                 ${isTop3 ? 'text-brand-gold' : ''}`}>
                    {isTop3 && <span className="me-1">{['★', '★', '★'][idx]}</span>}
                    {isRTL ? item.name_ar : item.name_en}
                  </p>
                </td>
                <td className="px-3 py-2.5 font-satoshi tabular-nums text-brand-text text-center">
                  {item.total_quantity.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 font-satoshi tabular-nums text-brand-text">
                  {item.total_revenue.toFixed(3)} {currency}
                </td>
                <td className="px-3 py-2.5 font-satoshi tabular-nums" style={{ color: colors.success }}>
                  {item.estimated_profit.toFixed(3)} {currency}
                </td>
                <td className="px-3 py-2.5 font-satoshi tabular-nums text-brand-muted">
                  {item.avg_price.toFixed(3)} {currency}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 bg-brand-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(contrib, 100)}%`, background: colors.gold }}
                      />
                    </div>
                    <span className="text-xs font-satoshi tabular-nums text-brand-muted">
                      {contrib.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
