import { colors } from '@/lib/design-tokens'
import type { CustomerSegmentSummary } from '@/lib/analytics/queries'

const SEGMENT_META: Record<string, { labelEn: string; labelAr: string; color: string }> = {
  vip:        { labelEn: 'VIP (20+ orders)',      labelAr: 'VIP (20+ طلب)',        color: colors.gold    },
  regular:    { labelEn: 'Regular (5–19 orders)', labelAr: 'منتظم (5–19 طلب)',     color: colors.success },
  occasional: { labelEn: 'Occasional (2–4)',       labelAr: 'متكرر أحياناً (2–4)', color: colors.goldLight },
  one_time:   { labelEn: 'One-time',              labelAr: 'مرة واحدة',            color: colors.muted   },
}

interface Props {
  segments: CustomerSegmentSummary[]
  isRTL:    boolean
}

export default function SegmentChart({ segments, isRTL }: Props) {
  const total = segments.reduce((s, r) => s + r.customer_count, 0)
  if (total === 0) {
    return (
      <p className={`text-sm text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
        {isRTL ? 'لا توجد بيانات' : 'No data yet'}
      </p>
    )
  }

  const ORDER: CustomerSegmentSummary['segment'][] = ['vip', 'regular', 'occasional', 'one_time']
  const sorted = ORDER
    .map((seg) => segments.find((s) => s.segment === seg))
    .filter(Boolean) as CustomerSegmentSummary[]

  return (
    <div className="space-y-4">
      {sorted.map((seg) => {
        const meta  = SEGMENT_META[seg.segment]
        const pct   = total > 0 ? (seg.customer_count / total) * 100 : 0

        return (
          <div key={seg.segment}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-sm font-medium text-brand-text ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {isRTL ? meta.labelAr : meta.labelEn}
              </span>
              <span className="text-sm font-satoshi text-brand-muted tabular-nums">
                {seg.customer_count.toLocaleString()} ({pct.toFixed(0)}%)
              </span>
            </div>

            {/* Bar */}
            <div className="h-2 w-full bg-brand-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: meta.color }}
              />
            </div>

            <p className="text-xs text-brand-muted font-satoshi tabular-nums mt-1">
              {isRTL ? 'الإيرادات:' : 'Revenue:'}{' '}
              {seg.total_revenue.toFixed(3)} {isRTL ? 'د.ب' : 'BD'}
            </p>
          </div>
        )
      })}
    </div>
  )
}
