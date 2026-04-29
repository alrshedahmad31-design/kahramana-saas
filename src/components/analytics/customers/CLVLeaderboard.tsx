import type { TopCustomer } from '@/lib/analytics/queries'
import { colors } from '@/lib/design-tokens'

const SEGMENT_COLOR: Record<string, string> = {
  vip:        colors.gold,
  regular:    colors.success,
  occasional: colors.goldLight,
  one_time:   colors.muted,
}

interface Props {
  customers: TopCustomer[]
  isRTL:     boolean
}

export default function CLVLeaderboard({ customers, isRTL }: Props) {
  if (!customers.length) {
    return (
      <p className={`text-sm text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
        {isRTL ? 'لا توجد بيانات' : 'No customer data yet'}
      </p>
    )
  }

  const currency = isRTL ? 'د.ب' : 'BD'

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-border">
            {['#', isRTL ? 'العميل' : 'Customer', isRTL ? 'الطلبات' : 'Orders', isRTL ? 'القيمة الإجمالية' : 'Lifetime Value', isRTL ? 'الشريحة' : 'Segment'].map((h, i) => (
              <th
                key={i}
                className={`pb-2 pt-1 px-2 text-xs font-medium text-brand-muted
                            ${isRTL ? 'font-almarai text-end' : 'font-satoshi text-start'}
                            ${i === 2 || i === 3 ? 'tabular-nums' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customers.map((c, idx) => (
            <tr key={c.customer_phone} className="border-b border-brand-border/50 hover:bg-brand-surface-2">
              <td className="px-2 py-2.5 text-brand-muted font-satoshi tabular-nums text-xs">{idx + 1}</td>
              <td className="px-2 py-2.5">
                <p className={`font-medium text-brand-text ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {c.customer_name ?? (isRTL ? 'مجهول' : 'Unknown')}
                </p>
                <p className="text-xs text-brand-muted font-satoshi tabular-nums">{c.customer_phone}</p>
              </td>
              <td className="px-2 py-2.5 font-satoshi tabular-nums text-brand-text text-center">
                {c.order_count}
              </td>
              <td className="px-2 py-2.5 font-satoshi tabular-nums text-brand-gold font-semibold">
                {c.total_spent_bhd.toFixed(3)} {currency}
              </td>
              <td className="px-2 py-2.5">
                <span
                  className="text-xs font-satoshi font-medium px-2 py-0.5 rounded-md border"
                  style={{
                    color:       SEGMENT_COLOR[c.segment] ?? colors.muted,
                    borderColor: SEGMENT_COLOR[c.segment] ?? colors.muted,
                    background:  `${SEGMENT_COLOR[c.segment] ?? colors.muted}15`,
                  }}
                >
                  {c.segment.replace('_', '-')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
