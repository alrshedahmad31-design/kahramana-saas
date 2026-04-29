'use client'

interface Props {
  isOnline:       boolean
  onToggle:       () => void
  completedToday: number
  totalRevenue?:  number
  isRTL:          boolean
  clock:          string
}

export default function DriverHeader({ isOnline, onToggle, completedToday, totalRevenue, isRTL, clock }: Props) {
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
        <div className="flex items-center gap-4 px-4 py-2 border-t border-brand-border/50 bg-brand-surface-2/40">
          {completedToday > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-satoshi font-black text-base text-brand-success tabular-nums">{completedToday}</span>
              <span className={`text-xs text-brand-success/70 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {isRTL ? 'مُسلَّم' : 'delivered'}
              </span>
            </div>
          )}

          {completedToday > 0 && totalRevenue !== undefined && totalRevenue > 0 && (
            <span className="w-px h-4 bg-brand-border" />
          )}

          {totalRevenue !== undefined && totalRevenue > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-satoshi font-black text-base text-brand-gold tabular-nums">
                {totalRevenue.toFixed(3)}
              </span>
              <span className="font-satoshi text-xs text-brand-muted">BD</span>
            </div>
          )}

          <div className="ms-auto flex items-center gap-1 text-brand-success/60">
            <StarIcon />
            <span className="font-satoshi text-xs text-brand-muted">
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
