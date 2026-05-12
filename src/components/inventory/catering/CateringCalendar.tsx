'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { CateringOrderRow } from '@/lib/supabase/custom-types'

interface Props {
  orders:  CateringOrderRow[]
  prefix:  string
  locale:  string
}

const STATUS_CLASSES: Record<string, string> = {
  draft:        'bg-brand-surface-2 text-brand-muted border-brand-border',
  quoted:       'bg-brand-gold/10 text-brand-gold border-brand-gold/20',
  confirmed:    'bg-green-500/10 text-green-400 border-green-500/20',
  prep_started: 'bg-brand-gold/20 text-brand-gold border-brand-gold/30',
  delivered:    'bg-green-500/20 text-green-400 border-green-500/30',
  invoiced:     'bg-brand-surface-2 text-brand-muted border-brand-border',
  cancelled:    'bg-brand-error/10 text-brand-error border-brand-error/20',
}

export default function CateringCalendar({ orders, prefix, locale }: Props) {
  const t = useTranslations('inventory.reports.catering')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  const upcoming = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'invoiced')
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 10)

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-brand-border bg-brand-surface/50 backdrop-blur-sm">
        <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} font-black text-sm text-brand-text`}>
          {t('upcoming')}
        </h3>
      </div>
      
      {upcoming.length === 0 ? (
        <div className="p-10 text-center">
          <p className={`${font} text-sm text-brand-muted italic`}>
            {t('noUpcoming')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-brand-border/50">
          {upcoming.map((order) => {
            const date = new Date(order.event_date)
            return (
              <Link
                key={order.id}
                href={`${prefix}/dashboard/inventory/catering?id=${order.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-brand-surface-2 transition-all group"
              >
                <div className="flex flex-col items-center w-12 shrink-0 text-center group-hover:scale-110 transition-transform">
                  <span className="font-cairo font-black text-xl text-brand-gold leading-none">
                    {date.getDate()}
                  </span>
                  <span className="font-satoshi text-[10px] text-brand-muted uppercase font-bold mt-0.5">
                    {date.toLocaleDateString(locale, { month: 'short', timeZone: 'Asia/Bahrain' })}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={`${font} text-sm font-bold text-brand-text truncate`}>
                    {order.client_name}
                  </p>
                  <p className={`${font} text-[11px] text-brand-muted truncate mt-0.5`}>
                    {order.venue_name || '—'} · {t('guests', { count: order.guest_count })}
                  </p>
                </div>
                
                <span className={`shrink-0 rounded-lg border px-2 py-1 ${font} text-[9px] font-bold uppercase tracking-wider transition-all group-hover:shadow-sm ${STATUS_CLASSES[order.status] || ''}`}>
                  {t(`status.${order.status}`)}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

