'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/client'

export interface WaiterOrderRow {
  id:            string
  table_number:  number | null
  status:        string
  total_bhd:     number
  created_at:    string
  notes:         string | null
}

interface Props {
  initialOrders: WaiterOrderRow[]
  branchId:      string
  locale:        'ar' | 'en'
}

const ACTIVE_STATUSES = new Set(['new', 'accepted', 'preparing', 'ready'])

export default function WaiterOrdersClient({ initialOrders, branchId, locale }: Props) {
  const t = useTranslations('waiter')
  const isAr = locale === 'ar'
  const [orders, setOrders] = useState<WaiterOrderRow[]>(initialOrders)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`waiter-orders-${branchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `branch_id=eq.${branchId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as Partial<WaiterOrderRow> & {
            source?: string
          }
          if (!row.id || row.source !== 'waiter' || !row.table_number) return
          setOrders((prev) => {
            const filtered = prev.filter((o) => o.id !== row.id)
            const status = row.status ?? ''
            if (payload.eventType === 'DELETE' || !ACTIVE_STATUSES.has(status)) {
              return filtered
            }
            const merged: WaiterOrderRow = {
              id:           row.id as string,
              table_number: row.table_number ?? null,
              status,
              total_bhd:    Number(row.total_bhd ?? 0),
              created_at:   row.created_at ?? new Date().toISOString(),
              notes:        row.notes ?? null,
            }
            return [merged, ...filtered].sort((a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            )
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [branchId])

  const statusLabel = (s: string): string => {
    switch (s) {
      case 'new':       return t('status.new')
      case 'accepted':  return t('status.accepted')
      case 'preparing': return t('status.preparing')
      case 'ready':     return t('status.ready')
      case 'served':    return t('status.served')
      default:          return s
    }
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="mb-4 flex items-center justify-between">
        <h1 className={`text-xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
          {t('myOrders')}
        </h1>
        <Link
          href="/waiter"
          className={`text-sm font-bold text-brand-gold hover:text-brand-gold/80 ${isAr ? 'font-almarai' : 'font-satoshi'}`}
        >
          ← {t('tables')}
        </Link>
      </header>

      {orders.length === 0 ? (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center">
          <p className={`text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('noActiveOrders')}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const elapsed = Math.max(0, Math.floor(
              (Date.now() - new Date(o.created_at).getTime()) / 60000,
            ))
            return (
              <li
                key={o.id}
                className="bg-brand-surface border border-brand-border rounded-lg px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-black text-brand-gold text-base ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                      {isAr ? `طاولة ${o.table_number}` : `Table ${o.table_number}`}
                    </span>
                    <span className={`text-[11px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-brand-gold/10 text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {statusLabel(o.status)}
                    </span>
                  </div>
                  <p className={`text-xs text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t('elapsedMinutes', { m: elapsed })}
                    {o.notes ? ` · ${o.notes}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="font-satoshi font-bold text-brand-text tabular-nums text-sm">
                    {Number(o.total_bhd).toFixed(3)} {isAr ? 'د.ب' : 'BHD'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
