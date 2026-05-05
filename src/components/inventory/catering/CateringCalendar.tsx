import Link from 'next/link'
import type { CateringOrderRow, CateringOrderStatus } from '@/lib/supabase/custom-types'

interface Props {
  orders:  CateringOrderRow[]
  prefix:  string
  isAr?:   boolean
}

const STATUS_COLOR: Record<CateringOrderStatus, string> = {
  draft:        'bg-brand-surface-2 text-brand-muted border-brand-border',
  quoted:       'bg-brand-gold/10 text-brand-gold border-brand-gold/20',
  confirmed:    'bg-green-500/10 text-green-400 border-green-500/20',
  prep_started: 'bg-brand-gold/20 text-brand-gold border-brand-gold/30',
  delivered:    'bg-green-500/20 text-green-400 border-green-500/30',
  invoiced:     'bg-brand-surface-2 text-brand-muted border-brand-border',
  cancelled:    'bg-red-500/10 text-red-400 border-red-500/20',
}

const STATUS_LABEL_AR: Record<CateringOrderStatus, string> = {
  draft:        'مسودة',
  quoted:       'عرض سعر',
  confirmed:    'مؤكد',
  prep_started: 'جاري التحضير',
  delivered:    'تم التسليم',
  invoiced:     'تمت الفوترة',
  cancelled:    'ملغي',
}

export default function CateringCalendar({ orders, prefix, isAr = true }: Props) {
  const upcoming = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'invoiced')
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 10)

  if (upcoming.length === 0) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 text-center">
        <p className="font-satoshi text-sm text-brand-muted py-4">
          {isAr ? 'لا توجد فعاليات قادمة' : 'No upcoming events'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-border">
        <h3 className="font-satoshi font-bold text-sm text-brand-text">
          {isAr ? 'الفعاليات القادمة' : 'Upcoming Events'}
        </h3>
      </div>
      <div className="flex flex-col divide-y divide-brand-border">
        {upcoming.map((order) => {
          const date = new Date(order.event_date)
          return (
            <Link
              key={order.id}
              href={`${prefix}/dashboard/inventory/catering?id=${order.id}`}
              className="flex items-center gap-4 px-5 py-3 hover:bg-brand-surface-2 transition-colors"
            >
              <div className="flex flex-col items-center w-12 shrink-0 text-center">
                <span className="font-cairo font-black text-lg text-brand-gold leading-none">
                  {date.getDate()}
                </span>
                <span className="font-satoshi text-xs text-brand-muted">
                  {date.toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', { month: 'short', timeZone: 'Asia/Bahrain' })}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-satoshi text-sm font-medium text-brand-text truncate">
                  {order.client_name}
                </p>
                <p className="font-satoshi text-xs text-brand-muted truncate">
                  {order.venue_name ?? (isAr ? 'بدون موقع' : 'No venue')} · {order.guest_count} {isAr ? 'ضيف' : 'guests'}
                </p>
              </div>
              <span className={`shrink-0 rounded-lg border px-2 py-1 font-satoshi text-xs font-medium ${STATUS_COLOR[order.status as CateringOrderStatus]}`}>
                {isAr ? STATUS_LABEL_AR[order.status as CateringOrderStatus] : order.status}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
