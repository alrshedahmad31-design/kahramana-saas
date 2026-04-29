import type { OrderStatus } from '@/lib/supabase/types'

interface Props {
  status:    OrderStatus
  createdAt: string
  updatedAt: string
  isRTL:     boolean
}

const FLOW: { status: OrderStatus; labelEn: string; labelAr: string }[] = [
  { status: 'new',              labelEn: 'Order received',   labelAr: 'تم استلام الطلب' },
  { status: 'accepted',         labelEn: 'Accepted',         labelAr: 'تم القبول' },
  { status: 'preparing',        labelEn: 'Preparing',        labelAr: 'قيد التحضير' },
  { status: 'ready',            labelEn: 'Ready',            labelAr: 'جاهز للاستلام' },
  { status: 'out_for_delivery', labelEn: 'Out for delivery', labelAr: 'في طريق التوصيل' },
  { status: 'delivered',        labelEn: 'Delivered',        labelAr: 'تم التسليم' },
]

const STATUS_INDEX: Partial<Record<OrderStatus, number>> = {
  new:              0,
  under_review:     0,
  accepted:         1,
  preparing:        2,
  ready:            3,
  out_for_delivery: 4,
  delivered:        5,
  completed:        5,
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-BH', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function OrderTimeline({ status, createdAt, updatedAt, isRTL }: Props) {
  const isCancelled  = status === 'cancelled' || status === 'payment_failed'
  const currentIndex = STATUS_INDEX[status] ?? 0

  return (
    <div className="flex flex-col gap-0" dir={isRTL ? 'rtl' : 'ltr'}>
      {FLOW.map((step, i) => {
        const isDone    = i <= currentIndex && !isCancelled
        const isCurrent = i === currentIndex && !isCancelled
        const isLast    = i === FLOW.length - 1

        const timestamp = i === 0 ? formatTime(createdAt)
          : isCurrent   ? formatTime(updatedAt)
          : null

        return (
          <div key={step.status} className="flex items-start gap-3">
            {/* Spine */}
            <div className="flex flex-col items-center shrink-0">
              <div className={`
                w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                ${isDone
                  ? isCurrent
                    ? 'border-brand-gold bg-brand-gold'
                    : 'border-brand-success bg-brand-success/20'
                  : 'border-brand-border bg-brand-surface-2'
                }
              `}>
                {isDone && !isCurrent && <CheckMiniIcon />}
                {isCurrent && <DotIcon />}
              </div>
              {!isLast && (
                <div className={`w-0.5 h-6 mt-0.5 ${i < currentIndex && !isCancelled ? 'bg-brand-success/40' : 'bg-brand-border'}`} />
              )}
            </div>

            {/* Label */}
            <div className="pb-5 min-w-0">
              <p className={`font-satoshi text-sm font-medium leading-none mt-1 ${
                isDone ? (isCurrent ? 'text-brand-gold' : 'text-brand-text') : 'text-brand-muted/50'
              } ${isRTL ? 'font-almarai' : ''}`}>
                {isRTL ? step.labelAr : step.labelEn}
              </p>
              {timestamp && (
                <p className="font-satoshi text-xs text-brand-muted tabular-nums mt-0.5">
                  {timestamp}
                </p>
              )}
            </div>
          </div>
        )
      })}

      {isCancelled && (
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-brand-error bg-brand-error/10 flex items-center justify-center shrink-0">
            <XMiniIcon />
          </div>
          <div className="min-w-0 pt-1">
            <p className={`font-satoshi text-sm font-medium text-brand-error ${isRTL ? 'font-almarai' : ''}`}>
              {isRTL ? (status === 'payment_failed' ? 'فشل الدفع' : 'تم الإلغاء') : (status === 'payment_failed' ? 'Payment failed' : 'Cancelled')}
            </p>
            <p className="font-satoshi text-xs text-brand-muted tabular-nums mt-0.5">
              {formatTime(updatedAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function CheckMiniIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="text-brand-success" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function DotIcon() {
  return <div className="w-2 h-2 rounded-full bg-brand-black" />
}

function XMiniIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="text-brand-error" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
