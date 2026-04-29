'use client'

interface Props {
  isOnline:          boolean
  onToggle:          () => void
  completedToday:    number
  totalRevenue?:     number
  avgDeliveryMins?:  number
  isRTL:             boolean
  clock:             string
}

export default function DriverHeader({ isOnline, onToggle, completedToday, totalRevenue, avgDeliveryMins, isRTL, clock }: Props) {
  return (
    <header className="shrink-0 border-b border-brand-border bg-brand-surface">
      {/* Main row */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-300 ${isOnline ? 'bg-brand-success animate-pulse' : 'bg-brand-muted'}`} />
          <h1 className={`font-satoshi font-black text-lg text-brand-text ${isRTL ? 'font-almarai' : ''}`}>
            {isRTL ? 'شاشة التوصيل' : 'Deliveries'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-satoshi text-sm text-brand-muted tabular-nums hidden sm:block">{clock}</span>

          <button
            type="button"
            onClick={onToggle}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 min-h-[40px] font-satoshi font-bold text-sm transition-colors duration-150 ${
              isOnline
                ? 'bg-brand-success/20 text-brand-success border border-brand-success/40'
                : 'bg-brand-surface-2 text-brand-muted border border-brand-border'
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-brand-success' : 'bg-brand-muted'}`} />
            {isRTL ? (isOnline ? 'متاح' : 'غير متاح') : (isOnline ? 'Online' : 'Offline')}
          </button>
        </div>
      </div>

      {/* Performance bar — only visible when there are stats */}
      {(completedToday > 0 || (totalRevenue !== undefined && totalRevenue > 0)) && (
        <div className="flex items-center gap-3 px-4 py-2 border-t border-brand-border/50 bg-brand-surface-2/40 overflow-x-auto">
          {completedToday > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <TruckMiniIcon />
              <span className="font-satoshi font-black text-sm text-brand-success tabular-nums">{completedToday}</span>
              <span className={`text-xs text-brand-success/70 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {isRTL ? 'توصيلة' : 'done'}
              </span>
            </div>
          )}

          {completedToday > 0 && totalRevenue !== undefined && totalRevenue > 0 && (
            <span className="w-px h-4 bg-brand-border shrink-0" />
          )}

          {totalRevenue !== undefined && totalRevenue > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="font-satoshi font-black text-sm text-brand-gold tabular-nums">
                {totalRevenue.toFixed(3)}
              </span>
              <span className="font-satoshi text-xs text-brand-muted">BD</span>
            </div>
          )}

          {avgDeliveryMins !== undefined && avgDeliveryMins > 0 && (
            <>
              <span className="w-px h-4 bg-brand-border shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <ClockMiniIcon />
                <span className="font-satoshi font-black text-sm text-brand-muted tabular-nums">{avgDeliveryMins}</span>
                <span className={`text-xs text-brand-muted/70 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? 'د متوسط' : 'min avg'}
                </span>
              </div>
            </>
          )}

          <div className="ms-auto flex items-center gap-1 text-brand-success/60 shrink-0">
            <StarIcon />
            <span className={`text-xs text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {completedToday >= 10
                ? (isRTL ? 'يوم رائع!' : 'Great day!')
                : completedToday >= 5
                  ? (isRTL ? 'أداء جيد' : 'Good pace')
                  : (isRTL ? 'ابدأ' : 'Getting started')
              }
            </span>
          </div>
        </div>
      )}
    </header>
  )
}

function StarIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

function TruckMiniIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-success" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  )
}

function ClockMiniIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-muted" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  )
}
