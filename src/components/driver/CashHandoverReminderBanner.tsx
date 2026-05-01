'use client'

interface Props {
  unsettledCount: number
  unsettledTotal: number
  onOpenHandover: () => void
  onDismiss:      () => void
  isRTL:          boolean
}

export default function CashHandoverReminderBanner({
  unsettledCount, unsettledTotal, onOpenHandover, onDismiss, isRTL,
}: Props) {
  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/15 px-4 py-3 animate-pulse"
    >
      <span className="text-xl leading-none shrink-0">💵</span>
      <div className="flex-1 min-w-0">
        <p className={`font-black text-sm text-red-300 leading-tight ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {isRTL
            ? `${unsettledCount} طلب نقدي بانتظار التسليم — ${unsettledTotal.toFixed(3)} BD`
            : `${unsettledCount} cash order${unsettledCount !== 1 ? 's' : ''} pending handover — ${unsettledTotal.toFixed(3)} BD`
          }
        </p>
        <p className={`text-xs text-red-400/80 mt-0.5 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {isRTL ? 'لا تنسَ تسليم النقد للمطعم' : 'Don\'t forget to hand over cash to the restaurant'}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpenHandover}
        className={`shrink-0 rounded-xl px-3 py-2 min-h-[44px] bg-red-500 text-white font-black text-xs transition-colors hover:bg-red-600 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}
      >
        {isRTL ? 'تسليم الآن' : 'Hand Over'}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
        aria-label={isRTL ? 'إغلاق' : 'Dismiss'}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
