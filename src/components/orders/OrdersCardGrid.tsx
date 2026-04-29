'use client'

import OrderCard, { type OrderCardData } from './OrderCard'

interface Props {
  orders:        OrderCardData[]
  isRTL:         boolean
  loading:       boolean
  onViewDetails: (id: string) => void
}

export default function OrdersCardGrid({ orders, isRTL, loading, onViewDetails }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          isRTL={isRTL}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-xl border border-brand-border bg-brand-surface overflow-hidden animate-pulse">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div className="h-5 w-24 rounded bg-brand-surface-2" />
        <div className="h-5 w-20 rounded-lg bg-brand-surface-2" />
      </div>
      <div className="h-px bg-brand-border" />
      <div className="px-4 py-3 flex flex-col gap-3">
        <div className="h-4 w-3/4 rounded bg-brand-surface-2" />
        <div className="h-3 w-1/2 rounded bg-brand-surface-2" />
      </div>
      <div className="px-4 pb-3 flex flex-col gap-1.5">
        <div className="h-3 w-full rounded bg-brand-surface-2" />
        <div className="h-3 w-2/3 rounded bg-brand-surface-2" />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-brand-border">
        <div className="h-7 w-20 rounded bg-brand-surface-2" />
        <div className="flex gap-1.5">
          <div className="h-9 w-16 rounded-lg bg-brand-surface-2" />
          <div className="h-9 w-16 rounded-lg bg-brand-surface-2" />
        </div>
      </div>
    </div>
  )
}
