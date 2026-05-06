'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import type { OrderWithItems, OrderStatus } from '@/lib/supabase/custom-types'
import OrderTimeline from '@/components/orders/OrderTimeline'

interface Props {
  initialOrder: OrderWithItems
  branchEstimatedMinutes: number | null
  locale: string
}

export default function OrderTrackingStatus({ initialOrder, branchEstimatedMinutes, locale }: Props) {
  const t = useTranslations('order')
  const [order, setOrder] = useState(initialOrder)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const channel = supabase
      .channel(`order-tracking-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          console.info('Order update received:', payload.new)
          // We spread the new data over the old order state
          // Note: Realtime payload only includes the updated columns
          setOrder((prev) => ({ ...prev, ...(payload.new as any) }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [order.id, supabase])

  const etaText = useMemo(() => {
    const copy = {
      completed: t('eta.completed'),
      cancelled: t('eta.cancelled'),
      readyPickup: t('eta.readyPickup'),
      readyDelivery: t('eta.readyDelivery'),
      onWay: t('eta.onWay'),
      pickupFallback: t('eta.pickupFallback'),
      deliveryFallback: t('eta.deliveryFallback'),
      minute: (minutes: number) => t('eta.minutes', { minutes }),
      pickup: (duration: string) => t('eta.pickup', { duration }),
      delivery: (duration: string) => t('eta.delivery', { duration }),
    }

    if (['delivered', 'completed'].includes(order.status)) return copy.completed
    if (order.status === 'cancelled') return copy.cancelled
    if (order.status === 'ready') {
      return order.order_type === 'pickup' ? copy.readyPickup : copy.readyDelivery
    }
    if (order.status === 'out_for_delivery') return copy.onWay

    const fallback = order.order_type === 'pickup' ? copy.pickupFallback : copy.deliveryFallback
    const duration = branchEstimatedMinutes ? copy.minute(branchEstimatedMinutes) : fallback

    return order.order_type === 'pickup' ? copy.pickup(duration) : copy.delivery(duration)
  }, [order.status, order.order_type, branchEstimatedMinutes, t])

  const isAr = locale === 'ar'

  return (
    <>
      {/* Order number + status */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
        <div className="text-start">
          <p className={`text-xs font-bold text-brand-muted uppercase tracking-wide mb-0.5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('orderNumber')}
          </p>
          <p className="font-satoshi font-bold text-brand-text text-xl tabular-nums">
            #{order.id.slice(-8).toUpperCase()}
          </p>
        </div>
        <StatusBadge
          status={order.status}
          label={t(`status.${order.status}`)}
        />
      </div>

      {/* ETA Section */}
      {etaText && (
        <div className="px-5 py-3 border-b border-brand-border text-start">
          <p className={`text-xs font-bold text-brand-muted uppercase tracking-wide mb-0.5
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('estimatedTime')}
          </p>
          <p className={`text-sm font-bold text-brand-gold
            ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {etaText}
          </p>
        </div>
      )}

      {/* Timeline Section */}
      <div className="px-5 py-6 border-b border-brand-border">
        <OrderTimeline
          status={order.status}
          createdAt={order.created_at}
          updatedAt={order.updated_at}
          isRTL={isAr}
        />
      </div>
    </>
  )
}

// ── Sub-components (Re-implemented for Client use) ────────────────────────────

const STATUS_STYLES: Record<string, { bgClass: string; textClass: string }> = {
  pending_payment: { bgClass: 'bg-brand-gold/15',     textClass: 'text-brand-gold'        },
  confirmed:       { bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  new:             { bgClass: 'bg-brand-gold/15',     textClass: 'text-brand-gold'        },
  under_review:    { bgClass: 'bg-brand-gold/15',     textClass: 'text-brand-gold'        },
  accepted:        { bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  preparing:       { bgClass: 'bg-brand-gold/15',     textClass: 'text-brand-gold'        },
  ready:           { bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  out_for_delivery:{ bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  delivered:       { bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  completed:       { bgClass: 'bg-brand-success/15',  textClass: 'text-brand-success'     },
  cancelled:       { bgClass: 'bg-brand-error/15',    textClass: 'text-brand-error'       },
  payment_failed:  { bgClass: 'bg-brand-error/15',    textClass: 'text-brand-error'       },
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES['new']
  return (
    <span className={`font-satoshi text-xs font-bold rounded-lg
                     ps-3 pe-3 pt-1.5 pb-1.5
                     ${style.bgClass} ${style.textClass}`}>
      {label}
    </span>
  )
}
