'use client'

import { useState, useEffect } from 'react'
import type { ActivityOrder } from '@/lib/dashboard/stats'

interface Props {
  orders: ActivityOrder[]
  isRTL:  boolean
}

function timeAgo(iso: string, isRTL: boolean): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1)  return isRTL ? 'الآن' : 'just now'
  if (mins < 60) return isRTL ? `منذ ${mins} د` : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return isRTL ? `منذ ${hrs} س` : `${hrs}h ago`
}

const STATUS_CONFIG: Record<string, { dot: string; icon: string }> = {
  new:              { dot: 'bg-brand-muted',   icon: '🆕' },
  under_review:     { dot: 'bg-brand-muted',   icon: '👀' },
  accepted:         { dot: 'bg-brand-gold',    icon: '✅' },
  preparing:        { dot: 'bg-brand-gold',    icon: '🔥' },
  ready:            { dot: 'bg-brand-success', icon: '✅' },
  out_for_delivery: { dot: 'bg-brand-success', icon: '🚗' },
  delivered:        { dot: 'bg-brand-success', icon: '📦' },
  completed:        { dot: 'bg-brand-success', icon: '✅' },
  cancelled:        { dot: 'bg-brand-error',   icon: '❌' },
  payment_failed:   { dot: 'bg-brand-error',   icon: '❌' },
}

const STATUS_LABEL_EN: Record<string, string> = {
  new:              'New order',
  under_review:     'Under review',
  accepted:         'Accepted',
  preparing:        'Preparing',
  ready:            'Ready',
  out_for_delivery: 'Out for delivery',
  delivered:        'Delivered',
  completed:        'Completed',
  cancelled:        'Cancelled',
  payment_failed:   'Payment failed',
}

const STATUS_LABEL_AR: Record<string, string> = {
  new:              'طلب جديد',
  under_review:     'قيد المراجعة',
  accepted:         'مقبول',
  preparing:        'جارٍ التحضير',
  ready:            'جاهز',
  out_for_delivery: 'في الطريق',
  delivered:        'تم التسليم',
  completed:        'مكتمل',
  cancelled:        'ملغى',
  payment_failed:   'فشل الدفع',
}

export default function ActivityFeed({ orders, isRTL }: Props) {
  const [, setTick] = useState(0)

  // Refresh timestamps every minute
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-brand-error animate-pulse shrink-0" />
        <h2 className={`font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider ${isRTL ? 'font-almarai' : ''}`}>
          {isRTL ? 'النشاط المباشر' : 'Live Activity'}
        </h2>
      </div>

      {orders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-10">
          <p className="font-satoshi text-xs text-brand-muted/40">
            {isRTL ? 'لا توجد أنشطة بعد' : 'No activity yet today'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-0 overflow-y-auto max-h-[420px] scrollbar-hide">
          {orders.map((order) => {
            const cfg  = STATUS_CONFIG[order.status] ?? { dot: 'bg-brand-muted', icon: '•' }
            const lbl  = isRTL ? STATUS_LABEL_AR[order.status] : STATUS_LABEL_EN[order.status]
            const ago  = timeAgo(order.updated_at, isRTL)

            return (
              <div
                key={order.id}
                className="flex items-start gap-3 py-3 border-b border-brand-border/50 last:border-0"
              >
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`w-2 h-2 rounded-full mt-1 ${cfg.dot}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-satoshi font-bold text-xs text-brand-text">
                      {cfg.icon} {lbl}
                    </p>
                    <span className="font-satoshi text-xs text-brand-muted/50 tabular-nums shrink-0">{ago}</span>
                  </div>
                  <p className="font-satoshi text-xs text-brand-muted tabular-nums mt-0.5">
                    #{order.id.slice(-4).toUpperCase()}
                    {order.customer_name && (
                      <span className={`ms-2 ${isRTL ? 'font-almarai' : ''}`}>{order.customer_name}</span>
                    )}
                  </p>
                  <p className="font-satoshi text-xs text-brand-gold tabular-nums mt-0.5">
                    {Number(order.total_bhd).toFixed(3)} BD
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
