'use client'

import type { KDSOrder } from '@/lib/supabase/types'
import KDSOrderCard from './KDSOrderCard'

type ActiveStatus = 'accepted' | 'preparing' | 'ready'

interface Props {
  status:    ActiveStatus
  orders:    KDSOrder[]
  isRTL:     boolean
  onAdvance: (orderId: string, status: ActiveStatus) => Promise<void>
}

const CONFIG: Record<ActiveStatus, {
  titleEn: string; titleAr: string
  color:   string; border: string; bg: string
  dot:     string; headerBorder: string
}> = {
  accepted: {
    titleEn: 'New Orders', titleAr: 'طلبات جديدة',
    color:  'text-brand-error',
    border: 'border-brand-error/40',
    bg:     'bg-brand-error/5',
    dot:    'bg-brand-error',
    headerBorder: 'border-b-4 border-brand-error/60',
  },
  preparing: {
    titleEn: 'In Progress', titleAr: 'قيد التحضير',
    color:  'text-brand-gold',
    border: 'border-brand-gold/40',
    bg:     'bg-brand-gold/5',
    dot:    'bg-brand-gold',
    headerBorder: 'border-b-4 border-brand-gold/60',
  },
  ready: {
    titleEn: 'Ready', titleAr: 'جاهز للتسليم',
    color:  'text-brand-success',
    border: 'border-brand-success/40',
    bg:     'bg-brand-success/5',
    dot:    'bg-brand-success',
    headerBorder: 'border-b-4 border-brand-success/60',
  },
}

export default function KDSColumn({ status, orders, isRTL, onAdvance }: Props) {
  const cfg  = CONFIG[status]
  const font = isRTL ? 'font-almarai' : 'font-satoshi'

  return (
    <div className="flex flex-col h-full min-w-[320px] overflow-hidden">
      {/* ── Column header ── */}
      <div className={`shrink-0 flex items-center gap-3 px-5 py-4 ${cfg.bg} ${cfg.headerBorder}`}>
        {/* Animated dot */}
        <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${cfg.dot}
          ${status === 'accepted' && orders.length > 0 ? 'animate-pulse' : ''}`}
        />

        {/* Title */}
        <h2 className={`font-black text-2xl ${cfg.color} ${font} flex-1`}>
          {isRTL ? cfg.titleAr : cfg.titleEn}
        </h2>

        {/* Count badge */}
        {orders.length > 0 && (
          <span className={`font-satoshi font-black text-xl tabular-nums w-9 h-9 rounded-xl
            flex items-center justify-center ${cfg.color} bg-brand-surface border ${cfg.border}`}>
            {orders.length}
          </span>
        )}
      </div>

      {/* ── Cards ── */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {orders.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <span className={`text-brand-muted/30 text-xl ${font}`}>
              {isRTL ? '— لا طلبات —' : '— empty —'}
            </span>
          </div>
        ) : (
          orders.map((order) => (
            <KDSOrderCard
              key={order.id}
              order={order}
              isRTL={isRTL}
              onAdvance={onAdvance}
            />
          ))
        )}
      </div>
    </div>
  )
}
