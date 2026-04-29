'use client'

import type { BranchSummary } from '@/lib/analytics/queries'

interface Props {
  data:     BranchSummary[]
  currency: string
  locale:   string
}

const BRANCH_NAMES: Record<string, { ar: string; en: string }> = {
  riffa:   { ar: 'الرفاع',  en: 'Riffa'   },
  qallali: { ar: 'قلالي',   en: 'Qallali' },
  badi:    { ar: 'البديع',  en: "Al-Badi'" },
}

export default function BranchComparisonTable({ data, currency, locale }: Props) {
  const isAr = locale === 'ar'

  if (!data.length) {
    return (
      <p className="font-satoshi text-sm text-brand-muted py-4 text-center">
        {isAr ? 'لا توجد بيانات' : 'No data for this period'}
      </p>
    )
  }

  const total = data.reduce((s, r) => s + r.total_revenue_bhd, 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-satoshi text-sm" dir={isAr ? 'rtl' : 'ltr'}>
        <thead>
          <tr className="border-b border-brand-border">
            <th className="pb-2 text-start text-xs text-brand-muted font-medium uppercase tracking-wide">
              {isAr ? 'الفرع' : 'Branch'}
            </th>
            <th className="pb-2 text-end text-xs text-brand-muted font-medium uppercase tracking-wide">
              {isAr ? 'الطلبات' : 'Orders'}
            </th>
            <th className="pb-2 text-end text-xs text-brand-muted font-medium uppercase tracking-wide">
              {isAr ? 'الإيرادات' : 'Revenue'}
            </th>
            <th className="pb-2 text-end text-xs text-brand-muted font-medium uppercase tracking-wide">
              {isAr ? 'الحصة' : 'Share'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border">
          {data.map((row) => {
            const name   = BRANCH_NAMES[row.branch_id]
            const share  = total > 0 ? ((row.total_revenue_bhd / total) * 100).toFixed(0) : '0'
            return (
              <tr key={row.branch_id}>
                <td className="py-2.5 text-brand-text font-medium">
                  {name ? (isAr ? name.ar : name.en) : row.branch_id}
                </td>
                <td className="py-2.5 text-end text-brand-muted tabular-nums">
                  {row.order_count}
                </td>
                <td className="py-2.5 text-end text-brand-gold tabular-nums font-medium">
                  {row.total_revenue_bhd.toFixed(3)} {currency}
                </td>
                <td className="py-2.5 text-end text-brand-muted tabular-nums">
                  {share}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
