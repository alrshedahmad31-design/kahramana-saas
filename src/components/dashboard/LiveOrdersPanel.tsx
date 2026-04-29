'use client'

import { useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { ActiveCounts } from '@/lib/dashboard/stats'

interface Props {
  counts:      ActiveCounts
  avgPrepMins: number
  prefix:      string
  isRTL:       boolean
}

interface StatusRow {
  key:    string
  labelEn: string
  labelAr: string
  count:  number
  color:  string
  dot:    string
  href:   string
}

export default function LiveOrdersPanel({ counts, avgPrepMins, prefix, isRTL }: Props) {
  const router  = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = useMemo(() => createClient() as any, [])

  // Realtime: any order change triggers a page refresh for fresh server data
  useEffect(() => {
    const ch = supabase
      .channel('dash-live-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        router.refresh()
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [supabase, router])

  const ordersUrl = `${prefix}/dashboard/orders`
  const kdsUrl    = `${prefix}/dashboard/kds`

  const rows: StatusRow[] = [
    {
      key:     'new',
      labelEn: 'New Orders',
      labelAr: 'حلقة الطلبات',
      count:   counts.new,
      color:   counts.new > 0 ? 'text-brand-error' : 'text-brand-muted',
      dot:     counts.new > 0 ? 'bg-brand-error animate-pulse' : 'bg-brand-muted',
      href:    ordersUrl,
    },
    {
      key:     'waiting',
      labelEn: 'Waiting',
      labelAr: 'في الانتظار',
      count:   counts.under_review,
      color:   'text-brand-muted',
      dot:     'bg-brand-muted',
      href:    ordersUrl,
    },
    {
      key:     'accepted',
      labelEn: 'Accepted',
      labelAr: 'مقبول',
      count:   counts.accepted,
      color:   'text-brand-gold',
      dot:     'bg-brand-gold',
      href:    kdsUrl,
    },
    {
      key:     'preparing',
      labelEn: 'Preparing',
      labelAr: 'قيد التحضير',
      count:   counts.preparing,
      color:   'text-brand-gold',
      dot:     'bg-brand-gold animate-pulse',
      href:    kdsUrl,
    },
    {
      key:     'ready',
      labelEn: 'Ready',
      labelAr: 'جاهز',
      count:   counts.ready,
      color:   'text-brand-success',
      dot:     'bg-brand-success',
      href:    kdsUrl,
    },
    {
      key:     'delivery',
      labelEn: 'Out for Delivery',
      labelAr: 'في الطريق',
      count:   counts.out_for_delivery,
      color:   'text-brand-muted',
      dot:     'bg-brand-muted',
      href:    ordersUrl,
    },
  ]

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full shrink-0 ${counts.total > 0 ? 'bg-brand-error animate-pulse' : 'bg-brand-muted'}`} />
          <h2 className={`font-satoshi font-black text-sm uppercase tracking-wider text-brand-muted ${isRTL ? 'font-almarai' : ''}`}>
            {isRTL ? 'حالة الطلبات' : 'Live Orders'}
          </h2>
        </div>
        {counts.total > 0 && (
          <span className="font-satoshi font-black text-xs tabular-nums text-brand-error border border-brand-error/30 rounded-full w-6 h-6 flex items-center justify-center">
            {counts.total}
          </span>
        )}
      </div>

      {/* Status rows */}
      <div className="flex flex-col divide-y divide-brand-border/50">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full shrink-0 ${row.dot}`} />
              <span className={`font-satoshi text-sm text-brand-text ${isRTL ? 'font-almarai' : ''}`}>
                {isRTL ? row.labelAr : row.labelEn}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-satoshi font-black text-base tabular-nums ${row.count > 0 ? row.color : 'text-brand-muted/40'}`}>
                {row.count}
              </span>
              {row.count > 0 && (
                <Link href={row.href} className="font-satoshi text-xs text-brand-muted hover:text-brand-gold transition-colors duration-150">
                  →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-brand-border/50 flex items-center justify-between gap-3">
        {avgPrepMins > 0 ? (
          <p className="font-satoshi text-xs text-brand-muted">
            {isRTL ? 'متوسط التحضير:' : 'Avg prep:'}
            <span className="font-bold text-brand-text ms-1.5 tabular-nums">{avgPrepMins} {isRTL ? 'دقيقة' : 'min'}</span>
          </p>
        ) : (
          <p className="font-satoshi text-xs text-brand-muted/40">—</p>
        )}

        {counts.longestId && (
          <p className="font-satoshi text-xs text-brand-muted">
            {isRTL ? 'أطول انتظار:' : 'Longest wait:'}
            <span className={`font-bold ms-1.5 tabular-nums ${counts.longestMins >= 20 ? 'text-brand-error' : 'text-brand-gold'}`}>
              #{counts.longestId.slice(-4).toUpperCase()} ({counts.longestMins}{isRTL ? 'د' : 'm'})
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
