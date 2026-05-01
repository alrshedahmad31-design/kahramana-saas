interface Props {
  status: string
  locale: string
}

const STEPS = [
  { key: 'draft',     labelAr: 'مسودة',          labelEn: 'Draft' },
  { key: 'sent',      labelAr: 'مُرسَل',          labelEn: 'Sent' },
  { key: 'confirmed', labelAr: 'مؤكَّد',          labelEn: 'Confirmed' },
  { key: 'partial',   labelAr: 'مستلم جزئياً',   labelEn: 'Partial' },
  { key: 'received',  labelAr: 'مستلم',           labelEn: 'Received' },
]

export default function POStatusTimeline({ status, locale }: Props) {
  const isAr = locale !== 'en'
  const isCancelled = status === 'cancelled'

  const activeIndex = STEPS.findIndex((s) => s.key === status)

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-3 py-1.5 rounded-lg font-satoshi text-sm font-medium bg-red-500/10 text-red-400">
          {isAr ? 'ملغي' : 'Cancelled'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {STEPS.map((step, index) => {
        const isCompleted = activeIndex > index
        const isActive    = activeIndex === index

        return (
          <div key={step.key} className="flex items-center">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1 min-w-[80px]">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-satoshi text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-brand-gold text-brand-black ring-2 ring-brand-gold/30'
                    : isCompleted
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-brand-surface-2 text-brand-muted'
                }`}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <p
                className={`font-satoshi text-xs text-center ${
                  isActive
                    ? 'text-brand-gold font-semibold'
                    : isCompleted
                      ? 'text-green-400'
                      : 'text-brand-muted'
                }`}
              >
                {isAr ? step.labelAr : step.labelEn}
              </p>
            </div>

            {/* Connector */}
            {index < STEPS.length - 1 && (
              <div
                className={`h-px w-8 flex-shrink-0 mx-1 ${
                  isCompleted ? 'bg-green-500/40' : 'bg-brand-border'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
