import type { CateringOrderStatus } from '@/lib/supabase/custom-types'

const STEPS: Array<{ status: CateringOrderStatus; label_ar: string; label_en: string }> = [
  { status: 'draft',        label_ar: 'مسودة',        label_en: 'Draft' },
  { status: 'quoted',       label_ar: 'عرض سعر',      label_en: 'Quoted' },
  { status: 'confirmed',    label_ar: 'مؤكد',         label_en: 'Confirmed' },
  { status: 'prep_started', label_ar: 'جاري التحضير', label_en: 'In Prep' },
  { status: 'delivered',    label_ar: 'تم التسليم',   label_en: 'Delivered' },
  { status: 'invoiced',     label_ar: 'تمت الفوترة',  label_en: 'Invoiced' },
]

interface Props {
  currentStatus: CateringOrderStatus
  isAr?: boolean
}

export default function CateringStatusStepper({ currentStatus, isAr = true }: Props) {
  if (currentStatus === 'cancelled') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
        <span className="font-satoshi text-xs text-red-400">{isAr ? 'ملغي' : 'Cancelled'}</span>
      </div>
    )
  }

  const currentIndex = STEPS.findIndex((s) => s.status === currentStatus)

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STEPS.map((step, i) => {
        const done   = i < currentIndex
        const active = i === currentIndex
        return (
          <div key={step.status} className="flex items-center gap-1">
            <span className={[
              'rounded-lg px-2 py-1 text-xs font-satoshi font-medium border transition-colors',
              active ? 'bg-brand-gold/10 border-brand-gold/30 text-brand-gold' : '',
              done   ? 'bg-brand-surface-2 border-transparent text-brand-muted line-through' : '',
              !active && !done ? 'border-transparent text-brand-muted/40' : '',
            ].join(' ')}>
              {isAr ? step.label_ar : step.label_en}
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-brand-border text-xs select-none">›</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
